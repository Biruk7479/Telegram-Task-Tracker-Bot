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

const completionSchema = new mongoose.Schema({
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  userId: { type: String, required: true },
  completed: { type: Boolean, default: false },
  xpEarned: { type: Number, default: 0 },
  xpPenalty: { type: Number, default: 0 },
  streakCount: { type: Number, default: 0 },
  missedConfirmation: { type: Boolean, default: false },
  advanceCompletion: { type: Boolean, default: false },
  completedAt: { type: Date, default: Date.now },
  scheduledFor: { type: Date },
});

const Completion = mongoose.model('Completion', completionSchema);

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  xp: { type: Number, default: 0 },
  weeklyXp: { type: Number, default: 100 },
  level: { type: Number, default: 1 },
  streaks: { type: Map, of: Number, default: {} },
  lastCompletions: { type: Map, of: Date, default: {} },
  pendingRewards: [String],
  weekStartDate: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);

async function fixTodayMissedTasks() {
  try {
    // Get Ethiopia time (UTC+3)
    const now = new Date();
    const offset = 3; // UTC+3 for Ethiopia
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const localNow = new Date(utc + (3600000 * offset));
    
    console.log(`🔧 Running fix script at: ${localNow.toISOString()}`);
    console.log(`📅 Local date: ${localNow.toDateString()}`);
    
    // Today (December 9) at 00:00
    const today = new Date(localNow);
    today.setHours(0, 0, 0, 0);
    
    // Yesterday (December 8) at 00:00
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    console.log(`\n🗓️ Today: ${today.toDateString()}`);
    console.log(`🗓️ Yesterday: ${yesterday.toDateString()}`);
    
    // Find all missed completions that were incorrectly scheduled for today
    const incorrectCompletions = await Completion.find({
      missedConfirmation: true,
      scheduledFor: { $gte: today },
      completed: false
    }).populate('taskId');
    
    console.log(`\n❌ Found ${incorrectCompletions.length} incorrect missed completions for today`);
    
    if (incorrectCompletions.length > 0) {
      console.log('\n📋 Incorrect completions to delete:');
      for (const comp of incorrectCompletions) {
        console.log(`   - Task: ${comp.taskId?.name || 'Unknown'}`);
        console.log(`     User: ${comp.userId}`);
        console.log(`     Scheduled: ${comp.scheduledFor?.toDateString()}`);
        console.log(`     XP Penalty: ${comp.xpPenalty}`);
      }
      
      // Delete these incorrect entries
      const deleteResult = await Completion.deleteMany({
        missedConfirmation: true,
        scheduledFor: { $gte: today },
        completed: false
      });
      
      console.log(`\n✅ Deleted ${deleteResult.deletedCount} incorrect entries`);
    }
    
    // Now check what we should have had for yesterday
    console.log(`\n\n🔍 Checking what tasks were actually scheduled for yesterday (${yesterday.toDateString()})...`);
    
    const Task = mongoose.model('Task', new mongoose.Schema({
      name: String,
      description: String,
      type: String,
      schedule: {
        time: String,
        days: [Number],
        date: Date
      },
      xpReward: Number,
      active: Boolean,
      createdBy: String,
      assignedTo: [String],
      createdAt: Date
    }));
    
    const tasks = await Task.find({ active: true });
    const users = await User.find();
    
    console.log(`\n📊 Active tasks: ${tasks.length}`);
    console.log(`👥 Users: ${users.length}`);
    
    // Check which tasks were scheduled for yesterday
    const yesterdayDay = yesterday.getDay();
    console.log(`\n📅 Yesterday was day ${yesterdayDay} (0=Sun, 1=Mon, etc.)`);
    
    for (const task of tasks) {
      let wasScheduled = false;
      
      if (task.type === 'daily') {
        wasScheduled = true;
      } else if (task.type === 'weekly' || task.type === 'custom') {
        wasScheduled = task.schedule?.days?.includes(yesterdayDay);
      } else if (task.type === 'one-time' && task.schedule?.date) {
        const taskDate = new Date(task.schedule.date);
        const taskDateStr = taskDate.toDateString();
        const yesterdayStr = yesterday.toDateString();
        wasScheduled = taskDateStr === yesterdayStr;
      }
      
      if (wasScheduled) {
        console.log(`\n✓ "${task.name}" was scheduled for yesterday`);
        
        // Check if completion records exist
        for (const user of users) {
          if (task.assignedTo && task.assignedTo.length > 0 && !task.assignedTo.includes(user.telegramId)) {
            continue;
          }
          
          const deadline = new Date(today);
          deadline.setHours(6, 0, 0, 0);
          
          const completion = await Completion.findOne({
            taskId: task._id,
            userId: user.telegramId,
            completedAt: { $gte: yesterday, $lt: deadline }
          });
          
          if (!completion) {
            console.log(`   ⚠️ User ${user.telegramId} missing completion record for yesterday`);
            console.log(`      You may need to manually create a missed completion record`);
          } else {
            console.log(`   ✓ User ${user.telegramId}: ${completion.completed ? 'Completed' : 'Missed'}`);
          }
        }
      }
    }
    
    console.log('\n✅ Fix complete!');
    console.log('\n💡 Summary:');
    console.log('   - Deleted incorrect missed completions for today');
    console.log('   - Listed tasks that should have been checked for yesterday');
    console.log('   - You can now run the bot normally');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

fixTodayMissedTasks();
