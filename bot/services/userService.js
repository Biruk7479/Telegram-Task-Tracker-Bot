const { User, Task, Completion } = require('../database/models');
const config = require('../config');

// Calculate XP needed for a level
const xpForLevel = (level) => {
  return Math.floor(100 * Math.pow(1.5, level - 1));
};

// Check if user leveled up
const checkLevelUp = (xp, currentLevel) => {
  let level = currentLevel;
  let totalXpNeeded = 0;
  
  for (let i = 1; i <= level; i++) {
    totalXpNeeded += xpForLevel(i);
  }
  
  while (xp >= totalXpNeeded + xpForLevel(level + 1)) {
    level++;
    totalXpNeeded += xpForLevel(level);
  }
  
  return level;
};

// Get or create user
const getOrCreateUser = async (telegramId, username) => {
  let user = await User.findOne({ telegramId });
  
  if (!user) {
    user = new User({
      telegramId,
      username,
      xp: 0,
      level: 1,
      streaks: new Map(),
      lastCompletions: new Map(),
    });
    await user.save();
  }
  
  return user;
};

// Record task completion
const recordCompletion = async (taskId, userId, completed, advanceCompletion = false) => {
  const task = await Task.findById(taskId);
  const user = await User.findOne({ telegramId: userId });
  
  if (!task || !user) {
    throw new Error('Task or user not found');
  }
  
  let xpEarned = 0;
  let streakCount = 0;
  
  if (completed) {
    // No XP reward - just track completion
    xpEarned = 0;
    
    // Check streak
    const lastCompletion = user.lastCompletions.get(taskId.toString());
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (lastCompletion) {
      const lastDate = new Date(lastCompletion);
      lastDate.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 1) {
        // Continuing streak
        streakCount = (user.streaks.get(taskId.toString()) || 0) + 1;
        // No bonus XP for streaks
      } else if (daysDiff === 0) {
        // Already completed today
        streakCount = user.streaks.get(taskId.toString()) || 0;
      } else {
        // Streak broken
        streakCount = 1;
      }
    } else {
      // First completion
      streakCount = 1;
    }
    
    // Update user streaks only (no XP gain)
    user.streaks.set(taskId.toString(), streakCount);
    user.lastCompletions.set(taskId.toString(), today);
    
    // No level up for completions anymore - levels only increase from weekly wins
    await user.save();
    
    // Calculate proper scheduledFor date
    let scheduledForDate = new Date();
    scheduledForDate.setHours(0, 0, 0, 0);
    
    // For flexible tasks, use today; for scheduled tasks, use their scheduled date
    if (task.type !== 'flexible' && task.schedule) {
      if (task.type === 'one-time' && task.schedule.date) {
        scheduledForDate = new Date(task.schedule.date);
        scheduledForDate.setHours(0, 0, 0, 0);
      }
      // For daily/weekly/custom, use today since they're completing on schedule
    }
    
    // Record completion
    const completion = new Completion({
      taskId,
      userId,
      completed: true,
      xpEarned: 0, // No XP for completing tasks
      streakCount,
      scheduledFor: scheduledForDate,
      advanceCompletion: advanceCompletion,
    });
    await completion.save();
    
    return { xpEarned: 0, streakCount, leveledUp: false, newLevel: user.level, taskName: task.name };
  } else {
    // Reset streak and subtract 10 XP from weeklyXp
    user.streaks.set(taskId.toString(), 0);
    user.weeklyXp = Math.max(0, (user.weeklyXp || 100) - 10); // Subtract 10 XP, minimum 0
    await user.save();
    
    // Calculate proper scheduledFor date
    let scheduledForDate = new Date();
    scheduledForDate.setHours(0, 0, 0, 0);
    
    if (task.type !== 'flexible' && task.schedule) {
      if (task.type === 'one-time' && task.schedule.date) {
        scheduledForDate = new Date(task.schedule.date);
        scheduledForDate.setHours(0, 0, 0, 0);
      }
    }
    
    // Record non-completion
    const completion = new Completion({
      taskId,
      userId,
      completed: false,
      xpEarned: 0,
      xpPenalty: 10,
      streakCount: 0,
      scheduledFor: scheduledForDate,
    });
    await completion.save();
    
    return { xpEarned: 0, xpPenalty: 10, streakCount: 0, leveledUp: false, taskName: task.name };
  }
};

// Get user stats
const getUserStats = async (userId) => {
  const user = await User.findOne({ telegramId: userId });
  if (!user) return null;
  
  const completions = await Completion.find({ userId, completed: true });
  const totalTasks = completions.length;
  
  // Get current streaks
  const streaks = {};
  for (const [taskId, streakCount] of user.streaks.entries()) {
    if (streakCount > 0) {
      const task = await Task.findById(taskId);
      if (task) {
        streaks[task.name] = streakCount;
      }
    }
  }
  
  // Calculate XP needed for next level
  const xpForNextLevel = xpForLevel(user.level + 1);
  let xpInCurrentLevel = user.xp;
  for (let i = 1; i <= user.level; i++) {
    xpInCurrentLevel -= xpForLevel(i);
  }
  
  return {
    username: user.username,
    level: user.level,
    xp: user.xp,
    weeklyXp: user.weeklyXp || 100,
    xpInCurrentLevel,
    xpForNextLevel,
    totalTasksCompleted: totalTasks,
    activeStreaks: streaks,
  };
};

// Get leaderboard
const getLeaderboard = async () => {
  const users = await User.find().sort({ xp: -1 }).limit(10);
  return users.map(user => ({
    username: user.username,
    level: user.level,
    xp: user.xp,
    weeklyXp: user.weeklyXp || 100,
  }));
};

module.exports = {
  getOrCreateUser,
  recordCompletion,
  getUserStats,
  getLeaderboard,
  xpForLevel,
};
