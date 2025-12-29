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

const User = mongoose.model('User', userSchema);
const Task = mongoose.model('Task', taskSchema);
const Completion = mongoose.model('Completion', completionSchema);

module.exports = { User, Task, Completion };
