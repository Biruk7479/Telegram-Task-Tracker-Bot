const config = require('../config');
const rewards = require('../data/rewards.json');
const { Task, User, Occurrence, XpAdjustment, WeekResult, Meta } = require('../database/models');
const {
  todayKey, addDays, weekKeyOf, isDayOpen, closeInstant, latestClosableDay, localParts, normalizeTime,
} = require('../utils/time');
const {
  assigneesOf, isScheduledOn, closedStatus, penaltyFor, streakFrom, nextState,
} = require('./schedule');

const httpError = (status, message) => Object.assign(new Error(message), { status });

const isDuplicateKey = (err) =>
  err?.code === 11000 || (err?.writeErrors || []).every((e) => (e.code ?? e.err?.code) === 11000);

const getMeta = async (key) => (await Meta.findOne({ key }))?.value;
const setMeta = (key, value) => Meta.updateOne({ key }, { $set: { value } }, { upsert: true });

const snapshot = (task) => ({
  taskName: task.name,
  taskType: task.type,
  time: task.schedule?.time ? normalizeTime(task.schedule.time) : undefined,
  target: task.target || 1,
  unit: task.unit || '',
  mode: task.mode || 'each',
  area: task.area || '',
});

// ==================== GENERATING ====================

// Creates the missing occurrences for a day. Safe to call any number of times.
// Occurrences created after the day has already closed are 'void': the server
// was not running, so nobody could have answered and nobody is penalized.
async function ensureDay(dateKey, now = new Date()) {
  const tasks = await Task.find({ active: true });
  const status = isDayOpen(dateKey, now) ? 'pending' : 'void';
  const ops = [];

  for (const task of tasks) {
    if (!isScheduledOn(task, dateKey)) continue;
    for (const userId of assigneesOf(task)) {
      ops.push({
        updateOne: {
          filter: { taskId: task._id, userId, date: dateKey },
          update: {
            $setOnInsert: {
              ...snapshot(task), weekKey: weekKeyOf(dateKey), status, progress: 0, penalty: 0, source: 'system',
            },
          },
          upsert: true,
        },
      });
    }
  }

  if (ops.length === 0) return;
  try {
    await Occurrence.bulkWrite(ops, { ordered: false });
  } catch (err) {
    if (!isDuplicateKey(err)) throw err; // a concurrent ensure won the race; nothing lost
  }
}

// After a task is edited or deleted, bring its open (today and future) pending
// occurrences in line: refresh the snapshot, void the ones no longer scheduled,
// and create any that are now due.
async function resyncTask(task, now = new Date()) {
  const today = todayKey(now);
  const open = await Occurrence.find({ taskId: task._id, date: { $gte: addDays(today, -1) } });
  const assignees = assigneesOf(task);

  for (const occ of open) {
    if (!isDayOpen(occ.date, now)) continue;
    const scheduled = task.active && assignees.includes(occ.userId)
      && (isScheduledOn(task, occ.date) || task.type === 'flexible');

    if (!scheduled && occ.status === 'pending') {
      occ.status = 'void';
    } else if (scheduled && occ.status === 'void') {
      occ.status = 'pending';
    }
    if (occ.status === 'pending') Object.assign(occ, snapshot(task));
    await occ.save();
  }

  if (task.active) await ensureDay(today, now);
  await Promise.all(assignees.map((id) => refreshUserCaches(id, now)));
}

// ==================== MARKING ====================

