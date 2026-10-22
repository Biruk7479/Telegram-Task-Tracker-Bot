// Loads the plan from the notebook: who owns which area (Li, Zen, or shared
// "Lizen"), the recurring tasks with clear targets, and the shared savings goal.
//
//   node bot/scripts/seedNotebook.js            # dry run
//   node bot/scripts/seedNotebook.js --apply    # writes
//
// Idempotent: areas are upserted, and tasks/goals that already exist by name are skipped.
// Times below are starting guesses — change them with /edittask or on the website.
const mongoose = require('mongoose');
const config = require('../config');
const { Structure, Goal, Task } = require('../database/models');

const APPLY = process.argv.includes('--apply');

const STRUCTURE = [
  // Li — Lily only
  { owner: 'li', area: 'Flolabs', items: ['IoT', 'Humanoid'] },
  { owner: 'li', area: 'Projects', items: ['Robotics', 'PCB', 'Website'] },
  // Lizen — shared
  { owner: 'lizen', area: 'Applications', items: ['IELTS', 'Recommendation letters', 'Transcript & MoT', 'Reaching out to profs', 'Applying', 'App & requirement gathering'] },
  { owner: 'lizen', area: 'Class', items: ['Studying', 'Assignments'] },
  { owner: 'lizen', area: 'Ethioxplore', items: ['Ads & opportunities', 'Development', 'Meetings'] },
  { owner: 'lizen', area: 'AAR Club', items: ['Meetings', 'Events', 'Projects'] },
  { owner: 'lizen', area: 'Bright Addis', items: ['Wedet', 'Nester', 'Company tracker', 'Package delivery'] },
  { owner: 'lizen', area: 'Job apps', items: ['2 per day'] },
  { owner: 'lizen', area: 'Bible study', items: ['1 chapter per day', 'Church every Sunday'] },
  { owner: 'lizen', area: 'Personal business', items: ['Saving (50k combined)', 'Ideas', 'Hackathon'] },
  // Zen — Zen only
  { owner: 'zen', area: 'Gheero', items: [] },
  { owner: 'zen', area: 'PMs', items: [] },
  { owner: 'zen', area: 'Ethioadvise', items: [] },
];

const both = () => config.memberIds();

const TASKS = [
  {
    name: 'Bible — 1 chapter', type: 'daily', schedule: { time: '21:00' },
    area: 'Bible study', item: '1 chapter per day',
  },
  {
    name: 'Church', type: 'weekly', schedule: { time: '09:00', days: [0] },
    area: 'Bible study', item: 'Church every Sunday',
  },
  {
    name: 'Job applications', type: 'daily', schedule: { time: '20:00' },
    target: 2, unit: 'apps', area: 'Job apps', item: '2 per day',
  },
];

const GOALS = [
  { name: 'Savings (combined)', target: 50000, unit: 'ETB', owner: 'lizen', area: 'Personal business' },
];

async function main() {
  if (both().length !== 2) throw new Error('USER1_ID and USER2_ID must be set');
  await mongoose.connect(config.mongodb.uri);
  console.log(APPLY ? '✍️  APPLY mode' : '👀 Dry run (pass --apply to write)');

  for (const [i, s] of STRUCTURE.entries()) {
    console.log(`area   ${s.owner.padEnd(5)} ${s.area}: ${s.items.join(', ') || '—'}`);
    if (APPLY) await Structure.updateOne({ owner: s.owner, area: s.area }, { $set: { ...s, sort: i } }, { upsert: true });
  }

  for (const g of GOALS) {
    const exists = await Goal.exists({ name: g.name, active: true });
    console.log(`goal   ${g.name} → ${g.target} ${g.unit}${exists ? ' (exists, skipped)' : ''}`);
    if (APPLY && !exists) await Goal.create(g);
  }

  // Loaded lazily: task creation also syncs Google Calendar and today's occurrences.
  const { createTask } = require('../services/taskService');
  for (const t of TASKS) {
    const exists = await Task.exists({ name: t.name, active: true });
    console.log(`task   ${t.name} (${t.type} ${t.schedule.time}${t.target ? `, target ${t.target} ${t.unit}` : ''})${exists ? ' (exists, skipped)' : ''}`);
    if (APPLY && !exists) {
      const { name, type, schedule, ...extra } = t;
      await createTask(name, '', type, schedule, both()[0], 10, both(), { mode: 'each', ...extra });
    }
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌', err.message);
  await mongoose.disconnect();
  process.exit(1);
});
