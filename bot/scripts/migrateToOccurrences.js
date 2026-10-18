// One-time move from Completion records to Occurrences.
//
//   node bot/scripts/migrateToOccurrences.js            # dry run: prints what it would do
//   node bot/scripts/migrateToOccurrences.js --apply    # writes
//
// Safe to re-run: existing occurrences are never overwritten, and the XP
// adjustment is recomputed so each member's weekly XP stays exactly what it
// was at the moment of migration. Completion records are left untouched.
const mongoose = require('mongoose');
const config = require('../config');
const { User, Task, Completion, Occurrence, XpAdjustment, Meta } = require('../database/models');
const { toDateKey, todayKey, weekKeyOf, localParts, latestClosableDay, weekdayOf } = require('../utils/time');
const { penaltyFor } = require('../services/schedule');

const APPLY = process.argv.includes('--apply');
const RANK = { done: 3, missed: 2, ignored: 1 };

async function main() {
  const now = new Date();
  const today = todayKey(now);
  const week = weekKeyOf(today);

  // The old week reset ran Monday 06:00; the new week starts Monday 00:00.
  // Migrating between the two would credit last week's XP to the new week.
  if (weekdayOf(today) === 1 && localParts(now).hour < config.rules.closeHour) {
    throw new Error(`Run this after Monday 0${config.rules.closeHour}:00 (${config.timezone.name}).`);
  }

  await mongoose.connect(config.mongodb.uri);
  console.log(APPLY ? '✍️  APPLY mode' : '👀 Dry run (pass --apply to write)');

  const tasks = new Map((await Task.find()).map((t) => [String(t._id), t]));
  const completions = await Completion.find().lean();

  // One row per task/person/day; when duplicates exist, done beats missed beats ignored.
  const rows = new Map();
  let skipped = 0;
  for (const c of completions) {
    const task = tasks.get(String(c.taskId));
    if (!task || !config.isMember(c.userId)) { skipped++; continue; }

    const date = toDateKey(c.scheduledFor || c.completedAt);
    const status = c.completed ? 'done' : c.missedConfirmation ? 'ignored' : 'missed';
    const key = `${c.taskId}|${c.userId}|${date}`;
    const prev = rows.get(key);
    if (prev && RANK[prev.status] >= RANK[status]) continue;

    const weekKey = weekKeyOf(date);
    rows.set(key, {
      taskId: task._id,
      userId: String(c.userId),
      date,
      weekKey,
      status,
      progress: status === 'done' ? task.target || 1 : 0,
      target: task.target || 1,
      // Only this week's penalties matter (older weeks are already settled);
      // the adjustment below reconciles them with the real XP.
      penalty: weekKey === week ? penaltyFor(status) : 0,
      taskName: task.name,
      taskType: task.type,
      time: task.schedule?.time,
      advance: !!c.advanceCompletion,
      source: 'legacy',
      resolvedBy: status === 'ignored' ? 'system' : String(c.userId),
      resolvedAt: c.completedAt,
    });
  }

  const docs = [...rows.values()];
  const counts = docs.reduce((acc, d) => ({ ...acc, [d.status]: (acc[d.status] || 0) + 1 }), {});
  console.log(`Completions: ${completions.length} → occurrences: ${docs.length} (skipped ${skipped} without task/member)`);
  console.log('By status:', counts);

  if (APPLY && docs.length) {
    const res = await Occurrence.bulkWrite(docs.map((d) => ({
      updateOne: {
        filter: { taskId: d.taskId, userId: d.userId, date: d.date },
        update: { $setOnInsert: d },
        upsert: true,
      },
    })), { ordered: false });
    console.log(`Inserted ${res.upsertedCount}, already present ${docs.length - res.upsertedCount}`);
  }

  // Keep this week's XP exactly as the old system left it. Prefer the snapshot
  // taken when the new code first started (it may have refreshed user.weeklyXp since).
  const snapshot = (await Meta.findOne({ key: 'legacyWeeklyXp' }))?.value;
  if (snapshot && snapshot.week !== week) {
    console.log(`Old XP snapshot is from week ${snapshot.week}; this week started under the new rules, no adjustment.`);
  }
  for (const id of config.memberIds()) {
    const user = await User.findOne({ telegramId: id });
    if (!user) continue;
    let legacyXp = user.weeklyXp ?? config.rules.startXp;
    if (snapshot) legacyXp = snapshot.week === week ? (snapshot.xp[id] ?? config.rules.startXp) : null;
    if (legacyXp === null) continue;
    const desiredLoss = config.rules.startXp - legacyXp;

    // Only the migrated rows stand in for the old system's losses; penalties the
    // new code recorded since it started stay on top of them.
    const occLoss = APPLY
      ? (await Occurrence.find({ userId: id, weekKey: week, source: 'legacy' }).lean()).reduce((s, o) => s + o.penalty, 0)
      : docs.filter((d) => d.userId === id && d.weekKey === week).reduce((s, d) => s + d.penalty, 0);
    const adjLoss = (await XpAdjustment.find({ userId: id, weekKey: week }).lean()).reduce((s, a) => s + a.amount, 0);
    const diff = desiredLoss - occLoss - adjLoss;

    console.log(`${config.memberName(id)}: weekly XP ${legacyXp}; adjustment needed ${diff}`);
    if (APPLY && diff !== 0) {
      await XpAdjustment.create({ userId: id, weekKey: week, amount: diff, reason: 'migration from completions' });
    }
  }

  // The old 06:00 check already closed everything up to the latest closable
  // day, and this week will be settled by the new system.
  const lastClosed = latestClosableDay(now);
  console.log(`lastClosedDay → ${lastClosed}, settleFromWeek → ${week}`);
  if (APPLY) {
    await Meta.updateOne({ key: 'lastClosedDay' }, { $setOnInsert: { value: lastClosed } }, { upsert: true });
    await Meta.updateOne({ key: 'settleFromWeek' }, { $setOnInsert: { value: week } }, { upsert: true });
    await Occurrence.syncIndexes();
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌', err.message);
  await mongoose.disconnect();
  process.exit(1);
});
