const { Task } = require('../database/models');
const { localParts, normalizeTime } = require('../utils/time');
const { isScheduledOn } = require('./schedule');
const occurrences = require('./occurrenceService');

// Create a new task
const createTask = async (name, description, type, schedule, createdBy, xpReward = 10, assignedTo = [], extra = {}) => {
  if (schedule?.time) schedule = { ...schedule, time: normalizeTime(schedule.time) };
  const task = new Task({
    name,
    description,
    type,
    schedule,
    xpReward,
    createdBy,
    assignedTo: assignedTo.length > 0 ? assignedTo : [createdBy], // default to creator
    active: true,
    ...pickExtra(extra),
  });
  
  await task.save();
  await occurrences.resyncTask(task);
  
  // Sync to Google Calendar
  try {
    const { createCalendarEvent } = require('./googleCalendarService');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventId = await createCalendarEvent(task, today);
    if (eventId) {
      task.googleCalendarEventId = eventId;
      await task.save();
      console.log(`✅ Task "${task.name}" synced to Google Calendar`);
    }
  } catch (error) {
    console.error('⚠️ Failed to sync task to Google Calendar:', error.message);
    // Don't fail task creation if calendar sync fails
  }
  
  return task;
};

// Optional fields shared by every create/update path.
const pickExtra = (src = {}) => {
  const out = {};
  if (src.target !== undefined) out.target = Math.max(1, parseInt(src.target, 10) || 1);
  if (src.unit !== undefined) out.unit = String(src.unit);
  if (src.mode !== undefined && ['each', 'pooled'].includes(src.mode)) out.mode = src.mode;
  if (src.area !== undefined) out.area = String(src.area);
  if (src.item !== undefined) out.item = String(src.item);
  if (src.startDate !== undefined) out.startDate = src.startDate || undefined;
  return out;
};

// Get all active tasks
const getActiveTasks = async () => {
  return await Task.find({ active: true }).sort({ createdAt: -1 });
};

// Get task by ID
const getTaskById = async (taskId) => {
  return await Task.findById(taskId);
};

// Delete task
const deleteTask = async (taskId) => {
  const task = await Task.findById(taskId);
  if (task) {
    task.active = false;
    await task.save();
    await occurrences.resyncTask(task); // voids today's and future pending occurrences
    return task;
  }
  return false;
};

// Update task
const updateTask = async (taskId, updates) => {
  const task = await Task.findById(taskId);
  if (!task) return null;
  
  // Update allowed fields
  if (updates.name) task.name = updates.name;
  if (updates.description !== undefined) task.description = updates.description;
  if (updates.schedule) {
    task.schedule = { ...(task.schedule?.toObject?.() || task.schedule), ...updates.schedule };
    if (task.schedule.time) task.schedule.time = normalizeTime(task.schedule.time);
    task.markModified('schedule');
  }
  if (updates.assignedTo) task.assignedTo = updates.assignedTo;
  Object.assign(task, pickExtra(updates));
  
  await task.save();
  await occurrences.resyncTask(task);
  return task;
};

// Active tasks whose reminder time is this minute (local time) today.
const getTasksDueNow = async (now = new Date()) => {
  const { dateKey, time } = localParts(now);
  const tasks = await Task.find({ active: true, 'schedule.time': { $exists: true } });
  return tasks.filter((task) => normalizeTime(task.schedule.time) === time && isScheduledOn(task, dateKey));
};

// Parse time string (e.g., "7:00", "14:30")
const parseTime = (timeStr) => {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  
  const hour = parseInt(match[1]);
  const minute = parseInt(match[2]);
  
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  
  return {
    hour: hour.toString().padStart(2, '0'),
    minute: minute.toString().padStart(2, '0'),
    formatted: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
  };
};

// Parse days string (e.g., "Mon,Wed,Fri" or "1,3,5")
const parseDays = (daysStr) => {
  const dayMap = {
    'sun': 0, 'sunday': 0,
    'mon': 1, 'monday': 1,
    'tue': 2, 'tuesday': 2,
    'wed': 3, 'wednesday': 3,
    'thu': 4, 'thursday': 4,
    'fri': 5, 'friday': 5,
    'sat': 6, 'saturday': 6,
  };
  
  const days = daysStr.split(',').map(d => d.trim().toLowerCase());
  const result = [];
  
  for (const day of days) {
    if (dayMap[day] !== undefined) {
      result.push(dayMap[day]);
    } else {
      const num = parseInt(day);
      if (num >= 0 && num <= 6) {
        result.push(num);
      }
    }
  }
  
  return result.length > 0 ? result : null;
};

// Parse custom days (e.g., "M,W,F" or "M,T,Th")
const parseCustomDays = (daysStr) => {
  const dayMap = {
    'su': 0, 'sun': 0,
    'm': 1, 'mon': 1,
    't': 2, 'tue': 2, 'tu': 2,
    'w': 3, 'wed': 3,
    'th': 4, 'thu': 4,
    'f': 5, 'fri': 5,
    's': 6, 'sat': 6, 'sa': 6,
  };
  
  const days = daysStr.split(',').map(d => d.trim().toLowerCase());
  const result = [];
  
  for (const day of days) {
    if (dayMap[day] !== undefined) {
      result.push(dayMap[day]);
    }
  }
  
  return result.length > 0 ? result : null;
};

module.exports = {
  createTask,
  getActiveTasks,
  getTaskById,
  deleteTask,
  updateTask,
  getTasksDueNow,
  parseTime,
  parseDays,
  parseCustomDays,
};
