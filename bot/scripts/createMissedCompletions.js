const mongoose = require('mongoose');
require('dotenv').config({ path: '../../.env' });

// MongoDB connection
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const { User, Completion, Task } = require('../database/models');

async function createMissedCompletions() {
  try {
    // Get Ethiopia time (UTC+3)
    const now = new Date();
    const offset = 3; // UTC+3 for Ethiopia
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const localNow = new Date(utc + (3600000 * offset));
    
    console.log(`🔧 Running script at: ${localNow.toISOString()}`);
    
    // Today (December 9) at 00:00
    const today = new Date(localNow);
    today.setHours(0, 0, 0, 0);
    
    // Yesterday (December 8) at 00:00
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    console.log(`\n🗓️ Yesterday: ${yesterday.toDateString()}`);
    
    // Find the tasks
    const prayingTask = await Task.findOne({ name: 'Praying' });
    const productiveTask = await Task.findOne({ name: 'Being Productive' });
    
    const users = await User.find();
    const lily = users.find(u => u.telegramId === '1362950195');
    const zen = users.find(u => u.telegramId === '5780476905');
    
    console.log(`\n👥 Users found:`);
    console.log(`   Lily (1362950195): ${lily ? '✓' : '✗'}`);
    console.log(`   Zen (5780476905): ${zen ? '✓' : '✗'}`);
    
    if (!prayingTask || !productiveTask || !lily || !zen) {
      console.error('❌ Could not find required tasks or users');
      return;
    }
    
    console.log(`\n📋 Tasks found:`);
    console.log(`   Praying: ${prayingTask._id}`);
    console.log(`   Being Productive: ${productiveTask._id}`);
    
    // Check current XP before penalties
    console.log(`\n💰 Current XP:`);
    console.log(`   Lily: ${lily.weeklyXp}`);
    console.log(`   Zen: ${zen.weeklyXp}`);
    
    // Create missed completion for Lily - Praying
    console.log(`\n📝 Creating missed completion for Lily - Praying...`);
    const lilyPrayingExists = await Completion.findOne({
      taskId: prayingTask._id,
      userId: lily.telegramId,
      scheduledFor: yesterday
    });
    
    if (lilyPrayingExists) {
      console.log(`   ⚠️ Completion already exists: ${lilyPrayingExists.completed ? 'Completed' : 'Missed'}`);
    } else {
      await Completion.create({
        taskId: prayingTask._id,
        userId: lily.telegramId,
        completed: false,
        xpPenalty: 0,
        streakCount: 0,
        missedConfirmation: true,
        completedAt: new Date(),
        scheduledFor: yesterday,
      });
      console.log(`   ✅ Created missed completion record`);
    }
    
    // Create missed completion for Zen - Being Productive
    console.log(`\n📝 Creating missed completion for Zen - Being Productive...`);
    const zenProductiveExists = await Completion.findOne({
      taskId: productiveTask._id,
      userId: zen.telegramId,
      scheduledFor: yesterday
    });
    
    if (zenProductiveExists) {
      console.log(`   ⚠️ Completion already exists: ${zenProductiveExists.completed ? 'Completed' : 'Missed'}`);
    } else {
      await Completion.create({
        taskId: productiveTask._id,
        userId: zen.telegramId,
        completed: false,
        xpPenalty: 0,
        streakCount: 0,
        missedConfirmation: true,
        completedAt: new Date(),
        scheduledFor: yesterday,
      });
      console.log(`   ✅ Created missed completion record`);
    }
    
    // Now apply differential penalty
    console.log(`\n⚖️ Applying differential penalty...`);
    const lilyMissed = 1; // Praying
    const zenMissed = 1;  // Being Productive
    
    if (lilyMissed === zenMissed) {
      console.log(`   ✓ Both missed equal tasks (${lilyMissed} each), no penalty applied`);
    } else {
      const diff = Math.abs(lilyMissed - zenMissed);
      const lowestXp = Math.min(lily.weeklyXp, zen.weeklyXp);
      const newXp = Math.max(0, lowestXp - (diff * 10));
      
      const penalizedUser = lilyMissed > zenMissed ? lily : zen;
      const beforeXp = penalizedUser.weeklyXp;
      penalizedUser.weeklyXp = newXp;
      await penalizedUser.save();
      
      console.log(`   💥 User ${penalizedUser.telegramId} penalized: ${beforeXp} → ${newXp}`);
      
      // Update penalty in completion record
      await Completion.updateOne(
        {
          taskId: lilyMissed > zenMissed ? prayingTask._id : productiveTask._id,
          userId: penalizedUser.telegramId,
          scheduledFor: yesterday,
          missedConfirmation: true
        },
        { $set: { xpPenalty: beforeXp - newXp } }
      );
    }
    
    // Delete any today's missed completions
    console.log(`\n🗑️ Cleaning up today's incorrect missed completions...`);
    const deleteResult = await Completion.deleteMany({
      missedConfirmation: true,
      scheduledFor: { $gte: today },
      completed: false
    });
    console.log(`   ✅ Deleted ${deleteResult.deletedCount} incorrect entries`);
    
    // Show final state
    const updatedLily = await User.findOne({ telegramId: lily.telegramId });
    const updatedZen = await User.findOne({ telegramId: zen.telegramId });
    
    console.log(`\n💰 Final XP:`);
    console.log(`   Lily: ${updatedLily.weeklyXp}`);
    console.log(`   Zen: ${updatedZen.weeklyXp}`);
    
    console.log(`\n✅ All fixes applied successfully!`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

createMissedCompletions();
