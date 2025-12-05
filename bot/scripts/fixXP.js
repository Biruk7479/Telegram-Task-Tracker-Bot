const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const { User, Completion } = require('../database/models');

/**
 * Script to recalculate and fix weeklyXP based on actual completion records
 * This will count missed tasks and apply -10 XP per missed task
 */
async function fixWeeklyXP() {
  try {
    await connectDB();
    console.log('Connected to database');

    // Get all users
    const users = await User.find();
    console.log(`Found ${users.length} users`);

    for (const user of users) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Processing user: ${user.username} (${user.telegramId})`);
      console.log(`Current weeklyXp: ${user.weeklyXp}`);

      // Get the start of the current week (find user's weekStartDate)
      const weekStart = user.weekStartDate || new Date();
      weekStart.setHours(0, 0, 0, 0);
      
      console.log(`Week started: ${weekStart.toISOString()}`);

      // Count missed tasks (completed: false) since week start
      const missedTasks = await Completion.countDocuments({
        userId: user.telegramId,
        completed: false,
        completedAt: { $gte: weekStart }
      });

      console.log(`Missed tasks this week: ${missedTasks}`);

      // Recalculate XP: Start with 100, subtract 10 per missed task
      const correctXP = Math.max(0, 100 - (missedTasks * 10));
      console.log(`Correct weeklyXp should be: ${correctXP}`);

      if (user.weeklyXp !== correctXP) {
        console.log(`⚠️  Mismatch detected! Updating from ${user.weeklyXp} to ${correctXP}`);
        user.weeklyXp = correctXP;
        await user.save();
        console.log(`✅ Updated successfully!`);
      } else {
        console.log(`✓ XP is already correct, no update needed`);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All users processed successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing XP:', error);
    process.exit(1);
  }
}

// Run the script
fixWeeklyXP();
