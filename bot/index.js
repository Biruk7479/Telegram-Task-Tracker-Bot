const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const connectDB = require('./database/connection');
const { getOrCreateUser, recordCompletion, getUserStats, getLeaderboard } = require('./services/userService');
const { createTask, getActiveTasks, deleteTask, updateTask, getTasksDueNow, parseTime, parseDays, parseCustomDays, isTaskPastDeadline, isTaskScheduledForDate } = require('./services/taskService');
const { checkAndResetWeek, checkMissedConfirmations, handleWeekEnd } = require('./services/weeklyXpService');
const cron = require('node-cron');

// Connect to database
connectDB();

// Initialize bot
const bot = new TelegramBot(config.telegram.token, { polling: true });

console.log('Bot started successfully!');

// Store conversation states
const conversationStates = {};

// Helper function to create inline keyboard
const createYesNoKeyboard = (taskId, taskName) => {
  return {
    inline_keyboard: [
      [
        { text: '✅ Yes', callback_data: `complete_${taskId}_yes` },
        { text: '❌ No', callback_data: `complete_${taskId}_no` },
      ],
    ],
  };
};

// Helper function to format user mention
const mentionUser = (userId, username) => {
  return `@${username}`;
};

// Command: /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const username = msg.from.username || msg.from.first_name;
  
  // Create user if not exists
  await getOrCreateUser(userId, username);
  
  const welcomeMessage = `
🎯 *Welcome to Task Tracker Bot!*

I'll help you and your partner stay productive and accountable!

*Available Commands:*
/addtask - Create a new task
/bulkadd - Add multiple tasks at once
/edittask - Edit an existing task
/listtasks - View all active tasks
/deletetask - Remove a task
/markdone - Mark a task as completed in advance
/mystats - View your stats and XP
/leaderboard - Compare progress
/stop - Cancel current action
/help - Show this message

Let's build great habits together! 💪
  `;
  
  bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
});

// Command: /stop
bot.onText(/\/stop/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  if (conversationStates[userId]) {
    delete conversationStates[userId];
    bot.sendMessage(chatId, '✅ Action cancelled. You can start a new command anytime!');
  } else {
    bot.sendMessage(chatId, 'ℹ️ No active action to cancel.');
  }
});

// Command: /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  
  const helpMessage = `
📚 *How to use Task Tracker Bot*
━━━━━━━━━━━━━━━━

*Creating Tasks*
Use /addtask and follow the prompts to create daily, weekly, or flexible tasks.
Use /bulkadd to add multiple tasks at once using a simple format.

*Task Types*
• *Daily* - Repeats every day at a specific time
• *Weekly* - Repeats on specific days at a specific time
• *Flexible* - No schedule, check in manually

*Tracking Progress*
When it's time to complete a task, I'll ask both of you if you completed it. Reply with Yes or No.

*Gamification Rules*
• *XP System*: Start with 100 XP each week.
• *Penalty*: Lose 10 XP for every missed task.
• *Winner*: The person with the most XP at the end of the week (Monday) wins!
• *Loser*: The person with less XP must complete a *Penalty Task*.

*Other Commands*
• /addtask - Create a new task
• /bulkadd - Add multiple tasks at once
• /edittask - Edit an existing task (name, time, schedule, description, date)
• /markdone - Mark a task as completed in advance (no confirmation needed)
• /listtasks - View all active tasks
• /deletetask - Remove a task
• /stop - Cancel any ongoing action
• /mystats - Check your current XP and Level
• /leaderboard - See who is winning this week

*Website*
[View Dashboard](https://aj-and-lis-task-tracker.vercel.app/)

💡 _Tip: Use /markdone to complete tasks ahead of time!_
  `;
  
  bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

// Command: /getchatid - Helper to get the current chat ID
bot.onText(/\/getchatid/, (msg) => {
  const chatId = msg.chat.id;
  const chatType = msg.chat.type;
  
  bot.sendMessage(chatId, `
📋 *Chat Information:*

Chat ID: \`${chatId}\`
Chat Type: ${chatType}

${chatType === 'group' || chatType === 'supergroup' ? '✅ This is a group chat. Use this ID in your .env file as TELEGRAM_GROUP_CHAT_ID' : '⚠️ This is not a group chat.'}
  `, { parse_mode: 'Markdown' });
});

// Command: /testweek (Debug command to force end of week)
bot.onText(/\/testweek/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  try {
    // Get user to pass to handleWeekEnd
    const user = await getOrCreateUser(userId, msg.from.username);
    const result = await handleWeekEnd(user);
    
    if (result) {
      let message = '📅 *Weekly Report*\n';
      message += '━━━━━━━━━━━━━━━━\n\n';
      
      if (result.bothPerfect) {
        message += '🌟 *AMAZING!* Both of you maintained 100 XP this week!\n';
        message += '💪 You both leveled up! Keep up the great work!\n';
      } else if (result.isTie) {
        message += '🤝 *It\'s a Tie!* Both of you have the same XP!\n';
        message += `🔥 Score: \`${result.winnerXp}\` XP\n\n`;
        message += '💪 You both leveled up! Keep pushing each other!\n';
      } else {
        message += `🎉🏆 *WINNER: ${result.winner}* 🏆🎉\n`;
        message += `🔥 Score: \`${result.winnerXp}\` XP\n\n`;
        
        message += `📉 *Runner-up: ${result.loser}*\n`;
        message += `💀 Score: \`${result.loserXp}\` XP\n\n`;
        
        message += `🚨 *PENALTY TASK* 🚨\n`;
        message += `"${result.reward}"\n\n`;
        message += '😈 _Better luck next week!_\n';
      }
      
      message += '\n_Weekly XP has been reset to 100._';
      
      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, '❌ Could not generate weekly report. Make sure both users exist.');
    }
  } catch (error) {
    console.error('Error in testweek:', error);
    bot.sendMessage(chatId, '❌ Error running test week.');
  }
});

// Command: /addtask
bot.onText(/\/addtask/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  conversationStates[userId] = { step: 'task_name' };
  
  bot.sendMessage(chatId, '📝 What should we call this task?\n\nExample: "Morning Prayer", "Workout", "Read for 30 mins"');
});

