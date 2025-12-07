const { User, Completion } = require('../database/models');
const rewards = require('../data/rewards.json');
const config = require('../config');

// Helper to get current time in configured timezone
const getLocalTime = () => {
  const now = new Date();
  const offset = config.timezone?.offset || 0;
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * offset));
};

/**
 * Check if a new week has started and reset weekly XP
 */
async function checkAndResetWeek() {
  const users = await User.find();
  if (users.length === 0) return null;

  const localNow = getLocalTime();
  const isMonday = localNow.getDay() === 1; // 0 is Sunday, 1 is Monday
  const isSixAM = localNow.getHours() === 6 && localNow.getMinutes() === 0;
  
  // Only reset on Mondays at 6 AM
  if (!isMonday || !isSixAM) return null;
  
  // Check if we already reset today (check first user)
  const user = users[0];
  const lastReset = new Date(user.weekStartDate);
  
  const isResetToday = lastReset.getDate() === localNow.getDate() && 
                       lastReset.getMonth() === localNow.getMonth() && 
                       lastReset.getFullYear() === localNow.getFullYear();
  
  // If hasn't reset today (Monday), do it now
  if (!isResetToday) {
    return await handleWeekEnd(user);
  }
  
  return null;
}

/**
 * Handle end of week - determine winner, assign rewards, reset XP
 */
async function handleWeekEnd(user) {
  const users = await User.find();
  
  // Get both users
  if (users.length !== 2) return null; // Safety check
  
  const [user1, user2] = users;
  let randomReward = null;
  
  // Capture current state before reset
  const user1Xp = user1.weeklyXp;
  const user2Xp = user2.weeklyXp;
  const user1Name = user1.username;
  const user2Name = user2.username;
  
  // Check for tie (Same XP)
  if (user1Xp === user2Xp) {
    // Both level up
    user1.level += 1;
    user2.level += 1;
  } else {
    // Determine winner (higher weekly XP)
    const winner = user1Xp > user2Xp ? user1 : user2;
    const loser = winner._id.equals(user1._id) ? user2 : user1;
    
    // Winner levels up
    winner.level += 1;
    
    // Loser gets a random reward task
    randomReward = rewards.rewards[Math.floor(Math.random() * rewards.rewards.length)];
    loser.pendingRewards.push(randomReward);
  }
  
  // Reset weekly XP for both
  user1.weeklyXp = 100;
  user2.weeklyXp = 100;
  user1.weekStartDate = new Date();
  user2.weekStartDate = new Date();
  
  await user1.save();
  await user2.save();
  
  return {
    isTie: user1Xp === user2Xp,
    bothPerfect: user1Xp === 100 && user2Xp === 100,
    winner: user1Xp > user2Xp ? user1Name : user2Name,
    loser: user1Xp > user2Xp ? user2Name : user1Name,
    winnerXp: Math.max(user1Xp, user2Xp),
    loserXp: Math.min(user1Xp, user2Xp),
    reward: randomReward
  };
}

/**
 * Apply penalty for missed confirmation
 * Fixed penalty of 10 XP for everyone
 * @param {string} userId - The user ID to penalize
 * @param {string} taskId - The task ID
 * @param {Array} usersSnapshot - Optional snapshot of users for simultaneous calculation
 */
async function applyMissedConfirmationPenalty(userId, taskId, usersSnapshot = null) {
  // Fetch user to update
  const userToUpdate = await User.findOne({ telegramId: userId });
  if (!userToUpdate) return;

  const penalty = 10; // Fixed 10 XP penalty for missed tasks
  
  // Apply penalty and reset streak
  userToUpdate.weeklyXp = Math.max(0, userToUpdate.weeklyXp - penalty);
  userToUpdate.streaks.set(taskId.toString(), 0); // Reset streak on missed confirmation
  await userToUpdate.save();
  
  // Record the missed completion
  await Completion.create({
    taskId,
    userId,
    completed: false,
    xpPenalty: penalty,
    missedConfirmation: true,
    completedAt: new Date(),
  });
  
  return {
    penalty,
    newXp: userToUpdate.weeklyXp,
  };
}

/**
 * Check for tasks that passed their day without confirmation
 */