// The single write path for "I did it / I didn't / excuse me / +1".
// Double taps are harmless: the unique index means there is only ever one row.
async function mark({ taskId, userId, date, action, amount = 1, source = 'api', now = new Date() }) {
  userId = String(userId);
  if (!config.isMember(userId)) throw httpError(403, 'Only members can mark tasks');

  const task = await Task.findById(taskId);
  if (!task) throw httpError(404, 'Task not found');
  if (!assigneesOf(task).includes(userId)) throw httpError(403, 'This task is not assigned to you');

  const today = todayKey(now);
  date = date || today;
  if (!isDayOpen(date, now)) throw httpError(409, `${date} is closed — days lock at 0${config.rules.closeHour}:00 the next morning`);

  let occ = await Occurrence.findOne({ taskId: task._id, userId, date });
  if (!occ) {
    if (!task.active) throw httpError(404, 'Task not found');
    if (task.type !== 'flexible' && !isScheduledOn(task, date)) {
      throw httpError(409, `"${task.name}" is not scheduled on ${date}`);
    }
    occ = await upsertOccurrence(task, userId, date);
  }
  if (occ.status === 'void') throw httpError(409, `"${task.name}" is not tracked on ${date}`);

  if (action === 'excused' && occ.status !== 'excused') {
    const used = await Occurrence.countDocuments({ userId, weekKey: occ.weekKey, status: 'excused', resolvedBy: userId });
    if (used >= config.rules.excusesPerWeek) {
      throw httpError(409, `No excuses left this week (${config.rules.excusesPerWeek} per week)`);
    }
  }

  const previousStatus = occ.status;
  const state = nextState(occ, action, amount);
  const advance = state.status === 'done'
    && (date > today || (date === today && !!occ.time && localParts(now).time < occ.time));

  const update = {
    ...state,
    advance,
    source,
    resolvedBy: userId,
    resolvedAt: state.status === 'pending' ? null : now,
  };
  Object.assign(occ, update);
  await occ.save();

  // Pooled tasks have one shared result: mirror it onto every assignee.
  const affected = new Set([userId]);
  if (task.mode === 'pooled') {
    for (const other of assigneesOf(task)) {
      if (other === userId) continue;
      const theirs = await Occurrence.findOne({ taskId: task._id, userId: other, date })
        || await upsertOccurrence(task, other, date);
      if (theirs.status === 'void') continue;
      Object.assign(theirs, update, { penalty: penaltyFor(state.status) });
      await theirs.save();
      affected.add(other);
    }
  }

  await Promise.all([...affected].map((id) => refreshUserCaches(id, now)));
  syncCalendar(task, date);
  return { occurrence: occ, previousStatus, task };
}

// Fire-and-forget: the calendar is a mirror, never a reason for a mark to fail.
function syncCalendar(task, date) {
  if (!task.googleCalendarEventId) return;
  require('./googleCalendarService').syncOccurrenceToCalendar(task, date).catch(() => {});
}

async function upsertOccurrence(task, userId, date) {
  try {
    return await Occurrence.findOneAndUpdate(
      { taskId: task._id, userId, date },
      { $setOnInsert: { ...snapshot(task), weekKey: weekKeyOf(date), status: 'pending', progress: 0, penalty: 0 } },
      { upsert: true, new: true },
    );
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    return Occurrence.findOne({ taskId: task._id, userId, date });
  }
}

// ==================== CLOSING ====================

// Resolves every still-pending occurrence of a day that has passed its close
// time: some progress → missed, nothing at all → ignored.
async function closeDay(dateKey, now = new Date()) {
  if (isDayOpen(dateKey, now)) throw new Error(`${dateKey} is still open`);
  await ensureDay(dateKey, now);

  const pending = await Occurrence.find({ date: dateKey, status: 'pending' });
  for (const occ of pending) {
    occ.status = closedStatus(occ);
    occ.penalty = penaltyFor(occ.status);
    occ.source = 'system';
    occ.resolvedBy = 'system';
    occ.resolvedAt = closeInstant(dateKey);
    await occ.save();
  }
  await setMeta('lastClosedDay', dateKey);

  const taskIds = [...new Set(pending.map((o) => String(o.taskId)))];
  for (const task of await Task.find({ _id: { $in: taskIds } })) syncCalendar(task, dateKey);
  return pending;
}

// Closes every day that is due, catching up after downtime. Returns the
// occurrences that were closed as missed/ignored, for announcing.
async function closeDueDays(now = new Date()) {
  const target = latestClosableDay(now);
  // First run ever: start with the latest closable day rather than backfilling history.
  const last = (await getMeta('lastClosedDay')) || addDays(target, -1);
  let day = addDays(last, 1);
  const earliest = addDays(target, -(config.rules.maxBackfillDays - 1));
  if (day < earliest) day = earliest;

  const closed = [];
  for (; day <= target; day = addDays(day, 1)) {
    closed.push(...await closeDay(day, now));
  }
  if (closed.length) {
    await Promise.all(config.memberIds().map((id) => refreshUserCaches(id, now)));
  }
  return closed;
}

// ==================== SCORING ====================