// Command: /bulkadd
bot.onText(/\/bulkadd/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  const instructionMessage = `📋 *Bulk Add Tasks*

Send tasks in this format (one per line):

\`\`\`
Name | Description | Type | Time | Days | AssignedTo
\`\`\`

*Format Guide:*
• *Name*: Task name (required)
• *Description*: Task details (use "skip" if none)
• *Type*: daily, weekly, custom, one-time, flexible
• *Time*: HH:MM format (e.g., 7:00, 14:30) - skip for flexible
• *Days*: For weekly/custom: Mon,Wed,Fri or M,W,F - For one-time: YYYY-MM-DD - skip for daily/flexible
• *AssignedTo*: me, partner, both

*Examples:*

\`Morning Prayer | Start the day right | daily | 7:00 | skip | both\`

\`Gym | Workout session | weekly | 18:00 | Mon,Wed,Fri | me\`

\`Study Python | Learn for 1 hour | custom | 20:00 | M,W,F | both\`

\`Doctor Appointment | Annual checkup | one-time | 10:00 | 2025-12-25 | me\`

\`Read Book | Flexible reading time | flexible | skip | skip | partner\`

━━━━━━━━━━━━━━━━

Send multiple tasks (one per line), or type /stop to cancel.`;

  conversationStates[userId] = { step: 'bulk_add_tasks' };
  
  bot.sendMessage(chatId, instructionMessage, { parse_mode: 'Markdown' });
});

// Command: /listtasks
bot.onText(/\/listtasks/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    const tasks = await getActiveTasks();
    
    if (tasks.length === 0) {
      bot.sendMessage(chatId, '📋 No tasks yet! Use /addtask to create your first task.');
      return;
    }
    
    let message = '📋 *Active Tasks:*\n\n';
    
    for (const task of tasks) {
      message += `*${task.name}*\n`;
      if (task.description) {
        message += `${task.description}\n`;
      }
      message += `Type: ${task.type}\n`;
      
      if (task.type === 'daily' && task.schedule.time) {
        message += `Time: ${task.schedule.time}\n`;
      } else if (task.type === 'weekly' && task.schedule.time && task.schedule.days) {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const days = task.schedule.days.map(d => dayNames[d]).join(', ');
        message += `Days: ${days}\nTime: ${task.schedule.time}\n`;
      }
            message += `ID: \`${task._id}\`\n\n`;
    }
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error listing tasks:', error);
    bot.sendMessage(chatId, '❌ Error loading tasks. Please try again.');
  }
});

// Command: /deletetask
bot.onText(/\/deletetask/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    const tasks = await getActiveTasks();
    
    if (tasks.length === 0) {
      bot.sendMessage(chatId, '📋 No tasks to delete!');
      return;
    }
    
    let message = '🗑 *Select a task to delete:*\n\n';
    message += 'Reply with the task ID:\n\n';
    
    for (const task of tasks) {
      message += `• ${task.name} - \`${task._id}\`\n`;
    }
    
    conversationStates[msg.from.id.toString()] = { step: 'delete_task' };
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error deleting task:', error);
    bot.sendMessage(chatId, '❌ Error loading tasks. Please try again.');
  }
});

// Command: /markdone
bot.onText(/\/markdone/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  try {
    const tasks = await getActiveTasks();
    
    if (tasks.length === 0) {
      bot.sendMessage(chatId, '📋 No tasks available to mark as done!');
      return;
    }
    
    // Filter tasks assigned to this user
    const userTasks = tasks.filter(task => 
      task.assignedTo.includes(userId)
    );
    
    if (userTasks.length === 0) {
      bot.sendMessage(chatId, '📋 No tasks assigned to you!');
      return;
    }
    
    let message = '✅ *Mark Task as Done*\n\n';
    message += 'Select a task to mark as completed:\n\n';
    
    const keyboard = userTasks.map(task => {
      let scheduleInfo = '';
      if (task.type === 'daily' && task.schedule?.time) {
        scheduleInfo = ` (${task.schedule.time})`;
      } else if (task.type === 'weekly' && task.schedule?.time) {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const days = task.schedule.days?.map(d => dayNames[d]).join(', ') || '';
        scheduleInfo = ` (${days} at ${task.schedule.time})`;
      } else if (task.type === 'one-time' && task.schedule?.date) {
        scheduleInfo = ` (${task.schedule.date.toISOString().split('T')[0]})`;
      }
      
      return [{
        text: `${task.name}${scheduleInfo}`,
        callback_data: `markdone_${task._id}`
      }];
    });
    
    bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });
  } catch (error) {
    console.error('Error in /markdone:', error);
    bot.sendMessage(chatId, '❌ Error loading tasks. Please try again.');
  }
});

// Command: /edittask
bot.onText(/\/edittask/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  try {
    const tasks = await getActiveTasks();
    
    if (tasks.length === 0) {
      bot.sendMessage(chatId, '📋 No tasks to edit!');
      return;
    }
    
    let message = '✏️ *Select a task to edit:*\n\n';
    message += 'Reply with the task ID:\n\n';
    
    for (const task of tasks) {
      let scheduleInfo = '';
      if (task.type === 'daily' && task.schedule?.time) {
        scheduleInfo = ` (${task.schedule.time})`;
      } else if (task.type === 'weekly' && task.schedule?.time) {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const days = task.schedule.days?.map(d => dayNames[d]).join(', ') || '';
        scheduleInfo = ` (${days} at ${task.schedule.time})`;
      }
      message += `• ${task.name}${scheduleInfo} - \`${task._id}\`\n`;
    }
    
    conversationStates[userId] = { step: 'edit_task_select' };
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error listing tasks for edit:', error);
    bot.sendMessage(chatId, '❌ Error loading tasks. Please try again.');
  }
});

