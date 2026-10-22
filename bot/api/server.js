const express = require('express');
const cors = require('cors');
const connectDB = require('../database/connection');
const { User, Task, Completion, Occurrence, Goal, Structure, WeekResult } = require('../database/models');
const config = require('../config');
const { signToken, checkPassword, loginLimiter, requireAuth } = require('./auth');
const occurrences = require('../services/occurrenceService');
const taskService = require('../services/taskService');
const { ensureMembers } = require('../services/userService');
const { isScheduledOn, assigneesOf } = require('../services/schedule');
const {
  todayKey, addDays, weekKeyOf, isDateKey, isDayOpen, closeInstant, localParts, daysBetween, toDateKey,
} = require('../utils/time');

const app = express();
const router = express.Router();

// Get base path from environment or default to empty string
const BASE_PATH = process.env.BASE_PATH || '';

// Middleware. Writes need a bearer token, so open CORS does not expose them.
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Connect to database
connectDB().then(ensureMembers).catch((err) => console.error('Startup error:', err));

// Wraps async handlers so thrown errors (with .status) become JSON responses.
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (!error.status || error.status >= 500) console.error(`${req.method} ${req.path}:`, error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Internal server error' });
  }
};

const VALID_TYPES = ['daily', 'weekly', 'custom', 'one-time', 'flexible'];

const VALID_ACTIONS = ['done', 'missed', 'excused', 'undo', 'progress'];

const badRequest = (message) => occurrences.httpError(400, message);

// API Routes

// Root route for health check
router.get('/', (req, res) => {
  res.send('Telegram Task Tracker API is running');
});

router.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), today: todayKey() });
});

// ==================== AUTH ====================

// Each member logs in with their own password and gets a 90-day token.
router.post('/api/auth/login', loginLimiter, handle(async (req, res) => {
  const member = checkPassword(req.body?.password);
  if (!member) return res.status(401).json({ error: 'Wrong password' });
  res.json({ token: signToken(member.id), user: { telegramId: member.id, name: member.name } });
}));

router.get('/api/auth/me', requireAuth, handle(async (req, res) => {
  res.json({ telegramId: req.userId, name: config.memberName(req.userId) });
}));

// ==================== USERS ====================

router.get('/api/users', handle(async (req, res) => {
  res.json(await User.find({ telegramId: { $in: config.memberIds() } }));
}));

router.get('/api/users/:telegramId', handle(async (req, res) => {
  const user = await User.findOne({ telegramId: req.params.telegramId });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
}));

// ==================== BOARD (everything on one screen) ====================