async function weeklyXp(userId, weekKey) {
  const [occ] = await Occurrence.aggregate([
    { $match: { userId: String(userId), weekKey } },
    { $group: { _id: null, total: { $sum: '$penalty' } } },
  ]);
  const [adj] = await XpAdjustment.aggregate([
    { $match: { userId: String(userId), weekKey } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return Math.max(0, config.rules.startXp - (occ?.total || 0) - (adj?.total || 0));
}

async function excusesLeft(userId, weekKey) {
  // Only excuses this person used count; a partner excusing a pooled task does not.
  const used = await Occurrence.countDocuments({ userId: String(userId), weekKey, status: 'excused', resolvedBy: String(userId) });
  return Math.max(0, config.rules.excusesPerWeek - used);
}

// taskId → current streak, for one person.
async function streaksFor(userId, now = new Date()) {
  const since = addDays(todayKey(now), -180);
  const history = await Occurrence.find({ userId: String(userId), date: { $gte: since } })
    .select('taskId date status').lean();
  const byTask = {};
  for (const o of history) (byTask[o.taskId] ||= []).push(o);
  return Object.fromEntries(Object.entries(byTask).map(([taskId, list]) => [taskId, streakFrom(list)]));
}

// Consecutive closed days on which both members finished everything they had.
async function sharedStreak(now = new Date()) {
  const since = addDays(todayKey(now), -180);
  const rows = await Occurrence.find({ date: { $gte: since }, status: { $nin: ['void'] } })
    .select('date status').lean();
  const days = {};
  for (const o of rows) (days[o.date] ||= []).push(o.status);

  let streak = 0;
  for (const date of Object.keys(days).sort().reverse()) {
    const statuses = days[date];
    if (statuses.includes('pending')) continue; // still open
    if (statuses.some((s) => s === 'missed' || s === 'ignored')) break;
    if (statuses.includes('done')) streak++;
  }
  return streak;
}

// user.weeklyXp and user.streaks are caches of the derived values, kept so
// existing readers (website, /mystats) stay simple.
async function refreshUserCaches(userId, now = new Date()) {
  const user = await User.findOne({ telegramId: String(userId) });
  if (!user) return;
  user.weeklyXp = await weeklyXp(userId, weekKeyOf(todayKey(now)));
  user.streaks = new Map(Object.entries(await streaksFor(userId, now)));
  await user.save();
}

// ==================== WEEKS ====================

// Settles every finished week (Sunday closed) exactly once: winner levels up,
// loser owes a penalty task, a tie levels both up.
async function settleWeeks(now = new Date()) {
  const lastClosed = await getMeta('lastClosedDay');
  if (!lastClosed) return [];

  let from = await getMeta('settleFromWeek');
  if (!from) {
    // First run: never re-settle weeks the old system already handled.
    from = weekKeyOf(todayKey(now));
    await setMeta('settleFromWeek', from);
  }

  const results = [];
  for (let week = from; addDays(week, 6) <= lastClosed; week = addDays(week, 7)) {
    if (await WeekResult.exists({ weekKey: week })) continue;
    const result = await settleWeek(week);
    if (result) results.push(result);
  }
  return results;
}

async function settleWeek(weekKey) {
  const ids = config.memberIds();
  if (ids.length !== 2) return null;

  const scores = [];
  for (const id of ids) {
    scores.push({ userId: id, name: config.memberName(id), xp: await weeklyXp(id, weekKey) });
  }
  const [a, b] = scores;
  const isTie = a.xp === b.xp;
  const winner = isTie ? null : (a.xp > b.xp ? a : b);
  const loser = isTie ? null : (winner === a ? b : a);
  const reward = isTie ? null : rewards.rewards[Math.floor(Math.random() * rewards.rewards.length)];

  try {
    await WeekResult.create({
      weekKey, scores, isTie, reward, winner: winner?.userId || '', loser: loser?.userId || '',
    });
  } catch (err) {
    if (isDuplicateKey(err)) return null; // another process settled it
    throw err;
  }

  const levelUp = isTie ? ids : [winner.userId];
  await User.updateMany({ telegramId: { $in: levelUp } }, { $inc: { level: 1 } });
  if (loser) await User.updateOne({ telegramId: loser.userId }, { $push: { pendingRewards: reward } });

  return {
    weekKey,
    isTie,
    bothPerfect: a.xp === config.rules.startXp && b.xp === config.rules.startXp,
    winner: winner?.name,
    loser: loser?.name,
    winnerXp: Math.max(a.xp, b.xp),
    loserXp: Math.min(a.xp, b.xp),
    reward,
  };
}

// ==================== READING ====================

async function dayView(dateKey, now = new Date()) {
  if (isDayOpen(dateKey, now) && dateKey <= todayKey(now)) await ensureDay(dateKey, now);
  const rows = await Occurrence.find({ date: dateKey, status: { $ne: 'void' } }).sort({ time: 1, taskName: 1 }).lean();
  return config.memberIds().map((userId) => {
    const items = rows.filter((o) => o.userId === userId);
    return {
      userId,
      name: config.memberName(userId),
      done: items.filter((o) => o.status === 'done').length,
      total: items.filter((o) => o.status !== 'excused').length,
      items,
    };
  });
}

module.exports = {
  httpError,
  getMeta,
  setMeta,
  ensureDay,
  resyncTask,
  mark,
  closeDay,
  closeDueDays,
  weeklyXp,
  excusesLeft,
  streaksFor,
  sharedStreak,
  refreshUserCaches,
  settleWeeks,
  dayView,
};