// Command: /mystats
bot.onText(/\/mystats/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  try {
    const stats = await getUserStats(userId);
    
    if (!stats) {
      bot.sendMessage(chatId, '❌ User not found. Use /start first!');
      return;
    }
    
    let message = `📊 *Stats for ${stats.username}*\n`;
    message += `━━━━━━━━━━━━━━━━\n\n`;
    
    message += `⭐ *Level ${stats.level}*\n`;
    message += `Total XP: \`${stats.xp}\`\n`;
    message += `Weekly XP: \`${stats.weeklyXp}\` / \`100\`\n`;
    message += `Tasks Done: \`${stats.totalTasksCompleted}\`\n\n`;
    
    if (Object.keys(stats.activeStreaks).length > 0) {
      message += `🔥 *Active Streaks*\n`;
      for (const [taskName, streak] of Object.entries(stats.activeStreaks)) {
        message += `• ${taskName}: \`${streak}\` days\n`;
      }
    } else {
      message += '💡 _Complete tasks daily to build streaks!_\n';
    }
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error getting stats:', error);
    bot.sendMessage(chatId, '❌ Error loading stats. Please try again.');
  }
});

// Command: /leaderboard
bot.onText(/\/leaderboard/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    const leaderboard = await getLeaderboard();
    
    if (leaderboard.length === 0) {
      bot.sendMessage(chatId, '📊 No users yet!');
      return;
    }
    
    let message = '🏆 *Leaderboard*\n';
    message += '━━━━━━━━━━━━━━━━\n\n';
    
    const medals = ['🥇', '🥈', '🥉'];
    
    leaderboard.forEach((user, index) => {
      const medal = medals[index] || '▪️';
      message += `${medal} *${user.username}*\n`;
      message += `   Weekly: \`${user.weeklyXp}\` / \`100\` XP\n`;
      message += `   Level: \`${user.level}\`\n\n`;
    });
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    bot.sendMessage(chatId, '❌ Error loading leaderboard. Please try again.');
  }
});

