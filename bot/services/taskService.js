const { Task } = require('../database/models');
const config = require('../config');

// Helper to get current time in configured timezone
const getLocalTime = () => {
  const now = new Date();
  const offset = config.timezone?.offset || 0;
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * offset));
};

// Create a new task
const createTask = async (name, description, type, schedule, createdBy, xpReward = 10, assignedTo = []) => {
  const task = new Task({
    name,
    description,
    type,
    schedule,
    xpReward,
    createdBy,
    assignedTo: assignedTo.length > 0 ? assignedTo : [createdBy], // default to creator
    active: true,
  });
  
  await task.save();
  return task;
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
    return true;
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
    task.schedule = { ...task.schedule, ...updates.schedule };
    task.markModified('schedule');
  }
  
  await task.save();
  return task;
};

// Get tasks that should be checked now
const getTasksDueNow = async () => {
  const localNow = getLocalTime();
  const currentHour = localNow.getHours().toString().padStart(2, '0');
  const currentMinute = localNow.getMinutes().toString().padStart(2, '0');
  const currentTime = `${currentHour}:${currentMinute}`;
  const currentDay = localNow.getDay();
  
  // Get all active tasks
  const allTasks = await Task.find({ active: true });
  const dueTasks = [];
  
  for (const task of allTasks) {
    let isDue = false;
    
    if (task.type === 'daily' && task.schedule?.time === currentTime) {
      isDue = true;
    } else if (task.type === 'weekly' && task.schedule?.time === currentTime && task.schedule?.days?.includes(currentDay)) {
      isDue = true;
    } else if (task.type === 'custom' && task.schedule?.time === currentTime && task.schedule?.days?.includes(currentDay)) {
      isDue = true;
    } else if (task.type === 'one-time' && task.schedule?.time === currentTime && task.schedule?.date) {
      // Check if the one-time task date matches today (compare date strings to avoid timezone issues)
      const taskDate = new Date(task.schedule.date);
      const taskDateStr = `${taskDate.getFullYear()}-${(taskDate.getMonth() + 1).toString().padStart(2, '0')}-${taskDate.getDate().toString().padStart(2, '0')}`;
      const nowDateStr = `${localNow.getFullYear()}-${(localNow.getMonth() + 1).toString().padStart(2, '0')}-${localNow.getDate().toString().padStart(2, '0')}`;
      
      console.log(`🔍 One-time task check: ${task.name}`);
      console.log(`   Task date string: ${taskDateStr}`);
      console.log(`   Current date string: ${nowDateStr}`);
      console.log(`   Task time: ${task.schedule.time}, Current time: ${currentTime}`);
      console.log(`   Dates match: ${taskDateStr === nowDateStr}`);
      
      if (taskDateStr === nowDateStr) {
        isDue = true;
        console.log(`   ✅ Task IS due now!`);
      } else {
        console.log(`   ❌ Task NOT due (date mismatch)`);
      }
    }
    
    if (isDue) {
      dueTasks.push(task);
    }
  }
  
  return dueTasks;
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
