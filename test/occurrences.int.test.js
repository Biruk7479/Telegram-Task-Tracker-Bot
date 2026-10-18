// Integration tests against a real MongoDB. Skipped unless TEST_MONGODB_URI is set:
//   docker run -d --rm --name duo-test-mongo -p 127.0.0.1:27099:27017 mongo:7
//   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/duo_test npm test
const { at, ZEN, LILY } = require('./helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const skip = !process.env.TEST_MONGODB_URI && 'TEST_MONGODB_URI not set';

const models = require('../bot/database/models');
const { Task, User, Occurrence, WeekResult, Meta } = models;
const occ = require('../bot/services/occurrenceService');

// Monday 2026-10-12 … Sunday 2026-10-18
const MON = '2026-10-12';
const TUE = '2026-10-13';
const SUN = '2026-10-18';

const makeTask = (over = {}) => Task.create({
  name: 'Bible', type: 'daily', schedule: { time: '21:00' }, createdBy: ZEN,
  assignedTo: [ZEN, LILY], createdAt: at('2026-10-01'), ...over,
});

const get = (taskId, userId, date) => Occurrence.findOne({ taskId, userId, date }).lean();

test('occurrences', { skip }, async (t) => {
  await mongoose.connect(process.env.TEST_MONGODB_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(models).map((m) => m.syncIndexes()));
  await User.create([{ telegramId: ZEN, username: 'Zen' }, { telegramId: LILY, username: 'Lily' }]);

  t.after(() => mongoose.disconnect());
  t.beforeEach(async () => {
    await Promise.all([Task, Occurrence, WeekResult, Meta, models.XpAdjustment].map((m) => m.deleteMany({})));
    await User.updateMany({}, { level: 1, pendingRewards: [] });
  });

  await t.test('ensureDay is idempotent: one row per task, person and day', async () => {
    const task = await makeTask();
    await occ.ensureDay(MON, at(MON));
    await occ.ensureDay(MON, at(MON));
    assert.equal(await Occurrence.countDocuments({ taskId: task._id }), 2);
  });

  await t.test('double taps are harmless and switching an answer refunds the XP', async () => {
    const task = await makeTask();
    const now = at(MON, '21:05');
    await occ.mark({ taskId: task._id, userId: ZEN, date: MON, action: 'missed', now });
    await occ.mark({ taskId: task._id, userId: ZEN, date: MON, action: 'missed', now });
    assert.equal(await occ.weeklyXp(ZEN, MON), 90);
    assert.equal(await Occurrence.countDocuments({ taskId: task._id, userId: ZEN }), 1);

    await occ.mark({ taskId: task._id, userId: ZEN, date: MON, action: 'done', now });
    assert.equal(await occ.weeklyXp(ZEN, MON), 100);
    assert.equal((await User.findOne({ telegramId: ZEN })).weeklyXp, 100, 'cache refreshed');
  });

  await t.test('closing: ignored costs more than an honest No; partial counters are missed', async () => {
    const bible = await makeTask();
    const jobs = await makeTask({ name: 'Job apps', target: 2, unit: 'apps' });
    await occ.ensureDay(MON, at(MON, '08:00'));
    await occ.mark({ taskId: bible._id, userId: ZEN, date: MON, action: 'done', now: at(MON, '21:00') });
    await occ.mark({ taskId: jobs._id, userId: ZEN, date: MON, action: 'progress', now: at(MON, '20:00') });

    const closed = await occ.closeDay(MON, at(TUE, '06:00'));
    assert.equal(closed.length, 3); // Zen jobs, Lily bible, Lily jobs
    assert.equal((await get(jobs._id, ZEN, MON)).status, 'missed');
    assert.equal((await get(bible._id, LILY, MON)).status, 'ignored');
    assert.equal(await occ.weeklyXp(ZEN, MON), 90);
    assert.equal(await occ.weeklyXp(LILY, MON), 70);
  });

  await t.test('a closed day cannot be changed; yesterday stays open until 06:00', async () => {
    const task = await makeTask();
    await occ.mark({ taskId: task._id, userId: ZEN, date: MON, action: 'done', now: at(TUE, '05:30') });
    await assert.rejects(
      occ.mark({ taskId: task._id, userId: LILY, date: MON, action: 'done', now: at(TUE, '06:01') }),
      { status: 409 },
    );
  });

  await t.test('days the server was down are void, not penalized', async () => {
    const task = await makeTask();
    await Meta.create({ key: 'lastClosedDay', value: '2026-10-10' });
    // Server comes back Tuesday 10:00: Sunday 11th and Monday 12th close with nothing generated.
    await occ.closeDueDays(at(TUE, '10:00'));
    const rows = await Occurrence.find({ taskId: task._id }).lean();
    assert.equal(rows.length, 4);
    assert.ok(rows.every((r) => r.status === 'void' && r.penalty === 0));
    assert.equal(await occ.getMeta('lastClosedDay'), MON);
  });

  await t.test('excuses: 0 XP, limited per week, and only your own count', async () => {
    const a = await makeTask({ name: 'A', mode: 'pooled' });
    const b = await makeTask({ name: 'B' });
    const c = await makeTask({ name: 'C' });
    const now = at(MON, '09:00');
    await occ.mark({ taskId: a._id, userId: LILY, date: MON, action: 'excused', now }); // pooled, Lily's excuse
    assert.equal(await occ.excusesLeft(ZEN, MON), 2, "Lily's pooled excuse does not use Zen's");
    await occ.mark({ taskId: b._id, userId: ZEN, date: MON, action: 'excused', now });
    await occ.mark({ taskId: c._id, userId: ZEN, date: MON, action: 'excused', now });
    await assert.rejects(
      occ.mark({ taskId: b._id, userId: ZEN, date: TUE, action: 'excused', now: at(TUE) }),
      { status: 409 },
    );
    assert.equal(await occ.weeklyXp(ZEN, MON), 100);
  });

  await t.test('pooled tasks share one result', async () => {
    const task = await makeTask({ name: 'AAR event', mode: 'pooled' });
    await occ.mark({ taskId: task._id, userId: LILY, date: MON, action: 'done', now: at(MON) });
    assert.equal((await get(task._id, ZEN, MON)).status, 'done');
    assert.equal((await get(task._id, ZEN, MON)).resolvedBy, LILY);
  });

  await t.test('deleting a task voids its open occurrences and keeps history', async () => {
    const task = await makeTask();
    await occ.ensureDay(MON, at(MON));
    await occ.mark({ taskId: task._id, userId: ZEN, date: MON, action: 'done', now: at(MON) });
    task.active = false;
    await task.save();
    await occ.resyncTask(task, at(MON, '10:00'));
    assert.equal((await get(task._id, ZEN, MON)).status, 'done', 'history kept');
    assert.equal((await get(task._id, LILY, MON)).status, 'void', 'not penalized at close');
  });

  await t.test('rescheduling voids days the task no longer falls on', async () => {
    const task = await makeTask();
    await occ.ensureDay(MON, at(MON, '08:00'));
    task.type = 'weekly';
    task.schedule = { time: '21:00', days: [3] }; // Wednesdays only
    await task.save();
    await occ.resyncTask(task, at(MON, '09:00'));
    assert.equal((await get(task._id, ZEN, MON)).status, 'void');
  });

  await t.test('a week settles exactly once, after Sunday closes', async () => {
    const task = await makeTask();
    await Meta.create([{ key: 'settleFromWeek', value: MON }, { key: 'lastClosedDay', value: '2026-10-11' }]);
    for (let d = MON; d <= SUN; d = require('../bot/utils/time').addDays(d, 1)) {
      await occ.ensureDay(d, at(d, '00:01')); // the scheduler's midnight tick
      await occ.mark({ taskId: task._id, userId: ZEN, date: d, action: 'done', now: at(d) });
    }
    // Lily answers nothing all week.
    await occ.closeDueDays(at(SUN, '23:00'));
    assert.deepEqual(await occ.settleWeeks(at(SUN, '23:00')), [], 'Sunday still open');

    const monday = at('2026-10-19', '06:00');
    await occ.closeDueDays(monday);
    const [result] = await occ.settleWeeks(monday);
    assert.equal(result.winner, 'Zen');
    assert.equal(result.loserXp, 0); // 7 × -15, floored at 0
    assert.deepEqual(await occ.settleWeeks(monday), [], 'never twice');
    assert.equal((await User.findOne({ telegramId: ZEN })).level, 2);
    assert.equal((await User.findOne({ telegramId: LILY })).pendingRewards.length, 1);
  });

  await t.test('marking requires membership and assignment', async () => {
    const task = await makeTask({ assignedTo: [ZEN] });
    await assert.rejects(occ.mark({ taskId: task._id, userId: LILY, date: MON, action: 'done', now: at(MON) }), { status: 403 });
    await assert.rejects(occ.mark({ taskId: task._id, userId: '999', date: MON, action: 'done', now: at(MON) }), { status: 403 });
  });
});