// Handle conversation flow for adding tasks
bot.on('message', async (msg) => {
  const userId = msg.from.id.toString();
  const chatId = msg.chat.id;
  const text = msg.text;
  
  if (!text || text.startsWith('/')) return;
  
  const state = conversationStates[userId];
  if (!state) return;
  
  try {
    switch (state.step) {
      case 'bulk_add_tasks':
        // Parse bulk task input
        const lines = text.trim().split('\n').filter(line => line.trim());
        const results = { success: [], failed: [] };
        
        for (const line of lines) {
          try {
            const parts = line.split('|').map(p => p.trim());
            
            if (parts.length < 6) {
              results.failed.push({ line, reason: 'Invalid format - needs 6 parts separated by |' });
              continue;
            }
            
            const [name, description, type, time, days, assignedTo] = parts;
            
            // Validate task type
            const validTypes = ['daily', 'weekly', 'custom', 'one-time', 'flexible'];
            if (!validTypes.includes(type.toLowerCase())) {
              results.failed.push({ line, reason: `Invalid type "${type}" - must be: daily, weekly, custom, one-time, or flexible` });
              continue;
            }
            
            // Parse assigned to
            let assignedToIds = [];
            const assignedToLower = assignedTo.toLowerCase();
            if (assignedToLower === 'me') {
              assignedToIds = [userId];
            } else if (assignedToLower === 'partner') {
              assignedToIds = [userId === config.users.user1.id ? config.users.user2.id : config.users.user1.id];
            } else if (assignedToLower === 'both') {
              assignedToIds = [config.users.user1.id, config.users.user2.id];
            } else {
              results.failed.push({ line, reason: `Invalid assignedTo "${assignedTo}" - must be: me, partner, or both` });
              continue;
            }
            
            // Build schedule object
            const schedule = {};
            const taskType = type.toLowerCase();
            
            // Parse time if not skip
            if (time.toLowerCase() !== 'skip' && taskType !== 'flexible') {
              const parsedTime = parseTime(time);
              if (!parsedTime) {
                results.failed.push({ line, reason: `Invalid time format "${time}" - use HH:MM (e.g., 7:00)` });
                continue;
              }
              schedule.time = parsedTime.formatted;
            }
            
            // Parse days/date based on task type
            if (taskType === 'weekly' || taskType === 'custom') {
              if (days.toLowerCase() !== 'skip') {
                const parsedDays = parseDays(days) || parseCustomDays(days);
                if (!parsedDays) {
                  results.failed.push({ line, reason: `Invalid days format "${days}" - use Mon,Wed,Fri or M,W,F` });
                  continue;
                }
                schedule.days = parsedDays;
              } else {
                results.failed.push({ line, reason: `${taskType} tasks require days - cannot skip` });
                continue;
              }
            } else if (taskType === 'one-time') {
              if (days.toLowerCase() !== 'skip') {
                const dateMatch = days.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                if (!dateMatch) {
                  results.failed.push({ line, reason: `Invalid date format "${days}" - use YYYY-MM-DD` });
                  continue;
                }
                const [year, month, day] = days.split('-').map(Number);
                const taskDate = new Date(year, month - 1, day);
                taskDate.setHours(12, 0, 0, 0);
                if (isNaN(taskDate.getTime())) {
                  results.failed.push({ line, reason: `Invalid date "${days}"` });
                  continue;
                }
                schedule.date = taskDate;
              } else {
                results.failed.push({ line, reason: 'One-time tasks require a date - cannot skip' });
                continue;
              }
            }
            
            // Create the task
            const task = await createTask(
              name,
              description.toLowerCase() === 'skip' ? '' : description,
              taskType,
              schedule,
              userId,
              10,
              assignedToIds
            );
            
            results.success.push(task.name);
          } catch (error) {
            results.failed.push({ line, reason: error.message });
          }
        }
        
        // Send results
        let resultMessage = '📊 *Bulk Add Results*\n━━━━━━━━━━━━━━━━\n\n';
        
        if (results.success.length > 0) {
          resultMessage += `✅ *Successfully Created (${results.success.length}):*\n`;
          results.success.forEach(name => {
            resultMessage += `• ${name}\n`;
          });
          resultMessage += '\n';
        }
        
        if (results.failed.length > 0) {
          resultMessage += `❌ *Failed (${results.failed.length}):*\n`;
          results.failed.forEach(({ line, reason }) => {
            resultMessage += `• ${reason}\n  _${line.substring(0, 50)}${line.length > 50 ? '...' : ''}_\n`;
          });
        }
        
        if (results.success.length === 0 && results.failed.length === 0) {
          resultMessage += '⚠️ No valid tasks found. Please check the format and try again.';
        }
        
        bot.sendMessage(chatId, resultMessage, { parse_mode: 'Markdown' });
        delete conversationStates[userId];
        break;
        
      case 'task_name':
        state.taskData = { name: text };
        state.step = 'task_description';
        bot.sendMessage(chatId, '📄 Add a description (or type "skip"):');
        break;
        
      case 'task_description':
        state.taskData.description = text.toLowerCase() === 'skip' ? '' : text;
        state.step = 'task_assignment';
        bot.sendMessage(chatId, '👥 Who should do this task?', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '👤 Just me', callback_data: 'assign_me' }],
              [{ text: '👥 Just my partner', callback_data: 'assign_partner' }],
              [{ text: '👫 Both of us', callback_data: 'assign_both' }]
            ]
          }
        });
        break;
        
      case 'task_assignment':
        const assignmentMap = {
          '1': [userId], // just me
          '2': [userId === config.users.user1.id ? config.users.user2.id : config.users.user1.id], // just partner
          '3': [config.users.user1.id, config.users.user2.id] // both
        };
        
        const assignment = assignmentMap[text];
        if (!assignment) {
          bot.sendMessage(chatId, '❌ Invalid choice. Please reply with 1, 2, or 3:');
          return;
        }
        
        state.taskData.assignedTo = assignment;
        state.step = 'task_type';
        bot.sendMessage(chatId, '📅 What type of task?', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📅 Daily', callback_data: 'type_daily' }],
              [{ text: '📆 Weekly', callback_data: 'type_weekly' }],
              [{ text: '🗓️ Custom', callback_data: 'type_custom' }],
              [{ text: '📌 One-time', callback_data: 'type_onetime' }],
              [{ text: '🔄 Flexible', callback_data: 'type_flexible' }]
            ]
          }
        });
        break;
        
      case 'task_type':
        const typeMap = { '1': 'daily', '2': 'weekly', '3': 'custom', '4': 'one-time', '5': 'flexible' };
        const taskType = typeMap[text];
        
        if (!taskType) {
          bot.sendMessage(chatId, '❌ Invalid choice. Please reply with 1, 2, 3, 4, or 5:');
          return;
        }
        
        state.taskData.type = taskType;
        
        if (taskType === 'flexible') {
          // Flexible tasks don't need schedule
          const task = await createTask(
            state.taskData.name,
            state.taskData.description,
            state.taskData.type,
            {},
            userId,
            10,
            state.taskData.assignedTo
          );
          
          let confirmMessage = `✅ *Task Created*\n`;
          confirmMessage += `━━━━━━━━━━━━━━━━\n`;
          confirmMessage += `*${task.name}*\n`;
          if (task.description) confirmMessage += `_${task.description}_\n`;
          confirmMessage += `Type: \`${task.type}\`\n`;
          confirmMessage += `Assigned: \`${state.taskData.assignedTo.length === 2 ? 'Both' : (state.taskData.assignedTo[0] === config.users.user1.id ? config.users.user1.name : config.users.user2.name)}\`\n`;
          
          bot.sendMessage(chatId, confirmMessage, { parse_mode: 'Markdown' });
          delete conversationStates[userId];
        } else if (taskType === 'one-time') {
          state.step = 'task_date';
          bot.sendMessage(chatId, '📆 What date? (format: YYYY-MM-DD)\n\nExample: "2025-12-25"');
        } else if (taskType === 'custom') {
          state.step = 'task_custom_days';
          bot.sendMessage(chatId, '📅 Which days? Type day abbreviations separated by commas.\n\nExamples:\n• "M,W,F" for Mon, Wed, Fri\n• "M,T,Th" for Mon, Tue, Thu\n\nDay codes: M=Mon, T=Tue, W=Wed, Th=Thu, F=Fri, S=Sat, Su=Sun');
        } else {
          state.step = 'task_time';
          bot.sendMessage(chatId, '⏰ What time should this task be checked?\n\nExample: "7:00" or "14:30"');
        }
        break;
        
      case 'task_time':
        const time = parseTime(text);
        
        if (!time) {
          bot.sendMessage(chatId, '❌ Invalid time format. Please use HH:MM format (e.g., "7:00" or "14:30"):');
          return;
        }
        
        if (!state.taskData.schedule) {
          state.taskData.schedule = {};
        }
        state.taskData.schedule.time = time.formatted;
        
        if (state.taskData.type === 'weekly') {
          state.step = 'task_days';
          bot.sendMessage(chatId, '📆 Which days? (e.g., "Mon,Wed,Fri" or "1,3,5")\n\n0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat');
        } else {
          // Daily or custom task - create immediately with 10 XP
          const newTask = await createTask(
            state.taskData.name,
            state.taskData.description,
            state.taskData.type,
            state.taskData.schedule,
            userId,
            10,
            state.taskData.assignedTo
          );
          
          let confirmMessage = `✅ *Task Created*\n`;
          confirmMessage += `━━━━━━━━━━━━━━━━\n`;
          confirmMessage += `*${newTask.name}*\n`;
          if (newTask.description) confirmMessage += `_${newTask.description}_\n\n`;
          confirmMessage += `Type: \`${newTask.type}\`\n`;
          if (newTask.schedule.time) confirmMessage += `Time: \`${newTask.schedule.time}\`\n`;
          if (newTask.schedule.days) {
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const dayList = newTask.schedule.days.map(d => dayNames[d]).join(', ');
            confirmMessage += `Days: \`${dayList}\`\n`;
          }
          if (newTask.schedule.date) {
            confirmMessage += `Date: \`${newTask.schedule.date.toISOString().split('T')[0]}\`\n`;
          }
          confirmMessage += `Assigned: \`${state.taskData.assignedTo.length === 2 ? 'Both' : (state.taskData.assignedTo[0] === config.users.user1.id ? config.users.user1.name : config.users.user2.name)}\`\n`;
          
          bot.sendMessage(chatId, confirmMessage, { parse_mode: 'Markdown' });
          delete conversationStates[userId];
        }
        break;
        
      case 'task_days':
        const days = parseDays(text);
        
        if (!days) {
          bot.sendMessage(chatId, '❌ Invalid days format. Please try again (e.g., "Mon,Wed,Fri" or "1,3,5"):');
          return;
        }
        
        state.taskData.schedule.days = days;
        
        // Create task with fixed 10 XP
        const weeklyTask = await createTask(
          state.taskData.name,
          state.taskData.description,
          state.taskData.type,
          state.taskData.schedule,
          userId,
          10,
          state.taskData.assignedTo
        );
        
        let weeklyMessage = `✅ *Task Created*\n`;
        weeklyMessage += `━━━━━━━━━━━━━━━━\n\n`;
        weeklyMessage += `*${weeklyTask.name}*\n`;
        if (weeklyTask.description) weeklyMessage += `_${weeklyTask.description}_\n`;
        weeklyMessage += `Type: \`${weeklyTask.type}\`\n`;
        if (weeklyTask.schedule.time) weeklyMessage += `Time: \`${weeklyTask.schedule.time}\`\n`;
        if (weeklyTask.schedule.days) {
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const dayList = weeklyTask.schedule.days.map(d => dayNames[d]).join(', ');
          weeklyMessage += `Days: \`${dayList}\`\n`;
        }
        weeklyMessage += `Assigned: \`${state.taskData.assignedTo.length === 2 ? 'Both' : (state.taskData.assignedTo[0] === config.users.user1.id ? config.users.user1.name : config.users.user2.name)}\`\n`;
        
        bot.sendMessage(chatId, weeklyMessage, { parse_mode: 'Markdown' });
        delete conversationStates[userId];
        break;
        
      case 'task_custom_days':
        const customDays = parseCustomDays(text);
        
        if (!customDays) {
          bot.sendMessage(chatId, '❌ Invalid format. Please use day abbreviations like "M,W,F" or "M,T,Th":');
          return;
        }
        
        state.taskData.schedule = { days: customDays };
        state.step = 'task_time';
        bot.sendMessage(chatId, '⏰ What time should this task be checked?\n\nExample: "7:00" or "14:30"');
        break;
        
      case 'task_date':
        const dateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!dateMatch) {
          bot.sendMessage(chatId, '❌ Invalid date format. Please use YYYY-MM-DD format (e.g., "2025-12-25"):');
          return;
        }

        const [year, month, day] = text.split('-').map(Number);
        const taskDate = new Date(year, month - 1, day);
        taskDate.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
        if (isNaN(taskDate.getTime())) {
          bot.sendMessage(chatId, '❌ Invalid date. Please use a valid date in YYYY-MM-DD format:');
          return;
        }

        state.taskData.schedule = { date: taskDate };
        state.step = 'task_time';
        bot.sendMessage(chatId, '⏰ What time should this task be checked?\n\nExample: "7:00" or "14:30"');
        break;

        
      case 'delete_task':
        const deleted = await deleteTask(text.trim());
        
        if (deleted) {
          bot.sendMessage(chatId, '✅ Task deleted successfully!');
        } else {
          bot.sendMessage(chatId, '❌ Task not found. Please check the ID and try again.');
        }
        
        delete conversationStates[userId];
        break;
        
      case 'edit_task_select':
        const { getTaskById } = require('./services/taskService');
        const taskToEdit = await getTaskById(text.trim());
        
        if (!taskToEdit) {
          bot.sendMessage(chatId, '❌ Task not found. Please check the ID and try again.');
          delete conversationStates[userId];
          return;
        }
        
        state.editTaskId = text.trim();
        state.editTaskType = taskToEdit.type;
        state.editTaskData = {
          name: taskToEdit.name,
          description: taskToEdit.description,
          schedule: taskToEdit.schedule || {}
        };
        
        // Create dynamic keyboard based on task type
        const editButtons = [
          [{ text: '📝 Task Name', callback_data: 'edit_name' }],
          [{ text: '📄 Description', callback_data: 'edit_description' }]
        ];
        
        if (taskToEdit.type === 'one-time') {
          editButtons.push([{ text: '📆 Date', callback_data: 'edit_date' }]);
          editButtons.push([{ text: '⏰ Time', callback_data: 'edit_time' }]);
        } else if (taskToEdit.type === 'daily') {
          editButtons.push([{ text: '⏰ Time', callback_data: 'edit_time' }]);
        } else if (taskToEdit.type === 'weekly' || taskToEdit.type === 'custom') {
          editButtons.push([{ text: '⏰ Time', callback_data: 'edit_time' }]);
          editButtons.push([{ text: '📅 Days/Schedule', callback_data: 'edit_schedule' }]);
        }
        
        editButtons.push([{ text: '✅ Done Editing', callback_data: 'edit_done' }]);
        
        bot.sendMessage(chatId, '✏️ What would you like to edit?', {
          reply_markup: { inline_keyboard: editButtons }
        });
        break;
        
      case 'edit_task_name':
        state.editTaskData.name = text;
        bot.sendMessage(chatId, '✅ Name updated! What else would you like to edit?', {
          reply_markup: {
            inline_keyboard: _getEditButtons(state.editTaskType)
          }
        });
        state.step = 'edit_task_select';
        break;
        
      case 'edit_task_description':
        state.editTaskData.description = text.toLowerCase() === 'skip' ? '' : text;
        bot.sendMessage(chatId, '✅ Description updated! What else would you like to edit?', {
          reply_markup: {
            inline_keyboard: _getEditButtons(state.editTaskType)
          }
        });
        state.step = 'edit_task_select';
        break;
        
      case 'edit_task_time':
        const newTime = parseTime(text);
        if (!newTime) {
          bot.sendMessage(chatId, '❌ Invalid time format. Please use HH:MM format (e.g., "7:00" or "14:30"):');
          return;
        }
        
        state.editTaskData.schedule.time = newTime.formatted;
        bot.sendMessage(chatId, '✅ Time updated! What else would you like to edit?', {
          reply_markup: {
            inline_keyboard: _getEditButtons(state.editTaskType)
          }
        });
        state.step = 'edit_task_select';
        break;
        
      case 'edit_task_date':
        const editDateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!editDateMatch) {
          bot.sendMessage(chatId, '❌ Invalid date format. Please use YYYY-MM-DD format (e.g., "2025-12-25"):');
          return;
        }

        const [editYear, editMonth, editDay] = text.split('-').map(Number);
        const newDate = new Date(editYear, editMonth - 1, editDay);
        newDate.setHours(12, 0, 0, 0);
        
        if (isNaN(newDate.getTime())) {
          bot.sendMessage(chatId, '❌ Invalid date. Please use a valid date in YYYY-MM-DD format:');
          return;
        }

        state.editTaskData.schedule.date = newDate;
        bot.sendMessage(chatId, '✅ Date updated! What else would you like to edit?', {
          reply_markup: {
            inline_keyboard: _getEditButtons(state.editTaskType)
          }
        });
        state.step = 'edit_task_select';
        break;
        
      case 'edit_task_schedule':
        const newDays = parseDays(text) || parseCustomDays(text);
        if (!newDays) {
          bot.sendMessage(chatId, '❌ Invalid format. Please try again (e.g., "Mon,Wed,Fri" or "M,W,F"):');
          return;
        }
        
        state.editTaskData.schedule.days = newDays;
        bot.sendMessage(chatId, '✅ Schedule updated! What else would you like to edit?', {
          reply_markup: {
            inline_keyboard: _getEditButtons(state.editTaskType)
          }
        });
        state.step = 'edit_task_select';
        break;
    }
  } catch (error) {
    console.error('Error in conversation flow:', error);
    bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
    delete conversationStates[userId];
  }
});