// One call with everything the Board screen and the widgets need.
router.get('/api/board', handle(async (req, res) => {
  const now = new Date();
  const today = todayKey(now);
  const week = weekKeyOf(today);
  const yesterday = addDays(today, -1);

  const [day, users, goals, feed, lastWeek, sharedStreak, upcoming, weekDays] = await Promise.all([
    occurrences.dayView(today, now),
    User.find({ telegramId: { $in: config.memberIds() } }),
    Goal.find({ active: true }).lean(),
    Occurrence.find({ resolvedAt: { $ne: null }, status: { $in: ['done', 'missed', 'ignored', 'excused'] } })
      .sort({ resolvedAt: -1 }).limit(15).lean(),
    WeekResult.findOne().sort({ weekKey: -1 }).lean(),
    occurrences.sharedStreak(now),
    Task.find({ active: true, type: 'one-time', 'schedule.date': { $gte: new Date(`${today}T00:00:00Z`) } }).lean(),
    occurrences.daySummaries(week, addDays(week, 6), now),
  ]);

  // Yesterday stays answerable until it closes; surface what is still pending.
  const yesterdayOpen = isDayOpen(yesterday, now);
  const stillOpen = yesterdayOpen
    ? await Occurrence.find({ date: yesterday, status: 'pending' }).lean()
    : [];

  const members = await Promise.all(day.map(async (d) => {
    const user = users.find((u) => u.telegramId === d.userId);
    const streaks = await occurrences.streaksFor(d.userId, now);
    const best = Object.entries(streaks).sort((a, b) => b[1] - a[1])[0];
    return {
      ...d,
      level: user?.level || 1,
      weeklyXp: await occurrences.weeklyXp(d.userId, week),
      excusesLeft: await occurrences.excusesLeft(d.userId, week),
      pendingRewards: user?.pendingRewards || [],
      topStreak: best ? { taskId: best[0], days: best[1] } : null,
      yesterdayPending: stillOpen.filter((o) => o.userId === d.userId),
    };
  }));

  const deadlines = upcoming
    .map((t) => ({
      taskId: t._id, name: t.name, area: t.area, date: toDateKey(t.schedule.date), time: t.schedule.time,
      assignedTo: assigneesOf(t),
    }))
    .filter((t) => t.date >= today && daysBetween(today, t.date) <= 14)
    .map((t) => ({ ...t, daysLeft: daysBetween(today, t.date) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  res.json({
    today,
    now: localParts(now).time,
    weekKey: week,
    daysLeftInWeek: 6 - daysBetween(week, today),
    rules: config.rules,
    members,
    sharedStreak,
    goals: goals.map(goalView),
    deadlines,
    feed: feed.map((o) => ({ ...o, name: config.memberName(o.userId) })),
    lastWeek,
    weekDays,
    yesterdayClosesAt: yesterdayOpen ? closeInstant(yesterday) : null,
  });
}));

// Both members' occurrences for a day (defaults to today).
router.get('/api/day', handle(async (req, res) => {
  const date = req.query.date || todayKey();
  if (!isDateKey(date)) throw badRequest('date must be YYYY-MM-DD');
  res.json({ date, open: isDayOpen(date), members: await occurrences.dayView(date) });
}));

// Per-day summary for both members over a range (max 62 days), for calendars and widgets.
router.get('/api/range', handle(async (req, res) => {
  const { from, to } = req.query;
  if (!isDateKey(from) || !isDateKey(to) || to < from) throw badRequest('from and to must be YYYY-MM-DD, from <= to');
  if (daysBetween(from, to) > 61) throw badRequest('range is limited to 62 days');
  res.json({
    today: todayKey(),
    members: config.memberIds().map((id) => ({ userId: id, name: config.memberName(id) })),
    days: await occurrences.daySummaries(from, to),
  });
}));

// A week's score for both members, with every penalty listed.
router.get('/api/week', handle(async (req, res) => {
  const week = weekKeyOf(req.query.week || todayKey());
  const penalties = await Occurrence.find({ weekKey: week, penalty: { $gt: 0 } }).sort({ date: 1 }).lean();
  const members = await Promise.all(config.memberIds().map(async (userId) => ({
    userId,
    name: config.memberName(userId),
    xp: await occurrences.weeklyXp(userId, week),
    excusesLeft: await occurrences.excusesLeft(userId, week),
    penalties: penalties.filter((p) => p.userId === userId),
  })));
  res.json({ weekKey: week, result: await WeekResult.findOne({ weekKey: week }).lean(), members });
}));

// ==================== MARKING ====================

// The one write path for done / missed / excused / undo / +n.
router.post('/api/occurrences/mark', requireAuth, handle(async (req, res) => {
  const { taskId, date, action, amount } = req.body || {};
  if (!taskId) throw badRequest('taskId is required');
  if (!VALID_ACTIONS.includes(action)) throw badRequest(`action must be one of ${VALID_ACTIONS.join(', ')}`);
  if (date && !isDateKey(date)) throw badRequest('date must be YYYY-MM-DD');

  const result = await occurrences.mark({
    taskId, userId: req.userId, date, action, amount, source: req.get('X-Client') || 'api',
  });
  res.json({ occurrence: result.occurrence, previousStatus: result.previousStatus });
}));

// Legacy endpoint used by the website's buttons.
router.post('/api/tasks/:taskId/complete', requireAuth, handle(async (req, res) => {
  const { userId, completed, scheduledFor } = req.body || {};
  if (userId && String(userId) !== req.userId) throw occurrences.httpError(403, 'You can only mark your own tasks');
  const date = isDateKey(scheduledFor) ? scheduledFor : undefined;

  const result = await occurrences.mark({
    taskId: req.params.taskId, userId: req.userId, date, action: completed ? 'done' : 'missed', source: 'web',
  });
  res.status(201).json(result.occurrence);
}));

// ==================== TASKS ====================

router.get('/api/tasks', handle(async (req, res) => {
  res.json(await Task.find({ active: true }));
}));

router.get('/api/tasks/:taskId', handle(async (req, res) => {
  const task = await Task.findById(req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
}));

router.post('/api/tasks', requireAuth, handle(async (req, res) => {
  const { name, description, type, schedule, assignedTo, xpReward, ...extra } = req.body || {};
  if (!name || !type) throw badRequest('Missing required fields: name, type');
  if (!VALID_TYPES.includes(type)) throw badRequest('Invalid task type');
  validateSchedule(type, schedule);
  const assignees = (assignedTo || [req.userId]).map(String);
  if (!assignees.every(config.isMember)) throw badRequest('assignedTo must only contain members');

  const task = await taskService.createTask(
    name, description || '', type, schedule || {}, req.userId, xpReward || 10, assignees, extra,
  );
  res.status(201).json(task);
}));

router.put('/api/tasks/:taskId', requireAuth, handle(async (req, res) => {
  const updates = req.body || {};
  if (updates.assignedTo && !updates.assignedTo.map(String).every(config.isMember)) {
    throw badRequest('assignedTo must only contain members');
  }
  const existing = await Task.findById(req.params.taskId);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  if (updates.schedule) validateSchedule(existing.type, { ...existing.schedule?.toObject?.(), ...updates.schedule });

  const task = await taskService.updateTask(req.params.taskId, updates);

  try {
    const { updateCalendarEvent } = require('../services/googleCalendarService');
    if (task.googleCalendarEventId) {
      await updateCalendarEvent(task.googleCalendarEventId, req.userId, {
        summary: task.name,
        description: task.description,
      });
    }
  } catch (calendarError) {
    console.error('Failed to update calendar event:', calendarError);
  }

  res.json(task);
}));

// Soft delete: history stays, today's and future pending occurrences are voided.
router.delete('/api/tasks/:taskId', requireAuth, handle(async (req, res) => {
  const task = await taskService.deleteTask(req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  try {
    const { deleteCalendarEvent } = require('../services/googleCalendarService');
    if (task.googleCalendarEventId) await deleteCalendarEvent(task.googleCalendarEventId, req.userId);
  } catch (calendarError) {
    console.error('Failed to delete calendar event:', calendarError);
  }

  res.json({ success: true, message: 'Task deleted successfully' });
}));

function validateSchedule(type, schedule = {}) {
  if (schedule.time && !/^\d{1,2}:\d{2}$/.test(schedule.time)) throw badRequest('schedule.time must be HH:MM');
  if ((type === 'weekly' || type === 'custom')
    && (!Array.isArray(schedule.days) || !schedule.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6))) {
    throw badRequest('schedule.days must be a list of weekdays 0-6');
  }
  if (type === 'one-time' && !schedule.date) throw badRequest('schedule.date is required for one-time tasks');
}

// ==================== GOALS & STRUCTURE ====================

const goalView = (g) => {
  const current = (g.contributions || []).reduce((sum, c) => sum + (c.amount || 0), 0);
  const byMember = Object.fromEntries(config.memberIds().map((id) => [
    id, (g.contributions || []).filter((c) => c.userId === id).reduce((s, c) => s + c.amount, 0),
  ]));
  return {
    _id: g._id, name: g.name, target: g.target, unit: g.unit, owner: g.owner, area: g.area,
    current, byMember, percent: g.target ? Math.min(100, Math.round((current / g.target) * 100)) : 0,
    recent: (g.contributions || []).slice(-5).reverse(),
  };
};

router.get('/api/goals', handle(async (req, res) => {
  res.json((await Goal.find({ active: true }).lean()).map(goalView));
}));

router.post('/api/goals/:goalId/contribute', requireAuth, handle(async (req, res) => {
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount === 0) throw badRequest('amount must be a non-zero number');
  const goal = await Goal.findByIdAndUpdate(
    req.params.goalId,
    { $push: { contributions: { userId: req.userId, amount, note: String(req.body?.note || '') } } },
    { new: true },
  ).lean();
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  res.json(goalView(goal));
}));

router.get('/api/structure', handle(async (req, res) => {
  res.json(await Structure.find().sort({ owner: 1, sort: 1 }).lean());
}));

// Replace the whole plan: [{ owner, area, items }], in the order given. The
// tracker's Settings page sends this; the website and the app read it back.
const OWNERS = ['li', 'zen', 'lizen'];
router.put('/api/structure', requireAuth, handle(async (req, res) => {
  const rows = Array.isArray(req.body) ? req.body : req.body?.areas;
  if (!Array.isArray(rows) || rows.length === 0) throw badRequest('a non-empty list of areas is required');
  const clean = rows.map((r, i) => ({
    owner: String(r?.owner || '').toLowerCase(),
    area: String(r?.area || '').trim(),
    items: Array.isArray(r?.items) ? r.items.map((x) => String(x).trim()).filter(Boolean) : [],
    sort: i,
  }));
  for (const r of clean) {
    if (!OWNERS.includes(r.owner)) throw badRequest(`owner must be one of ${OWNERS.join(', ')}`);
    if (!r.area) throw badRequest('every area needs a name');
  }
  const seen = new Set();
  for (const r of clean) {
    const key = `${r.owner}:${r.area.toLowerCase()}`;
    if (seen.has(key)) throw badRequest(`duplicate area: ${r.area}`);
    seen.add(key);
  }
  await Structure.deleteMany({});
  await Structure.insertMany(clean);
  res.json(await Structure.find().sort({ owner: 1, sort: 1 }).lean());
}));

// ==================== CALENDAR & HISTORY ====================

const calendarEntry = (o) => ({
  _id: String(o.taskId),
  name: o.taskName,
  time: o.time,
  xpReward: 0,
  status: o.status,
  progress: o.progress,
  target: o.target,
  penalty: o.penalty,
  completed: o.status === 'done' ? true : (o.status === 'missed' || o.status === 'ignored') ? false : null,
  missedConfirmation: o.status === 'ignored',
});

// Past days come from frozen occurrences; future days are projected from the
// current schedule.
router.get('/api/calendar/:telegramId', handle(async (req, res) => {
  const { telegramId } = req.params;
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  if (!year || !month || month < 1 || month > 12) throw badRequest('year and month are required');

  const pad = (n) => String(n).padStart(2, '0');
  const first = `${year}-${pad(month)}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = `${year}-${pad(month)}-${pad(daysInMonth)}`;
  const today = todayKey();

  // Make sure the open days (today, and yesterday until it closes) exist.
  for (const d of [addDays(today, -1), today]) {
    if (d >= first && d <= last && isDayOpen(d)) await occurrences.ensureDay(d);
  }

  const [rows, tasks] = await Promise.all([
    Occurrence.find({ userId: telegramId, date: { $gte: first, $lte: last }, status: { $ne: 'void' } })
      .sort({ time: 1 }).lean(),
    Task.find({ active: true, assignedTo: telegramId }).lean(),
  ]);

  const days = [];
  for (let n = 1; n <= daysInMonth; n++) {
    const date = `${year}-${pad(month)}-${pad(n)}`;
    const own = rows.filter((o) => o.date === date);
    const scheduledTasks = own.map(calendarEntry);

    if (date > today) {
      for (const task of tasks) {
        if (!isScheduledOn(task, date) || own.some((o) => String(o.taskId) === String(task._id))) continue;
        scheduledTasks.push({
          _id: String(task._id), name: task.name, time: task.schedule?.time, xpReward: 0,
          status: 'scheduled', progress: 0, target: task.target || 1, penalty: 0,
          completed: null, missedConfirmation: false,
        });
      }
    }

    const resolved = own.filter((o) => ['done', 'missed', 'ignored'].includes(o.status));
    days.push({
      date,
      completions: resolved.map((o) => ({
        taskName: o.taskName, completed: o.status === 'done', xpEarned: -o.penalty, streakCount: 0,
      })),
      scheduledTasks,
      totalXp: -own.reduce((sum, o) => sum + (o.penalty || 0), 0),
      tasksCompleted: own.filter((o) => o.status === 'done').length,
      tasksFailed: own.filter((o) => o.status === 'missed' || o.status === 'ignored').length,
    });
  }

  res.json(days);
}));

// Legacy: raw completion records from before occurrences existed.
router.get('/api/completions', handle(async (req, res) => {
  const { userId, startDate, endDate, taskId } = req.query;
  const query = {};
  if (userId) query.userId = userId;
  if (taskId) query.taskId = taskId;
  if (startDate || endDate) {
    query.completedAt = {};
    if (startDate) query.completedAt.$gte = new Date(startDate);
    if (endDate) query.completedAt.$lte = new Date(endDate);
  }
  res.json(await Completion.find(query).populate('taskId').sort({ completedAt: -1 }));
}));

router.get('/api/stats/summary', handle(async (req, res) => {
  const users = await User.find({ telegramId: { $in: config.memberIds() } });
  res.json({
    totalUsers: users.length,
    totalTasks: await Task.countDocuments({ active: true }),
    totalCompletions: await Occurrence.countDocuments({ status: 'done' }),
    users: users.map((u) => ({ telegramId: u.telegramId, username: u.username, level: u.level, weeklyXp: u.weeklyXp })),
  });
}));

// ==================== GOOGLE CALENDAR OAUTH ====================

router.get('/api/auth/google/url', requireAuth, handle(async (req, res) => {
  const { getAuthUrl } = require('../services/googleCalendarService');
  res.json({ authUrl: getAuthUrl() });
}));

router.get('/api/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send('No authorization code provided');
    }

    const { getTokensFromCode } = require('../services/googleCalendarService');
    const tokens = await getTokensFromCode(code);

    // Display the refresh token for user to add to .env
    res.send(`
      <html>
        <head><title>Google Calendar Authorization</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px;">
          <h1>✅ Authorization Successful!</h1>
          <p>Copy this refresh token and add it to your <code>.env</code> file:</p>
          <pre style="background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto;">
USER1_GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}
          </pre>
          <p><strong>Important:</strong> Keep this token secure and don't share it publicly!</p>
          <p>After adding the token to your <code>.env</code> file, restart the bot.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    res.status(500).send('Failed to authorize. Please try again.');
  }
});

// Mount router with BASE_PATH
if (BASE_PATH) {
  console.log(`Mounting routes at BASE_PATH: ${BASE_PATH}`);
  app.use(BASE_PATH, router);
} else {
  console.log('Mounting routes at root /');
  app.use('/', router);
}

app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}` });
});

// Start server (skipped when a test imports the app)
if (require.main === module || process.env.START_API !== 'false') {
  const PORT = config.api.port;
  app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
    console.log(`Base path: ${BASE_PATH || '(root)'}`);
  });
}

module.exports = app;
