const { at, ZEN, LILY } = require('./helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const time = require('../bot/utils/time');
const { isScheduledOn, streakFrom, nextState, closedStatus, assigneesOf } = require('../bot/services/schedule');

test('day keys follow Addis Ababa, not the server clock', () => {
  // 22:30 UTC on the 17th is already 01:30 on the 18th in Addis.
  assert.equal(time.toDateKey(new Date('2026-10-17T22:30:00Z')), '2026-10-18');
  assert.equal(time.localParts(new Date('2026-10-17T22:30:00Z')).time, '01:30');
});

test('weeks run Monday to Sunday', () => {
  assert.equal(time.weekKeyOf('2026-10-18'), '2026-10-12'); // Sunday
  assert.equal(time.weekKeyOf('2026-10-19'), '2026-10-19'); // Monday
  assert.equal(time.addDays('2026-12-31', 1), '2027-01-01');
});

test('a day stays open until 06:00 the next morning', () => {
  assert.equal(time.isDayOpen('2026-10-17', at('2026-10-18', '05:59')), true);
  assert.equal(time.isDayOpen('2026-10-17', at('2026-10-18', '06:00')), false);
  assert.equal(time.latestClosableDay(at('2026-10-18', '05:59')), '2026-10-16');
  assert.equal(time.latestClosableDay(at('2026-10-18', '06:00')), '2026-10-17');
});

test('zonedInstant maps local wall-clock time to the right instant', () => {
  assert.equal(time.zonedInstant('2026-10-18', '06:00').toISOString(), '2026-10-18T03:00:00.000Z');
});

const task = (over) => ({
  type: 'daily', schedule: { time: '08:00' }, createdAt: at('2026-10-01', '07:00'), assignedTo: [ZEN, LILY], ...over,
});

test('recurring tasks start on their creation day, or the next day if created after their time', () => {
  assert.equal(isScheduledOn(task(), '2026-09-30'), false);
  assert.equal(isScheduledOn(task(), '2026-10-01'), true);
  const late = task({ createdAt: at('2026-10-01', '09:00') });
  assert.equal(isScheduledOn(late, '2026-10-01'), false);
  assert.equal(isScheduledOn(late, '2026-10-02'), true);
});

test('weekly tasks only fall on their weekdays; flexible never generates', () => {
  const mwf = task({ type: 'weekly', schedule: { time: '08:00', days: [1, 3, 5] } });
  assert.equal(isScheduledOn(mwf, '2026-10-19'), true);  // Monday
  assert.equal(isScheduledOn(mwf, '2026-10-20'), false); // Tuesday
  assert.equal(isScheduledOn(task({ type: 'flexible' }), '2026-10-19'), false);
});

test('one-time tasks fall on their date, even if created after their time that day', () => {
  const t = task({ type: 'one-time', schedule: { time: '08:00', date: new Date('2026-10-20T00:00:00Z') }, createdAt: at('2026-10-20', '10:00') });
  assert.equal(isScheduledOn(t, '2026-10-20'), true);
  assert.equal(isScheduledOn(t, '2026-10-21'), false);
});

test('only members can be assignees', () => {
  assert.deepEqual(assigneesOf({ assignedTo: [ZEN, '999'] }), [ZEN]);
  assert.deepEqual(assigneesOf({ assignedTo: [], createdBy: LILY }), [LILY]);
});

test('streaks count scheduled days, so Mon/Wed/Fri tasks can build one', () => {
  const s = (date, status) => ({ date, status });
  assert.equal(streakFrom([s('2026-10-12', 'done'), s('2026-10-14', 'done'), s('2026-10-16', 'done')]), 3);
  assert.equal(streakFrom([s('2026-10-14', 'ignored'), s('2026-10-16', 'done'), s('2026-10-19', 'pending')]), 1);
  assert.equal(streakFrom([s('2026-10-14', 'done'), s('2026-10-16', 'excused'), s('2026-10-17', 'void')]), 1);
});

test('state changes: switching an answer recomputes the penalty', () => {
  assert.deepEqual(nextState({ progress: 0, target: 1 }, 'missed'), { status: 'missed', progress: 0, penalty: 10 });
  assert.deepEqual(nextState({ progress: 0, target: 1, status: 'missed' }, 'done'), { status: 'done', progress: 1, penalty: 0 });
  assert.deepEqual(nextState({ progress: 1, target: 2 }, 'progress'), { status: 'done', progress: 2, penalty: 0 });
  assert.deepEqual(nextState({ progress: 0, target: 2 }, 'progress'), { status: 'pending', progress: 1, penalty: 0 });
  assert.deepEqual(nextState({ progress: 0, target: 1 }, 'excused'), { status: 'excused', progress: 0, penalty: 0 });
});

test('closing: nothing at all is ignored, partial progress is missed', () => {
  assert.equal(closedStatus({ progress: 0 }), 'ignored');
  assert.equal(closedStatus({ progress: 1 }), 'missed');
});