// Helper function to generate edit buttons based on task type
function _getEditButtons(taskType) {
  const buttons = [
    [{ text: '📝 Task Name', callback_data: 'edit_name' }],
    [{ text: '📄 Description', callback_data: 'edit_description' }]
  ];
  
  if (taskType === 'one-time') {
    buttons.push([{ text: '📆 Date', callback_data: 'edit_date' }]);
    buttons.push([{ text: '⏰ Time', callback_data: 'edit_time' }]);
  } else if (taskType === 'daily') {
    buttons.push([{ text: '⏰ Time', callback_data: 'edit_time' }]);
  } else if (taskType === 'weekly' || taskType === 'custom') {
    buttons.push([{ text: '⏰ Time', callback_data: 'edit_time' }]);
    buttons.push([{ text: '📅 Days/Schedule', callback_data: 'edit_schedule' }]);
  }
  
  buttons.push([{ text: '✅ Done Editing', callback_data: 'edit_done' }]);
  return buttons;
}

// Handle callback queries (Yes/No buttons and inline selections)
bot.on('callback_query', async (query) => {
  const data = query.data;
  const chatId = query.message.chat.id;
  const userId = query.from.id.toString();
  const username = query.from.username || query.from.first_name;
  
  // Handle markdone callbacks
  if (data.startsWith('markdone_')) {
    const taskId = data.replace('markdone_', '');
    
    try {
      const { Task } = require('./database/models');
      const task = await Task.findById(taskId);
      
      if (!task) {
        bot.answerCallbackQuery(query.id, {
          text: '❌ Task not found!',
          show_alert: true
        });
        return;
      }
      
      // Check if task is past deadline
      if (isTaskPastDeadline(task)) {
        bot.answerCallbackQuery(query.id, {
          text: '⏰ Time has passed for this task. You can only mark tasks as done on their scheduled day!',
          show_alert: true
        });
        
        bot.editMessageText('❌ This task is past its deadline and cannot be marked as done.', {
          chat_id: chatId,
          message_id: query.message.message_id
        });
        return;
      }
      
      await getOrCreateUser(userId, username);
      const result = await recordCompletion(taskId, userId, true, true); // Pass true for advance completion
      
      bot.editMessageText('✓ Task marked as done!', {
        chat_id: chatId,
        message_id: query.message.message_id
      });
      
      let responseMessage = `✅ <b>Task Completed in Advance</b>\n`;
      responseMessage += `━━━━━━━━━━━━━━━━\n`;
      responseMessage += `Task: <b>${result.taskName || 'Task'}</b>\n`;
      responseMessage += `User: <b>${username}</b>\n\n`;
      
      responseMessage += `<b>Status</b>\n`;
      responseMessage += `✓ Marked as completed!\n`;
      
      if (result.streakCount > 1) {
        responseMessage += `Streak: <code>${result.streakCount}</code> days 🔥\n`;
      }
      
      responseMessage += `\n<i>Great job being proactive! You won\'t be asked for confirmation.</i> 💪`;
      
      bot.sendMessage(chatId, responseMessage, { parse_mode: 'HTML' });
      bot.answerCallbackQuery(query.id);
    } catch (error) {
      console.error('Error marking task done:', error);
      bot.answerCallbackQuery(query.id, { text: 'Error marking task as done' });
    }
    return;
  }
  
  // Handle task assignment buttons
  if (data.startsWith('assign_')) {
    const state = conversationStates[userId];
    if (!state) {
      bot.answerCallbackQuery(query.id, { text: 'Session expired. Please start over with /addtask' });
      return;
    }
    
    const assignmentMap = {
      'assign_me': [userId],
      'assign_partner': [userId === config.users.user1.id ? config.users.user2.id : config.users.user1.id],
      'assign_both': [config.users.user1.id, config.users.user2.id]
    };
    
    state.taskData.assignedTo = assignmentMap[data];
    state.step = 'task_type';
    
    bot.editMessageText('✓ Assignment set!', {
      chat_id: chatId,
      message_id: query.message.message_id
    });
    
    bot.sendMessage(chatId, '📅 What type of task?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📅 Daily', callback_data: 'type_daily' }],
          [{ text: '📆 Weekly', callback_data: 'type_weekly' }],
          [{ text: '🗓️ Custom', callback_data: 'type_custom' }],
          [{ text: '📌 One-time', callback_data: 'type_onetime' }],
          [{ text: '🔄 Flexible', callback_data: 'type_flexible' }]
        ]
      }
    });
    
    bot.answerCallbackQuery(query.id);
    return;
  }
  
  // Handle task type buttons
  if (data.startsWith('type_')) {
    const state = conversationStates[userId];
    if (!state) {
      bot.answerCallbackQuery(query.id, { text: 'Session expired. Please start over with /addtask' });
      return;
    }
    
    const typeMap = {
      'type_daily': 'daily',
      'type_weekly': 'weekly',
      'type_custom': 'custom',
      'type_onetime': 'one-time',
      'type_flexible': 'flexible'
    };
    
    const taskType = typeMap[data];
    state.taskData.type = taskType;
    
    bot.editMessageText('✓ Task type selected!', {
      chat_id: chatId,
      message_id: query.message.message_id
    });
    
    if (taskType === 'flexible') {
      const task = await createTask(
        state.taskData.name,
        state.taskData.description,
        state.taskData.type,
        {},
        userId,
        10,
        state.taskData.assignedTo
      );
      
      let confirmMessage = `✅ *Task Created*\\n`;
      confirmMessage += `━━━━━━━━━━━━━━━━\\n`;
      confirmMessage += `*${task.name}*\\n`;
      if (task.description) confirmMessage += `_${task.description}_\\n`;
      confirmMessage += `Type: \`${task.type}\`\\n`;
      confirmMessage += `Assigned: \`${state.taskData.assignedTo.length === 2 ? 'Both' : (state.taskData.assignedTo[0] === config.users.user1.id ? config.users.user1.name : config.users.user2.name)}\`\\n\\n`;
      confirmMessage += `[View Dashboard](${websiteUrl})`;
      
      bot.sendMessage(chatId, confirmMessage, { parse_mode: 'Markdown' });
      delete conversationStates[userId];
    } else if (taskType === 'one-time') {
      state.step = 'task_date';
      bot.sendMessage(chatId, '📆 What date? (format: YYYY-MM-DD)\\n\\nExample: \"2025-12-25\"');
    } else if (taskType === 'custom') {
      state.step = 'task_custom_days';
      bot.sendMessage(chatId, '📅 Which days? Type day abbreviations separated by commas.\n\nExamples:\n• "M,W,F" for Mon, Wed, Fri\n• "M,T,Th" for Mon, Tue, Thu\n\nDay codes: M=Mon, T=Tue, W=Wed, Th=Thu, F=Fri, S=Sat, Su=Sun');
    } else {
      state.step = 'task_time';
      bot.sendMessage(chatId, '⏰ What time should this task be checked?\\n\\nExample: \"7:00\" or \"14:30\"');
    }
    
    bot.answerCallbackQuery(query.id);
    return;
  }
  
  // Handle edit task buttons
  if (data.startsWith('edit_')) {
    const state = conversationStates[userId];
    if (!state) {
      bot.answerCallbackQuery(query.id, { text: 'Session expired. Please start over with /edittask' });
      return;
    }
    
    bot.editMessageText('✓ Option selected!', {
      chat_id: chatId,
      message_id: query.message.message_id
    });
    
    if (data === 'edit_name') {
      state.step = 'edit_task_name';
      bot.sendMessage(chatId, '📝 Enter the new task name:');
    } else if (data === 'edit_description') {
      state.step = 'edit_task_description';
      bot.sendMessage(chatId, '📄 Enter the new description (or type "skip" to remove):');
    } else if (data === 'edit_time') {
      state.step = 'edit_task_time';
      bot.sendMessage(chatId, '⏰ Enter the new time (format: HH:MM):\n\nExample: "7:00" or "14:30"');
    } else if (data === 'edit_date') {
      state.step = 'edit_task_date';
      bot.sendMessage(chatId, '📆 Enter the new date (format: YYYY-MM-DD):\n\nExample: "2025-12-25"');
    } else if (data === 'edit_schedule') {
      state.step = 'edit_task_schedule';
      bot.sendMessage(chatId, '📅 Enter the new days (format: Mon,Wed,Fri or M,W,F):');
    } else if (data === 'edit_done') {
      // Save all changes
      const updated = await updateTask(state.editTaskId, {
        name: state.editTaskData.name,
        description: state.editTaskData.description,
        schedule: state.editTaskData.schedule
      });
      
      if (updated) {
        let confirmMessage = '✅ Task updated successfully!\n\n';
        confirmMessage += `*${updated.name}*\n`;
        if (updated.description) confirmMessage += `_${updated.description}_\n\n`;
        if (updated.schedule?.time) confirmMessage += `Time: \`${updated.schedule.time}\`\n`;
        if (updated.schedule?.date) {
          confirmMessage += `Date: \`${updated.schedule.date.toISOString().split('T')[0]}\`\n`;
        }
        if (updated.schedule?.days) {
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const dayList = updated.schedule.days.map(d => dayNames[d]).join(', ');
          confirmMessage += `Days: \`${dayList}\`\n`;
        }
        bot.sendMessage(chatId, confirmMessage, { parse_mode: 'Markdown' });
      } else {
        bot.sendMessage(chatId, '❌ Error updating task.');
      }
      
      delete conversationStates[userId];
    }
    
    bot.answerCallbackQuery(query.id);
    return;
  }
  
  // Handle task completion buttons
  const match = data.match(/^complete_(.+)_(.+)_(yes|no)$/);
  if (!match) return;
  
  const taskId = match[1];
  const assignedUserId = match[2];
  const completed = match[3] === 'yes';
  
  // Check if the person pressing the button is the assigned user
  if (userId !== assignedUserId) {
    bot.answerCallbackQuery(query.id, {
      text: '❌ This button is not for you!',
      show_alert: true
    });
    return;
  }
  
  // Check if task is past deadline
  try {
    const { Task } = require('./database/models');
    const task = await Task.findById(taskId);
    
    if (task && isTaskPastDeadline(task)) {
      bot.answerCallbackQuery(query.id, {
        text: '⏰ Time has passed for this task. Confirmation is no longer valid!',
        show_alert: true
      });
      
      // Remove the buttons
      bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: chatId, message_id: query.message.message_id }
      );
      
      return;
    }
  } catch (error) {
    console.error('Error checking task deadline:', error);
  }
  
  try {
    await getOrCreateUser(userId, username);
    const result = await recordCompletion(taskId, userId, completed);
    
    let responseMessage = '';
    const websiteUrl = 'http://localhost:3000';
    
    if (completed) {
      responseMessage = `✅ <b>Task Completed</b>\n`;
      responseMessage += `━━━━━━━━━━━━━━━━\n`;
      responseMessage += `Task: <b>${result.taskName || 'Task'}</b>\n`;
      responseMessage += `User: <b>${username}</b>\n\n`;
      
      responseMessage += `<b>Status</b>\n`;
      responseMessage += `✓ Completed Successfully!\n`;
      
      if (result.streakCount > 1) {
        responseMessage += `Streak: <code>${result.streakCount}</code> days 🔥\n`;
      }
      
      responseMessage += `\n<i>Keep up the great work! Weekly XP preserved.</i> 💪\n`;
    } else {
      responseMessage = `❌ <b>Task Missed</b>\n`;
      responseMessage += `━━━━━━━━━━━━━━━━\n`;
      responseMessage += `Task: <b>${result.taskName || 'Task'}</b>\n`;
      responseMessage += `User: <b>${username}</b>\n\n`;
      
      responseMessage += `<b>Penalty</b>\n`;
      responseMessage += `Weekly XP: <code>-10</code> 📉\n`;
      responseMessage += `<i>Keep trying!</i> 💪\n`;
    }
    
    responseMessage += `\n<a href="${websiteUrl}">View Dashboard</a>`;
    
    // Remove the buttons after response
    bot.answerCallbackQuery(query.id);
    bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: chatId, message_id: query.message.message_id }
    );
    bot.sendMessage(chatId, responseMessage, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Error recording completion:', error);
    bot.answerCallbackQuery(query.id, { text: 'Error recording completion' });
  }
});

