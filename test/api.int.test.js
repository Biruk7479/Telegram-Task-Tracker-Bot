// API tests against a real MongoDB; skipped unless TEST_MONGODB_URI is set.
const { ZEN, LILY } = require('./helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const skip = !process.env.TEST_MONGODB_URI && 'TEST_MONGODB_URI not set';

test('api', { skip }, async (t) => {
  process.env.MONGODB_URI = process.env.TEST_MONGODB_URI.replace(/\/[^/]*$/, '/duo_api_test');
  const models = require('../bot/database/models');
  const app = require('../bot/api/server'); // connects and creates both members on load
  const server = app.listen(0);
  t.after(async () => { server.close(); await mongoose.disconnect(); });
  const base = `http://127.0.0.1:${server.address().port}`;

  while (mongoose.connection.readyState !== 1) await new Promise((r) => setTimeout(r, 50));
  const otherModels = Object.values(models).filter((m) => m !== models.User);
  await Promise.all(otherModels.map((m) => m.deleteMany({})));
  await Promise.all(Object.values(models).map((m) => m.syncIndexes()));
  await models.User.deleteMany({ telegramId: { $nin: [ZEN, LILY] } });
  for (const [telegramId, username] of [[ZEN, 'Zen'], [LILY, 'Lily']]) {
    await models.User.updateOne({ telegramId }, { $set: { username, level: 1, weeklyXp: 100 } }, { upsert: true });
  }

  const call = async (method, path, body, token) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
      body: body && JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  // One login per member for the whole file: the route allows 10 attempts per 15 minutes.
  const sessions = {};
  const login = async (password) => (sessions[password] ||= (await call('POST', '/api/auth/login', { password })).body);

  await t.test('login gives each member their own token', async () => {
    assert.equal((await call('POST', '/api/auth/login', { password: 'nope' })).status, 401);
    const zen = await login('zen-pass');
    assert.equal(zen.user.telegramId, ZEN);
    assert.equal((await call('GET', '/api/auth/me', null, zen.token)).body.name, 'Zen');
  });

  let taskId;
  await t.test('writes require a token; reads stay public', async () => {
    // startDate pins it to today regardless of what time the test runs.
    const startDate = require('../bot/utils/time').todayKey();
    const task = { name: 'Job applications', type: 'daily', schedule: { time: '20:00' }, assignedTo: [ZEN, LILY], target: 2, unit: 'apps', startDate };
    assert.equal((await call('POST', '/api/tasks', task)).status, 401);
    assert.equal((await call('POST', '/api/tasks', task, 'forged.token')).status, 401);

    const { token } = await login('zen-pass');
    const created = await call('POST', '/api/tasks', task, token);
    assert.equal(created.status, 201);
    assert.equal(created.body.createdBy, ZEN, 'creator comes from the token, not the body');
    assert.equal(created.body.target, 2);
    taskId = created.body._id;
    assert.equal((await call('GET', '/api/tasks')).body.length, 1);
  });

  await t.test('rejects invalid input', async () => {
    const { token } = await login('zen-pass');
    assert.equal((await call('POST', '/api/tasks', { name: 'x', type: 'weekly', schedule: { time: '9:00' } }, token)).status, 400);
    assert.equal((await call('POST', '/api/tasks', { name: 'x', type: 'daily', assignedTo: ['999'] }, token)).status, 400);
    assert.equal((await call('POST', '/api/occurrences/mark', { taskId, action: 'explode' }, token)).status, 400);
  });

  await t.test('you can only mark your own tasks', async () => {
    const { token } = await login('lily-pass');
    const res = await call('POST', `/api/tasks/${taskId}/complete`, { userId: ZEN, completed: true }, token);
    assert.equal(res.status, 403);
  });

  await t.test('counter progress shows up on the board for both members', async () => {
    const { token } = await login('lily-pass');
    const res = await call('POST', '/api/occurrences/mark', { taskId, action: 'progress' }, token);
    assert.equal(res.status, 200);
    assert.equal(res.body.occurrence.progress, 1);
    assert.equal(res.body.occurrence.status, 'pending');

    const board = (await call('GET', '/api/board')).body;
    assert.equal(board.members.length, 2);
    const lily = board.members.find((m) => m.userId === LILY);
    assert.equal(lily.items[0].progress, 1);
    assert.equal(lily.weeklyXp, 100);
    assert.equal(lily.excusesLeft, 2);
    assert.ok(Array.isArray(board.feed) && Array.isArray(board.goals) && Array.isArray(board.deadlines));
    assert.equal(board.weekDays.length, 7);
    const todayRow = board.weekDays.find((d) => d.date === board.today);
    assert.equal(todayRow.members[LILY].state, 'open');
    assert.equal(todayRow.members[LILY].total, 1);
  });

  await t.test('goals take contributions from either member', async () => {
    const goal = await models.Goal.create({ name: 'Savings (combined)', target: 50000, unit: 'ETB' });
    const zen = await login('zen-pass');
    const lily = await login('lily-pass');
    await call('POST', `/api/goals/${goal._id}/contribute`, { amount: 1500 }, zen.token);
    const res = await call('POST', `/api/goals/${goal._id}/contribute`, { amount: 500, note: 'tips' }, lily.token);
    assert.equal(res.body.current, 2000);
    assert.equal(res.body.byMember[ZEN], 1500);
    assert.equal(res.body.percent, 4);
  });

  await t.test('range summarizes days for both members', async () => {
    const today = require('../bot/utils/time').todayKey();
    const res = await call('GET', `/api/range?from=${today}&to=${today}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.days[0].members[ZEN].total, 1);
    assert.equal((await call('GET', '/api/range?from=2026-01-01&to=2026-06-01')).status, 400);
  });

  await t.test('the plan can be replaced as a whole, by a member only', async () => {
    const plan = [
      { owner: 'li', area: 'FloLabs', items: ['IoT', 'Humanoid'] },
      { owner: 'lizen', area: 'Bible study', items: ['1 chapter a day', 'Church (every Sunday)'] },
      { owner: 'zen', area: 'PMS', items: [] },
    ];
    assert.equal((await call('PUT', '/api/structure', plan)).status, 401);
    const { token } = await login('lily-pass');
    assert.equal((await call('PUT', '/api/structure', [{ owner: 'nobody', area: 'x' }], token)).status, 400);
    assert.equal((await call('PUT', '/api/structure', [{ owner: 'li', area: '' }], token)).status, 400);
    assert.equal((await call('PUT', '/api/structure', [], token)).status, 400);

    const put = await call('PUT', '/api/structure', plan, token);
    assert.equal(put.status, 200);
    assert.equal(put.body.length, 3);
    const got = (await call('GET', '/api/structure')).body;
    assert.deepEqual(got.map((a) => [a.owner, a.area, a.items]), [
      ['li', 'FloLabs', ['IoT', 'Humanoid']],
      ['lizen', 'Bible study', ['1 chapter a day', 'Church (every Sunday)']],
      ['zen', 'PMS', []],
    ]);

    // Sending it again replaces rather than piles up.
    await call('PUT', '/api/structure', plan.slice(0, 1), token);
    assert.equal((await call('GET', '/api/structure')).body.length, 1);
  });

  await t.test('opportunities: shared, validated, and only an assignee edits', async () => {
    const lily = (await login('lily-pass')).token;
    const zen = (await login('zen-pass')).token;
    const today = require('../bot/utils/time').todayKey();
    const body = {
      name: 'DAAD scholarship', organisation: 'DAAD', category: 'Scholarship', deadline: today,
      deadlineTime: '23:59', applyOn: today, requirements: ['CV', { text: 'Transcript', done: true }, '  '],
    };
    assert.equal((await call('POST', '/api/opportunities', body)).status, 401);
    assert.equal((await call('POST', '/api/opportunities', { ...body, deadline: 'soon' }, lily)).status, 400);
    assert.equal((await call('POST', '/api/opportunities', { ...body, status: 'Maybe' }, lily)).status, 400);
    assert.equal((await call('POST', '/api/opportunities', { name: '' }, lily)).status, 400);

    const created = await call('POST', '/api/opportunities', body, lily);
    assert.equal(created.status, 201);
    assert.deepEqual(created.body.assignedTo, [LILY], 'defaults to the caller');
    assert.equal(created.body.createdBy, LILY);
    assert.deepEqual(created.body.requirements.map((r) => [r.text, r.done]), [['CV', false], ['Transcript', true]]);
    const id = created.body._id;

    const list = (await call('GET', '/api/opportunities')).body;
    assert.equal(list.length, 1, 'reads are public');

    // Zen is not an assignee: cannot edit, delete or tick.
    assert.equal((await call('PUT', `/api/opportunities/${id}`, { notes: 'x' }, zen)).status, 403);
    assert.equal((await call('POST', `/api/opportunities/${id}/requirements/0`, { done: true }, zen)).status, 403);

    const ticked = await call('POST', `/api/opportunities/${id}/requirements/0`, { done: true }, lily);
    assert.equal(ticked.status, 200);
    assert.equal(ticked.body.requirements[0].done, true);
    assert.equal((await call('POST', `/api/opportunities/${id}/requirements/9`, { done: true }, lily)).status, 400);

    const applied = await call('PUT', `/api/opportunities/${id}`, { status: 'Applied', assignedTo: [LILY, ZEN] }, lily);
    assert.equal(applied.status, 200);
    assert.equal(applied.body.appliedOn, today, 'Applied stamps the day');
    assert.equal((await call('PUT', `/api/opportunities/${id}`, { notes: 'now shared' }, zen)).status, 200);

    // Open ones within two weeks ride along on the board's deadlines.
    const open = await call('POST', '/api/opportunities', { name: 'Hackathon', category: 'Competition', deadline: today }, zen);
    const board = (await call('GET', '/api/board')).body;
    const onBoard = board.deadlines.find((d) => d.kind === 'opportunity' && d.name === 'Hackathon');
    assert.ok(onBoard, 'opportunity deadline on the board');
    assert.equal(onBoard.daysLeft, 0);
    assert.ok(!board.deadlines.some((d) => d.name === 'DAAD scholarship'), 'applied ones are not deadlines any more');

    assert.equal((await call('DELETE', `/api/opportunities/${open.body._id}`, null, zen)).status, 200);
    assert.equal((await call('GET', '/api/opportunities')).body.length, 1, 'deleted ones disappear');
    assert.equal((await call('PUT', `/api/opportunities/${open.body._id}`, { notes: 'x' }, zen)).status, 404);
  });

  await t.test('calendar keeps the shape the website reads, plus status', async () => {
    const [year, month] = require('../bot/utils/time').todayKey().split('-').map(Number);
    const res = await call('GET', `/api/calendar/${LILY}?year=${year}&month=${month}`);
    assert.equal(res.status, 200);
    const day = res.body.find((d) => d.scheduledTasks.length);
    assert.ok(day, 'today has the task');
    assert.ok('completed' in day.scheduledTasks[0] && 'status' in day.scheduledTasks[0]);
  });
});
