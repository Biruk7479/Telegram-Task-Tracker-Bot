const mongoose = require('mongoose');

// User Schema
const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  xp: { type: Number, default: 0 },
  weeklyXp: { type: Number, default: 100 }, // Resets every week, starts at 100
  level: { type: Number, default: 1 },
  weekStartDate: { type: Date, default: Date.now }, // Track when week started
  streaks: { type: Map, of: Number, default: {} }, // taskId -> streak count
  lastCompletions: { type: Map, of: Date }, // taskId -> last completion date
  pendingRewards: [{ type: String }], // List of rewards owed to partner
  createdAt: { type: Date, default: Date.now },
});

// Task Schema
const taskSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  type: { 
    type: String, 
    enum: ['daily', 'weekly', 'custom', 'one-time', 'flexible'],
    required: true 
  },
  schedule: {
    time: String, // HH:MM format
    days: [Number], // 0-6 for weekly tasks (0 = Sunday)
    date: Date, // for one-time tasks
  },
  xpReward: { type: Number, default: 10 },
  active: { type: Boolean, default: true },
  createdBy: { type: String, required: true }, // telegram user id
  assignedTo: [{ type: String }], // array of telegram user ids who should do this task
  googleCalendarEventId: { type: String }, // Google Calendar event ID for syncing
  target: { type: Number, default: 1, min: 1 }, // e.g. 2 for "2 job applications a day"
  unit: { type: String, default: '' },          // label for the counter, e.g. "apps"
  mode: { type: String, enum: ['each', 'pooled'], default: 'each' }, // pooled: one shared result for all assignees
  area: { type: String, default: '' },          // structure: area, e.g. "Bible study"
  item: { type: String, default: '' },          // structure: item inside the area
  startDate: { type: String },                  // 'YYYY-MM-DD'; defaults to the creation day
  createdAt: { type: Date, default: Date.now },
});

// Task Completion Schema
const completionSchema = new mongoose.Schema({
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  userId: { type: String, required: true }, // telegram user id
  completed: { type: Boolean, required: true },
  xpEarned: { type: Number, default: 0 },
  xpPenalty: { type: Number, default: 0 }, // XP lost for missing
  streakCount: { type: Number, default: 0 },
  completedAt: { type: Date, default: Date.now },
  scheduledFor: { type: Date }, // when the task was scheduled for
  confirmedAt: { type: Date }, // when user confirmed (for penalty tracking)
  missedConfirmation: { type: Boolean, default: false }, // true if day passed without confirmation
  advanceCompletion: { type: Boolean, default: false }, // true if completed in advance
});

// Add index for efficient queries
completionSchema.index({ userId: 1, completedAt: -1 });
completionSchema.index({ taskId: 1, completedAt: -1 });

// One task, for one person, on one day. Every surface (bot, website, app,
// widgets, Streamlit) reads and writes these rows, and weekly XP is derived
// from their penalties. Name/time/target are snapshotted so editing or
// deleting a task later never rewrites history.
const occurrenceSchema = new mongoose.Schema({
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  userId: { type: String, required: true },
  date: { type: String, required: true },    // 'YYYY-MM-DD' in the configured timezone
  weekKey: { type: String, required: true }, // Monday of the date's week
  status: {
    type: String,
    // void: not counted (task unscheduled/deleted, or the server was down all day)
    enum: ['pending', 'done', 'missed', 'ignored', 'excused', 'void'],
    default: 'pending',
  },
  progress: { type: Number, default: 0 },
  target: { type: Number, default: 1 },
  penalty: { type: Number, default: 0 },
  taskName: { type: String, required: true },
  taskType: { type: String },
  time: { type: String },
  unit: { type: String, default: '' },
  mode: { type: String, default: 'each' },
  area: { type: String, default: '' },
  advance: { type: Boolean, default: false }, // done before its reminder time
  source: { type: String, default: '' },      // bot | web | app | streamlit | system | legacy
  resolvedBy: { type: String },               // who set the status (differs from userId for pooled tasks)
  resolvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});
occurrenceSchema.index({ taskId: 1, userId: 1, date: 1 }, { unique: true });
occurrenceSchema.index({ userId: 1, weekKey: 1 });
occurrenceSchema.index({ date: 1, status: 1 });
occurrenceSchema.index({ resolvedAt: -1 });

// Manual or migration corrections to a week's XP (positive amount = XP lost).
const xpAdjustmentSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  weekKey: { type: String, required: true },
  amount: { type: Number, required: true },
  reason: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});
xpAdjustmentSchema.index({ userId: 1, weekKey: 1 });

// The outcome of a finished week. Unique per week so it is settled exactly once.
const weekResultSchema = new mongoose.Schema({
  weekKey: { type: String, required: true, unique: true },
  scores: [{ userId: String, name: String, xp: Number }],
  winner: { type: String },   // telegram id, empty on a tie
  loser: { type: String },
  isTie: { type: Boolean, default: false },
  reward: { type: String },   // penalty task the loser owes
  settledAt: { type: Date, default: Date.now },
});

// Shared numeric goals, e.g. "Saving 50k combined". Tracked, never penalized.
const goalSchema = new mongoose.Schema({
  name: { type: String, required: true },
  target: { type: Number, required: true },
  unit: { type: String, default: '' },
  owner: { type: String, enum: ['li', 'zen', 'lizen'], default: 'lizen' },
  area: { type: String, default: '' },
  contributions: [{
    userId: String,
    amount: Number,
    note: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  }],
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

// The plan's structure: owner (Li / Zen / shared "Lizen") → area → items.
const structureSchema = new mongoose.Schema({
  owner: { type: String, enum: ['li', 'zen', 'lizen'], required: true },
  area: { type: String, required: true },
  items: [{ type: String }],
  sort: { type: Number, default: 0 },
});
structureSchema.index({ owner: 1, area: 1 }, { unique: true });

// Small key/value store for scheduler bookkeeping (last closed day, etc.).
const metaSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed },
});

const User = mongoose.model('User', userSchema);
const Task = mongoose.model('Task', taskSchema);
const Completion = mongoose.model('Completion', completionSchema);
const Occurrence = mongoose.model('Occurrence', occurrenceSchema);
const XpAdjustment = mongoose.model('XpAdjustment', xpAdjustmentSchema);
const WeekResult = mongoose.model('WeekResult', weekResultSchema);
const Goal = mongoose.model('Goal', goalSchema);
const Structure = mongoose.model('Structure', structureSchema);
const Meta = mongoose.model('Meta', metaSchema);

module.exports = { User, Task, Completion, Occurrence, XpAdjustment, WeekResult, Goal, Structure, Meta };