// Schedule task checks every minute
cron.schedule('* * * * *', async () => {
  try {
    // Get Ethiopia time (UTC+3)
    const now = new Date();
    const offset = config.timezone?.offset || 0;
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const localNow = new Date(utc + (3600000 * offset));
    
    const currentTime = `${localNow.getHours().toString().padStart(2, '0')}:${localNow.getMinutes().toString().padStart(2, '0')}`;
    console.log(`⏰ Checking tasks for time: ${currentTime} (Ethiopia Time, UTC+3)`);

    const tasks = await getTasksDueNow();
    const websiteUrl = 'https://aj-and-lis-task-tracker.vercel.app/';
    const { Completion } = require('./database/models');
    
    for (const task of tasks) {
      // Send individual confirmation message for each assigned user
      const assignedUsers = task.assignedTo || [task.createdBy];
      
      for (const assignedUserId of assignedUsers) {
        // Check if user already completed this task in advance today
        const today = new Date(localNow);
        today.setHours(0, 0, 0, 0);
        
        const alreadyCompleted = await Completion.findOne({
          taskId: task._id,
          userId: assignedUserId,
          completedAt: { $gte: today },
          completed: true,
          advanceCompletion: true
        });
        
        if (alreadyCompleted) {
          console.log(`⏭️ Skipping confirmation for ${assignedUserId} - already completed in advance`);
          continue;
        }
        
        const userName = assignedUserId === config.users.user1.id ? config.users.user1.name : config.users.user2.name;
        const fullMessage = `⏰ Time for: ${task.name}\n\nHey ${userName}, did you complete this task?\n\n[View Dashboard](${websiteUrl})`;
        
        // Create user-specific keyboard with userId embedded
        const keyboard = {
          inline_keyboard: [
            [
              { text: '✅ Yes', callback_data: `complete_${task._id}_${assignedUserId}_yes` },
              { text: '❌ No', callback_data: `complete_${task._id}_${assignedUserId}_no` },
            ],
          ],
        };
        
        bot.sendMessage(
          config.telegram.groupChatId,
          fullMessage,
          {
            reply_markup: keyboard,
          }
        );
      }
    }
  } catch (error) {
    console.error('Error in scheduled task check:', error);
  }
});

