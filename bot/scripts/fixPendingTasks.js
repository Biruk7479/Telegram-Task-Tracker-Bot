const mongoose = require('mongoose');
const path = require('path');

// Load environment variables from parent directory
require('dotenv').config({ path: path.join(__dirname, '../../.env.cpanel') });

const config = require('../config');

// Helper to get current time in configured timezone
const getLocalTime = () => {
  const now = new Date();
  const offset = config.timezone?.offset || 0;
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * offset));
};

// Parse time string to hour/minute
const parseTime = (timeStr) => {
  if (!timeStr) return null;
  const [hour, minute] = timeStr.split(':');
  return { hour: parseInt(hour), minute: parseInt(minute) };
};

// Check if a task was scheduled for a specific date
function isTaskScheduledForDate(task, targetDate) {
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
  
  // Flexible tasks dont have scheduled dates
  return false;
}

async function fixPendingTasks() {
  try {
    // Connect to database
    await mongoose.connect(config.mongodb.uri);
    console.log('Connected to database');

    const { Task, Completion, User } = require('../database/models');
    
    const localNow = getLocalTime();
    const today = new Date(localNow);
    today.setHours(0, 0, 0, 0);
    
    console.log(`\n🔍 Checking for tasks that should be marked incomplete...`);
    console.log(`Current local time: ${localNow.toLocaleString()}`);
    
    // First, reset all users' XP to 100 to recalculate from scratch
    const users = await User.find();
    const initialXp = {};
    
    for (const user of users) {
      initialXp[user.telegramId] = user.weeklyXp;
      user.weeklyXp = 100;
      await user.save();
    }
    
    console.log('\n🔄 Reset all users to 100 XP to recalculate...\n');
    
    // Get all active tasks
    const tasks = await Task.find({ active: true });
    
    // Track missed tasks per user per day
    const missedTasksByDay = {}; // { 'YYYY-MM-DD': { userId: count } }
    const daysToCheck = 30;
    
    for (const task of tasks) {
      // Skip flexible tasks - they don't have deadlines
      if (task.type === 'flexible') {
        continue;
      }
      
      // Skip tasks without schedule time
      if (!task.schedule || !task.schedule.time) {
        continue;
      }
      
      const taskTime = parseTime(task.schedule.time);
      if (!taskTime) continue;
      
      // Check all past dates where this task was scheduled
      for (let i = 1; i <= daysToCheck; i++) {
        const pastDate = new Date(today);
        pastDate.setDate(pastDate.getDate() - i);
        
        // Check if task was scheduled for this date
        if (!isTaskScheduledForDate(task, pastDate)) {
          continue;
        }
        
        // Check if task was created before this date's deadline
        const taskDeadline = new Date(pastDate);
        taskDeadline.setHours(taskTime.hour, taskTime.minute, 0, 0);
        
        // Add one day for the deadline (tasks are incomplete if not confirmed by next day)
        const actualDeadline = new Date(taskDeadline);
        actualDeadline.setDate(actualDeadline.getDate() + 1);
        actualDeadline.setHours(0, 0, 0, 0); // Midnight of next day
        
        if (task.createdAt > actualDeadline) {
          continue; // Task was created after the deadline
        }
        
        // Check if we're past the deadline
        if (localNow < actualDeadline) {
          continue; // Not past deadline yet
        }
        
        const dateKey = pastDate.toISOString().split('T')[0];
        if (!missedTasksByDay[dateKey]) {
          missedTasksByDay[dateKey] = {};
        }
        
        // For each assigned user, check if they have a completion record
        const assignedUsers = task.assignedTo || [task.createdBy];
        
        for (const userId of assignedUsers) {
          if (!missedTasksByDay[dateKey][userId]) {
            missedTasksByDay[dateKey][userId] = 0;
          }
          
          // Check if completion exists for this task/user/date
          const startOfDate = new Date(pastDate);
          startOfDate.setHours(0, 0, 0, 0);
          
          const endOfDate = new Date(pastDate);
          endOfDate.setHours(23, 59, 59, 999);
          
          // Look for SUCCESSFUL completion (completed: true)
          const successfulCompletion = await Completion.findOne({
            taskId: task._id,
            userId: userId,
            scheduledFor: { $gte: startOfDate, $lte: endOfDate },
            completed: true
          });
          
          // If no successful completion exists, this is a missed task
          if (!successfulCompletion) {
            missedTasksByDay[dateKey][userId]++;
            
            // Check if we already have a missed record
            const existingMissed = await Completion.findOne({
              taskId: task._id,
              userId: userId,
              scheduledFor: { $gte: startOfDate, $lte: endOfDate },
              missedConfirmation: true
            });
            
            // Only create if we don't have one already
            if (!existingMissed) {
              await Completion.create({
                taskId: task._id,
                userId: userId,
                completed: false,
                xpPenalty: 0, // Will be set after differential calculation
                missedConfirmation: true,
                completedAt: actualDeadline,
                scheduledFor: pastDate,
              });
            }
          }
        }
      }
    }
    
    // Now apply differential penalties per day
    let totalPenaltiesApplied = 0;
    
    for (const [dateKey, userMissedCounts] of Object.entries(missedTasksByDay)) {
      const userIds = Object.keys(userMissedCounts);
      
      console.log(`\n📅 Date: ${dateKey}`);
      
      if (userIds.length === 2) {
        const [user1Id, user2Id] = userIds;
        const user1Missed = userMissedCounts[user1Id] || 0;
        const user2Missed = userMissedCounts[user2Id] || 0;
        
        console.log(`   User ${user1Id}: ${user1Missed} missed`);
        console.log(`   User ${user2Id}: ${user2Missed} missed`);
        
        // Get both users' current XP
        const user1 = await User.findOne({ telegramId: user1Id });
        const user2 = await User.findOne({ telegramId: user2Id });
        
        if (user1 && user2 && user1Missed !== user2Missed) {
          const diff = Math.abs(user1Missed - user2Missed);
          const penalty = diff * 10;
          
          // Apply penalty to whoever has LOWER XP
          let penalizedUser;
          
          if (user1.weeklyXp < user2.weeklyXp) {
            penalizedUser = user1;
          } else if (user2.weeklyXp < user1.weeklyXp) {
            penalizedUser = user2;
          } else {
            // Equal XP - penalize whoever missed more
            penalizedUser = user1Missed > user2Missed ? user1 : user2;
          }
          
          const beforeXp = penalizedUser.weeklyXp;
          penalizedUser.weeklyXp = Math.max(0, penalizedUser.weeklyXp - penalty);
          await penalizedUser.save();
          
          console.log(`   💥 User ${penalizedUser.telegramId} loses ${penalty} XP (has lower XP: ${beforeXp} → ${penalizedUser.weeklyXp})`);
          console.log(`   Final XP: ${user1.telegramId}=${user1.weeklyXp}, ${user2.telegramId}=${user2.weeklyXp}`);
          totalPenaltiesApplied += penalty;
          
          // Update completion records for whoever missed more
          const pastDate = new Date(dateKey);
          const userWhoMissedMore = user1Missed > user2Missed ? user1Id : user2Id;
          await Completion.updateMany(
            {
              userId: userWhoMissedMore,
              scheduledFor: { 
                $gte: new Date(pastDate.setHours(0, 0, 0, 0)), 
                $lte: new Date(pastDate.setHours(23, 59, 59, 999)) 
              },
              missedConfirmation: true
            },
            { $set: { xpPenalty: 10 } }
          );
        } else {
          console.log(`   ⚖️ Equal misses, no penalty`);
        }
      } else {
        // Single user or more than 2 - apply standard penalties
        for (const userId of userIds) {
          const missedCount = userMissedCounts[userId];
          if (missedCount > 0) {
            const penalty = missedCount * 10;
            const user = await User.findOne({ telegramId: userId });
            if (user) {
              user.weeklyXp = Math.max(0, user.weeklyXp - penalty);
              await user.save();
              console.log(`   💥 User ${userId} loses ${penalty} XP (${missedCount} missed)`);
              totalPenaltiesApplied += penalty;
            }
            
            // Update completion records
            const pastDate = new Date(dateKey);
            await Completion.updateMany(
              {
                userId: userId,
                scheduledFor: { 
                  $gte: new Date(pastDate.setHours(0, 0, 0, 0)), 
                  $lte: new Date(pastDate.setHours(23, 59, 59, 999)) 
                },
                missedConfirmation: true
              },
              { $set: { xpPenalty: 10 } }
            );
          }
        }
      }
    }
    
    // Reset all task streaks
    for (const user of users) {
      const freshUser = await User.findOne({ telegramId: user.telegramId });
      freshUser.streaks = new Map();
      await freshUser.save();
    }
    
    console.log(`\n✅ Fix complete!`);
    console.log(`   Days processed: ${Object.keys(missedTasksByDay).length}`);
    console.log(`   Total penalties applied: ${totalPenaltiesApplied} XP`);
    
    // Show final XP
    console.log(`\n📊 Final Weekly XP:`);
    for (const user of users) {
      const freshUser = await User.findOne({ telegramId: user.telegramId });
      console.log(`   User ${freshUser.telegramId}: ${initialXp[freshUser.telegramId]} → ${freshUser.weeklyXp}`);
    }
    
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    
  } catch (error) {
    console.error('Error fixing pending tasks:', error);
    process.exit(1);
  }
}

// Run the fix
fixPendingTasks();
