const { User, Task, Occurrence, Meta } = require('../database/models');
const config = require('../config');
const { todayKey, weekKeyOf, toDateKey } = require('../utils/time');
const occurrences = require('./occurrenceService');

// Only the two configured members are ever users; anyone else gets null.
const getOrCreateUser = async (telegramId, username) => {
  telegramId = String(telegramId);
  if (!config.isMember(telegramId)) return null;

  let user = await User.findOne({ telegramId });
  if (!user) {
    user = await User.create({
      telegramId,
      username: username || config.memberName(telegramId),
      xp: 0,
      level: 1,
      weeklyXp: config.rules.startXp,
      streaks: new Map(),
      lastCompletions: new Map(),
    });
  }
  return user;
};

// Before anything recomputes user.weeklyXp from occurrences, record the XP the
// old system left behind, once, so the migration can carry this week over
// exactly even if the new code started running before the migration did.
const snapshotLegacyXp = async () => {
  if (await Meta.exists({ key: 'legacyWeeklyXp' })) return;
  const users = await User.find({ telegramId: { $in: config.memberIds() } });
  const takenAt = new Date();
  // The old system's weeks turned over at Monday closeHour, not midnight.
  const week = weekKeyOf(toDateKey(new Date(takenAt - config.rules.closeHour * 3600000)));
  const xp = Object.fromEntries(users.map((u) => [u.telegramId, u.weeklyXp]));
  await Meta.updateOne(
    { key: 'legacyWeeklyXp' },
    { $setOnInsert: { value: { takenAt, week, xp } } },
    { upsert: true },
  );
};

const ensureMembers = async () => {
  await snapshotLegacyXp();
  await Promise.all(config.memberIds().map((id) => getOrCreateUser(id, config.memberName(id))));
};

const getUserStats = async (userId) => {
  const user = await User.findOne({ telegramId: String(userId) });
  if (!user) return null;

  const week = weekKeyOf(todayKey());
  const [weeklyXp, excusesLeft, totalTasksCompleted, streakMap] = await Promise.all([
    occurrences.weeklyXp(userId, week),
    occurrences.excusesLeft(userId, week),
    Occurrence.countDocuments({ userId: String(userId), status: 'done' }),
    occurrences.streaksFor(userId),
  ]);

  const activeStreaks = {};
  const ids = Object.keys(streakMap).filter((id) => streakMap[id] > 0);
  const tasks = await Task.find({ _id: { $in: ids }, active: true }).select('name');
  for (const t of tasks) activeStreaks[t.name] = streakMap[String(t._id)];

  return {
    username: user.username,
    level: user.level,
    weeklyXp,
    excusesLeft,
    totalTasksCompleted,
    activeStreaks,
    pendingRewards: user.pendingRewards || [],
  };
};

const getLeaderboard = async () => {
  const week = weekKeyOf(todayKey());
  const users = await User.find({ telegramId: { $in: config.memberIds() } });
  const rows = await Promise.all(users.map(async (u) => ({
    username: u.username,
    level: u.level,
    weeklyXp: await occurrences.weeklyXp(u.telegramId, week),
  })));
  return rows.sort((a, b) => b.weeklyXp - a.weeklyXp || b.level - a.level);
};

module.exports = {
  getOrCreateUser,
  ensureMembers,
  getUserStats,
  getLeaderboard,
};