// Check for missed confirmations once per day at 6 AM (Ethiopia time)
cron.schedule('* * * * *', async () => {
  try {
    // Get Ethiopia time (UTC+3)
    const now = new Date();
    const offset = config.timezone?.offset || 0;
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const localNow = new Date(utc + (3600000 * offset));
    
    // Only run at 6 AM Ethiopia time (06:00)
    if (localNow.getHours() === 6 && localNow.getMinutes() === 0) {
      console.log('🔍 Checking for missed confirmations (6 AM Ethiopia time)...');
      await checkMissedConfirmations();
    }
  } catch (error) {
    console.error('Error checking missed confirmations:', error);
  }
});

// Check for week reset every minute (checks for Monday 06:00 Ethiopia time)
cron.schedule('* * * * *', async () => {
  try {
    const result = await checkAndResetWeek();
    
    if (result) {
      let message = '📅 *Weekly Report*\n';
      message += '━━━━━━━━━━━━━━━━\n\n';
      
      if (result.bothPerfect) {
        message += '🌟 *AMAZING!* Both of you maintained 100 XP this week!\n';
        message += '💪 You both leveled up! Keep up the great work!\n';
      } else if (result.isTie) {
        message += '🤝 *It\'s a Tie!* Both of you have the same XP!\n';
        message += `🔥 Score: \`${result.winnerXp}\` XP\n\n`;
        message += '💪 You both leveled up! Keep pushing each other!\n';
      } else {
        message += `🎉🏆 *WINNER: ${result.winner}* 🏆🎉\n`;
        message += `🔥 Score: \`${result.winnerXp}\` XP\n\n`;
        
        message += `📉 *Runner-up: ${result.loser}*\n`;
        message += `💀 Score: \`${result.loserXp}\` XP\n\n`;
        
        message += `🚨 *PENALTY TASK* 🚨\n`;
        message += `"${result.reward}"\n\n`;
        message += '😈 _Better luck next week!_\n';
      }
      
      message += '\n_Weekly XP has been reset to 100._';
      
      bot.sendMessage(config.telegram.groupChatId, message, { parse_mode: 'Markdown' });
    }
  } catch (error) {
    console.error('Error checking week reset:', error);
  }
});

// Handle errors
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

// Export bot for API use
module.exports = bot;