async function checkMissedConfirmations() {
  const localNow = getLocalTime();
  const yesterday = new Date(localNow);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  
  const today = new Date(localNow);
  today.setHours(0, 0, 0, 0);

  // Allow confirmations until 6 AM the next day
  const deadline = new Date(today);
  deadline.setHours(6, 0, 0, 0);
  
  // Find completions from yesterday that were never confirmed
  const Task = require('../database/models').Task;
  const tasks = await Task.find({ active: true });
  const { parseTime } = require('./taskService');
  
  // Track missed tasks per user
  const missedTasksPerUser = {};
  const users = await User.find();
  
  // Initialize counters
  for (const user of users) {
    missedTasksPerUser[user.telegramId] = 0;
  }
  
  for (const task of tasks) {
    // Check if task was scheduled for yesterday based on task type
    const wasScheduledYesterday = isTaskScheduledForYesterday(task, yesterday);
    
    if (!wasScheduledYesterday) {
      continue; // Skip if task was not scheduled for yesterday
    }
    
    // Check creation time to avoid penalizing tasks created after deadline
    if (task.schedule && task.schedule.time) {
      const time = parseTime(task.schedule.time);
      if (time) {
        const taskDeadline = new Date(yesterday);
        taskDeadline.setHours(parseInt(time.hour), parseInt(time.minute), 0, 0);
        
        // Convert task.createdAt to local time
        const offset = config.timezone?.offset || 0;
        const taskCreatedAtLocal = new Date(task.createdAt.getTime() + (3600000 * offset));
        
        // If task was created after the deadline, skip
        if (taskCreatedAtLocal > taskDeadline) {
          continue;
        }
      }
    }

    for (const user of users) {
      // Check if user is assigned to this task
      if (task.assignedTo && task.assignedTo.length > 0 && !task.assignedTo.includes(user.telegramId)) {
        continue;
      }

      // Check if user confirmed this task yesterday (or before 6 AM today)
      const completion = await Completion.findOne({
        taskId: task._id,
        userId: user.telegramId,
        completedAt: { $gte: yesterday, $lt: deadline },
      });
      
      // If no completion record, count as missed
      if (!completion) {
        missedTasksPerUser[user.telegramId]++;
        
        // Create missed completion record
        await Completion.create({
          taskId: task._id,
          userId: user.telegramId,
          completed: false,
          xpPenalty: 0, // Will be calculated after comparing all users
          missedConfirmation: true,
          completedAt: new Date(),
          scheduledFor: yesterday,
        });
      }
    }
  }
  
  // Now calculate differential penalties
  // Penalty is applied to whoever MISSED MORE tasks
  // The penalty value is: lowest XP - (difference × 10)
  const userIds = Object.keys(missedTasksPerUser);
  
  if (userIds.length === 2) {
    const [user1Id, user2Id] = userIds;
    const user1Missed = missedTasksPerUser[user1Id];
    const user2Missed = missedTasksPerUser[user2Id];
    
    console.log(`\n📊 Missed task comparison:`);
    console.log(`   User ${user1Id}: ${user1Missed} missed`);
    console.log(`   User ${user2Id}: ${user2Missed} missed`);
    
    // Get both users' current XP
    const user1 = await User.findOne({ telegramId: user1Id });
    const user2 = await User.findOne({ telegramId: user2Id });
    
    if (user1 && user2 && user1Missed !== user2Missed) {
      // Determine who missed more tasks
      const diff = Math.abs(user1Missed - user2Missed);
      const lowestXp = Math.min(user1.weeklyXp, user2.weeklyXp);
      const newXp = Math.max(0, lowestXp - (diff * 10));
      
      // Apply to whoever missed more
      let penalizedUser;
      if (user1Missed > user2Missed) {
        penalizedUser = user1;
      } else {
        penalizedUser = user2;
      }
      
      const beforeXp = penalizedUser.weeklyXp;
      penalizedUser.weeklyXp = newXp;
      await penalizedUser.save();
      
      // Reload both users to get fresh XP values
      const updatedUser1 = await User.findOne({ telegramId: user1Id });
      const updatedUser2 = await User.findOne({ telegramId: user2Id });
      
      console.log(`   💥 User ${penalizedUser.telegramId} (missed more) penalized: ${beforeXp} → ${newXp} (lowest was ${lowestXp})`);
      console.log(`   Final XP: ${user1Id}=${updatedUser1?.weeklyXp}, ${user2Id}=${updatedUser2?.weeklyXp}`);
      
      // Update completion records with penalty for whoever missed more
      await Completion.updateMany(
        {
          userId: penalizedUser.telegramId,
          scheduledFor: { $gte: yesterday, $lt: today },
          missedConfirmation: true,
          xpPenalty: 0
        },
        { $set: { xpPenalty: beforeXp - newXp } }
      );
    } else {
      console.log(`   ⚖️ Both users missed equal tasks, no penalty applied`);
    }
  } else {
    // Single user or more than 2 users - apply standard penalties
    for (const userId of userIds) {
      const missedCount = missedTasksPerUser[userId];
      if (missedCount > 0) {
        const penalty = missedCount * 10;
        const user = await User.findOne({ telegramId: userId });
        if (user) {
          user.weeklyXp = Math.max(0, user.weeklyXp - penalty);
          await user.save();
        }
        
        // Update completion records with penalty
        await Completion.updateMany(
          {
            userId: userId,
            scheduledFor: { $gte: yesterday, $lt: today },
            missedConfirmation: true,
            xpPenalty: 0
          },
          { $set: { xpPenalty: 10 } }
        );
      }
    }
  }
}

/**
 * Check if a task was scheduled for yesterday
 */
function isTaskScheduledForYesterday(task, yesterday) {
  // Flexible tasks have no schedule, so they can't be "missed"
  if (task.type === 'flexible') {
    return false;
  }
  
  if (task.type === 'daily') {
    return true;
  }
  
  if (task.type === 'weekly' || task.type === 'custom') {
    const yesterdayDay = yesterday.getDay();
    return task.schedule.days && task.schedule.days.includes(yesterdayDay);
  }
  
  if (task.type === 'one-time' && task.schedule?.date) {
    const taskDate = new Date(task.schedule.date);
    const taskDateStr = `${taskDate.getFullYear()}-${(taskDate.getMonth() + 1).toString().padStart(2, '0')}-${taskDate.getDate().toString().padStart(2, '0')}`;
    const yesterdayDateStr = `${yesterday.getFullYear()}-${(yesterday.getMonth() + 1).toString().padStart(2, '0')}-${yesterday.getDate().toString().padStart(2, '0')}`;
    return taskDateStr === yesterdayDateStr;
  }
  
  return false;
}

module.exports = {
  checkAndResetWeek,
  applyMissedConfirmationPenalty,
  checkMissedConfirmations,
  handleWeekEnd,
};
