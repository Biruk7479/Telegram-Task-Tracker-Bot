// Pure rules: which days a task falls on, what a status costs, how streaks
// count. No database access here, so all of it is unit-tested directly.
const config = require('../config');
const { toDateKey, localParts, weekdayOf, normalizeTime } = require('../utils/time');

const RECURRING = ['daily', 'weekly', 'custom'];

const assigneesOf = (task) => {
  const ids = task.assignedTo && task.assignedTo.length > 0 ? task.assignedTo : [task.createdBy];
  return ids.map(String).filter(config.isMember);
};

const startKeyOf = (task) => task.startDate || (task.createdAt ? toDateKey(task.createdAt) : null);

// Whether the task produces an occurrence on dateKey. Flexible tasks never do
// (they are only recorded when someone marks them).
const isScheduledOn = (task, dateKey) => {
  if (task.type === 'flexible') return false;

  if (task.type === 'one-time') {
    return !!task.schedule?.date && toDateKey(task.schedule.date) === dateKey;
  }

  if (!RECURRING.includes(task.type)) return false;

  const start = startKeyOf(task);
  if (start && dateKey < start) return false;

  // A recurring task created after its time on its first day starts tomorrow,
  // so nobody is penalized for a reminder that fired before the task existed.
  if (start && dateKey === start && !task.startDate && task.schedule?.time && task.createdAt) {
    if (localParts(new Date(task.createdAt)).time > normalizeTime(task.schedule.time)) return false;
  }

  if (task.type === 'daily') return true;
  return Array.isArray(task.schedule?.days) && task.schedule.days.includes(weekdayOf(dateKey));
};

const penaltyFor = (status) => config.rules.penalty[status] || 0;

// What an unresolved occurrence becomes when its day closes.
const closedStatus = (occ) => (occ.progress > 0 ? 'missed' : 'ignored');

// occurrences: one task's history for one person, any order.
// Counts consecutive done days back from the latest resolved one.
// Open (pending) days are skipped; excused and void days neither add nor break.
const streakFrom = (occurrences) => {
  const sorted = [...occurrences].sort((a, b) => (a.date < b.date ? 1 : -1));
  let streak = 0;
  for (const o of sorted) {
    if (o.status === 'pending' || o.status === 'excused' || o.status === 'void') continue;
    if (o.status === 'done') streak++;
    else break;
  }
  return streak;
};

// Applies an action to an occurrence's state and returns the new state.
// action: done | missed | excused | undo | progress (amount may be negative)
const nextState = (occ, action, amount = 1) => {
  const target = occ.target || 1;
  let { progress = 0 } = occ;
  let status;

  switch (action) {
    case 'done':
      progress = Math.max(progress, target);
      status = 'done';
      break;
    case 'missed':
      status = 'missed';
      break;
    case 'excused':
      status = 'excused';
      break;
    case 'undo':
      progress = 0;
      status = 'pending';
      break;
    case 'progress':
      progress = Math.max(0, progress + Number(amount || 0));
      status = progress >= target ? 'done' : 'pending';
      break;
    default:
      throw new Error(`Unknown action: ${action}`);
  }

  return { status, progress, penalty: penaltyFor(status) };
};

module.exports = {
  RECURRING,
  assigneesOf,
  startKeyOf,
  isScheduledOn,
  penaltyFor,
  closedStatus,
  streakFrom,
  nextState,
};
