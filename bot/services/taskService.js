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

// Check if a task was scheduled for a specific date
const isTaskScheduledForDate = (task, targetDate) => {
  const dayOfWeek = targetDate.getDay();
  
  if (task.type === 'daily') {
    return true;
  }
  
  if (task.type === 'weekly' || task.type === 'custom') {
    return task.schedule.days && task.schedule.days.includes(dayOfWeek);
  }
  
  if (task.type === 'one-time' && task.schedule?.date) {
    const taskDate = new Date(task.schedule.date);
    const taskDateStr = `${taskDate.getFullYear()}-${(taskDate.getMonth() + 1).toString().padStart(2, '0')}-${taskDate.getDate().toString().padStart(2, '0')}`;
    const targetDateStr = `${targetDate.getFullYear()}-${(targetDate.getMonth() + 1).toString().padStart(2, '0')}-${targetDate.getDate().toString().padStart(2, '0')}`;
    return taskDateStr === targetDateStr;
  }
  
  // Flexible tasks can be done anytime
  if (task.type === 'flexible') {
    return true;
  }
  
  return false;
};

// Check if it's too late to mark a task as done or confirm it
const isTaskPastDeadline = (task) => {
  // Flexible tasks never expire
  if (task.type === 'flexible') {
    return false;
  }
  
  // Tasks without schedule time are flexible-like
  if (!task.schedule || !task.schedule.time) {
    return false;
  }
  
  const localNow = getLocalTime();
  const today = new Date(localNow);
  today.setHours(0, 0, 0, 0);
  
  // Check if task was scheduled for today
  const scheduledToday = isTaskScheduledForDate(task, today);
  
  if (!scheduledToday) {
    // Task is not scheduled for today, check if it was scheduled for yesterday or earlier
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // For one-time tasks, check if the task date has passed
    if (task.type === 'one-time' && task.schedule?.date) {
      const taskDate = new Date(task.schedule.date);
      taskDate.setHours(0, 0, 0, 0);
      
      // If task date is before today, it's past deadline
      if (taskDate < today) {
        return true;
      }
      
      // If task date is in the future, it's not past deadline
      return false;
    }
    
    // For recurring tasks (daily, weekly, custom), if not scheduled today
    // we need to check if it was scheduled yesterday or earlier and that day has passed
    // Allow marking done up until the scheduled day ends (midnight next day)
    const wasScheduledYesterday = isTaskScheduledForDate(task, yesterday);
    
    if (wasScheduledYesterday) {
      // Yesterday's tasks are past deadline
      return true;
    }
    
    // Not scheduled today or yesterday, so can't be done now
    return true;
  }
  
  // Task is scheduled for today - it's valid to mark done or confirm
  return false;
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
  isTaskScheduledForDate,
  isTaskPastDeadline,
};
