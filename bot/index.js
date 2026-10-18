const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const connectDB = require('./database/connection');
const { getOrCreateUser, ensureMembers, getUserStats, getLeaderboard } = require('./services/userService');
const { createTask, getActiveTasks, deleteTask, updateTask, getTasksDueNow, parseTime, parseDays, parseCustomDays } = require('./services/taskService');
const occurrences = require('./services/occurrenceService');
const { Occurrence } = require('./database/models');
const { TZ, todayKey, addDays, weekKeyOf, isDayOpen } = require('./utils/time');
const cron = require('node-cron');

// Connect to database
connectDB().then(ensureMembers).catch((err) => console.error('Startup error:', err));

// Initialize bot
const bot = new TelegramBot(config.telegram.token, { polling: true });

console.log('Bot started successfully!');

// Store conversation states
const conversationStates = {};

const websiteUrl = config.webUrl;

// Only the two members can use the bot. Everyone else gets one polite refusal.
const refuse = (msg) => bot.sendMessage(msg.chat.id, '🔒 This is a private bot for its two members.');

// Registers a member-only command; the regex is anchored so /start does not
// also match /startfoo or a sentence that merely contains "/start".
const command = (name, handler, { open = false } = {}) => {
  bot.onText(new RegExp(`^/${name}(?:@\\w+)?(?:\\s|$)`), (msg, match) => {
    if (!open && !config.isMember(msg.from.id)) return refuse(msg);
    return handler(msg, match);
  });
};

const dateToken = (dateKey) => dateKey.replace(/-/g, '');
const tokenToDate = (t) => `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;

const STATUS_ICON = { done: '✅', missed: '❌', ignored: '👻', excused: '🙏', pending: '⏳', void: '▫️' };

const occLabel = (o) => {
  const counter = o.target > 1 ? ` ${o.progress}/${o.target}${o.unit ? ` ${o.unit}` : ''}` : '';
  return `${STATUS_ICON[o.status] || ''} ${o.taskName}${counter}${o.time ? ` · ${o.time}` : ''}`;
};

// Buttons for answering one occurrence. Callback data stays under Telegram's
// 64-byte limit: c|<taskId>|<userId>|<yyyymmdd>|<action>
const answerKeyboard = (o) => {
  const base = `c|${o.taskId}|${o.userId}|${dateToken(o.date)}`;
  const row = o.target > 1
    ? [{ text: '➕1', callback_data: `${base}|p` }, { text: '✅ All', callback_data: `${base}|y` }]
    : [{ text: '✅ Done', callback_data: `${base}|y` }];
  row.push({ text: '❌ No', callback_data: `${base}|n` });
  return { inline_keyboard: [row, [{ text: '🙏 Excuse', callback_data: `${base}|e` }]] };
};

// Command: /start
command('start', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const username = msg.from.username || msg.from.first_name;
  
  // Create user if not exists
  await getOrCreateUser(userId, username);
  
  const welcomeMessage = `
🎯 *Welcome to Task Tracker Bot!*

I'll help you and your partner stay productive and accountable!

*Available Commands:*
/today - Both of your days, with buttons
/week - This week's scores and penalties
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
command('stop', (msg) => {
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
command('help', (msg) => {
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
• *XP System*: Start with ${config.rules.startXp} XP each week. XP only goes down.
• *Said No*: -${config.rules.penalty.missed} XP (also a counter task short of its target)
• *Ignored*: -${config.rules.penalty.ignored} XP — not answering costs more than an honest No
• *Excuse*: 0 XP, ${config.rules.excusesPerWeek} per week
• *Deadline*: a day stays open until 0${config.rules.closeHour}:00 the next morning
• *Winner*: The person with the most XP when the week settles (Monday 0${config.rules.closeHour}:00) levels up!
• *Loser*: The person with less XP must complete a *Penalty Task*.

*Other Commands*
• /today - See both of your days and answer open tasks
• /week - Scores, penalties and excuses left this week
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
[View Dashboard](${websiteUrl})

💡 _Tip: Use /markdone to complete tasks ahead of time!_
  `;
  
  bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

// Command: /getchatid - Helper to get the current chat ID
command('getchatid', (msg) => {
  const chatId = msg.chat.id;
  const chatType = msg.chat.type;
  
  bot.sendMessage(chatId, `
📋 *Chat Information:*

Chat ID: \`${chatId}\`
Chat Type: ${chatType}

${chatType === 'group' || chatType === 'supergroup' ? '✅ This is a group chat. Use this ID in your .env file as TELEGRAM_GROUP_CHAT_ID' : '⚠️ This is not a group chat.'}
  `, { parse_mode: 'Markdown' });
}, { open: true });

// The weekly report message, shared by /week and the Monday settlement.
const weekReportMessage = (result) => {
  let message = '📅 *Weekly Report*\n';
  message += '━━━━━━━━━━━━━━━━\n\n';

  if (result.bothPerfect) {
    message += `🌟 *AMAZING!* Both of you kept all ${config.rules.startXp} XP this week!\n`;
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

  message += `\n_A new week starts at ${config.rules.startXp} XP._`;
  return message;
};

// Command: /week — standings so far, every penalty, excuses left. Changes nothing.
const showWeek = async (msg) => {
  const week = weekKeyOf(todayKey());
  let message = `📊 *This week* (from ${week})\n━━━━━━━━━━━━━━━━\n\n`;

  for (const id of config.memberIds()) {
    const xp = await occurrences.weeklyXp(id, week);
    const left = await occurrences.excusesLeft(id, week);
    const hits = await Occurrence.find({ userId: id, weekKey: week, penalty: { $gt: 0 } }).sort({ date: 1 }).lean();
    message += `*${config.memberName(id)}* — ♥ \`${xp}\` / ${config.rules.startXp} · 🙏 ${left} excuses left\n`;
    for (const h of hits) message += `  ${STATUS_ICON[h.status]} ${h.date.slice(5)} ${h.taskName} \`-${h.penalty}\`\n`;
    message += '\n';
  }

  message += `_Settles Monday 0${config.rules.closeHour}:00._`;
  bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
};
command('week', showWeek);
command('testweek', showWeek);

// Command: /today — both members' day, with buttons for your own open tasks.
command('today', async (msg) => {
  const userId = msg.from.id.toString();
  const today = todayKey();
  const yesterday = addDays(today, -1);
  const members = await occurrences.dayView(today);

  let message = `🗓 *Today* · ${today}\n━━━━━━━━━━━━━━━━\n`;
  for (const m of members) {
    message += `\n*${m.name}* — ${m.done}/${m.total}\n`;
    message += m.items.length ? m.items.map((o) => `  ${occLabel(o)}`).join('\n') + '\n' : '  _Nothing scheduled_\n';
  }
  await bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });

  // Your own open items, yesterday's included while it is still open.
  const mine = await Occurrence.find({
    userId, status: 'pending', date: { $in: isDayOpen(yesterday) ? [yesterday, today] : [today] },
  }).sort({ date: 1, time: 1 }).lean();
  for (const o of mine) {
    const when = o.date === today ? '' : ' (yesterday)';
    await bot.sendMessage(msg.chat.id, `${occLabel(o)}${when}`, { reply_markup: answerKeyboard(o) });
  }
});

// Command: /addtask
command('addtask', (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  conversationStates[userId] = { step: 'task_name' };
  
  bot.sendMessage(chatId, '📝 What should we call this task?\n\nExample: "Morning Prayer", "Workout", "Read for 30 mins"');
});

// Command: /bulkadd
command('bulkadd', (msg) => {
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
command('listtasks', async (msg) => {
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
command('deletetask', async (msg) => {
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
command('markdone', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  try {
    const today = todayKey();
    const yesterday = addDays(today, -1);
    await occurrences.ensureDay(today);
    const open = await Occurrence.find({
      userId, status: 'pending', date: { $in: isDayOpen(yesterday) ? [yesterday, today] : [today] },
    }).sort({ date: 1, time: 1 }).lean();
    
    if (open.length === 0) {
      bot.sendMessage(chatId, '🎉 Nothing open for you right now!');
      return;
    }
    
    const keyboard = open.map((o) => [{
      text: `${o.taskName}${o.time ? ` (${o.time})` : ''}${o.date === today ? '' : ' · yesterday'}`,
      callback_data: `c|${o.taskId}|${o.userId}|${dateToken(o.date)}|y`,
    }]);
    
    bot.sendMessage(chatId, '✅ *Mark Task as Done*\n\nSelect a task to mark as completed:', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });
  } catch (error) {
    console.error('Error in /markdone:', error);
    bot.sendMessage(chatId, '❌ Error loading tasks. Please try again.');
  }
});

// Command: /edittask
command('edittask', async (msg) => {
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
command('mystats', async (msg) => {
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
    message += `Weekly XP: \`${stats.weeklyXp}\` / \`${config.rules.startXp}\`\n`;
    message += `Excuses left: \`${stats.excusesLeft}\`\n`;
    message += `Tasks Done: \`${stats.totalTasksCompleted}\`\n\n`;
    if (stats.pendingRewards.length) {
      message += `🚨 *Penalty tasks owed*\n${stats.pendingRewards.map((r) => `• ${r}`).join('\n')}\n\n`;
    }
    
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
command('leaderboard', async (msg) => {
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
      message += `   Weekly: \`${user.weeklyXp}\` / \`${config.rules.startXp}\` XP\n`;
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
  
  if (!config.isMember(userId)) {
    bot.answerCallbackQuery(query.id, { text: '🔒 Private bot', show_alert: true });
    return;
  }

  // Answer buttons: c|<taskId>|<userId>|<yyyymmdd>|<y|n|e|p>, plus the formats
  // used by buttons sent before this version (markdone_<taskId>, complete_…).
  const answer = parseAnswer(data, query);
  if (answer) {
    await handleAnswer(query, answer);
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
      
      let confirmMessage = `✅ *Task Created*\n`;
      confirmMessage += `━━━━━━━━━━━━━━━━\n`;
      confirmMessage += `*${task.name}*\n`;
      if (task.description) confirmMessage += `_${task.description}_\n`;
      confirmMessage += `Type: \`${task.type}\`\n`;
      confirmMessage += `Assigned: \`${state.taskData.assignedTo.length === 2 ? 'Both' : (state.taskData.assignedTo[0] === config.users.user1.id ? config.users.user1.name : config.users.user2.name)}\`\n\n`;
      confirmMessage += `[View Dashboard](${websiteUrl})`;
      
      bot.sendMessage(chatId, confirmMessage, { parse_mode: 'Markdown' });
      delete conversationStates[userId];
    } else if (taskType === 'one-time') {
      state.step = 'task_date';
      bot.sendMessage(chatId, '📆 What date? (format: YYYY-MM-DD)\n\nExample: \"2025-12-25\"');
    } else if (taskType === 'custom') {
      state.step = 'task_custom_days';
      bot.sendMessage(chatId, '📅 Which days? Type day abbreviations separated by commas.\n\nExamples:\n• "M,W,F" for Mon, Wed, Fri\n• "M,T,Th" for Mon, Tue, Thu\n\nDay codes: M=Mon, T=Tue, W=Wed, Th=Thu, F=Fri, S=Sat, Su=Sun');
    } else {
      state.step = 'task_time';
      bot.sendMessage(chatId, '⏰ What time should this task be checked?\n\nExample: \"7:00\" or \"14:30\"');
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
  
});

const ACTIONS = { y: 'done', n: 'missed', e: 'excused', p: 'progress' };

function parseAnswer(data, query) {
  // Buttons sent before dates were embedded: use the day the message was sent.
  const messageDay = () => todayKey(new Date((query.message?.date || Date.now() / 1000) * 1000));

  let m = data.match(/^c\|([a-f0-9]{24})\|(\d+)\|(\d{8})\|([ynep])$/);
  if (m) return { taskId: m[1], ownerId: m[2], date: tokenToDate(m[3]), action: ACTIONS[m[4]] };

  m = data.match(/^complete_([a-f0-9]{24})_(\d+)_(yes|no)$/);
  if (m) return { taskId: m[1], ownerId: m[2], date: messageDay(), action: m[3] === 'yes' ? 'done' : 'missed' };

  m = data.match(/^markdone_([a-f0-9]{24})$/);
  if (m) return { taskId: m[1], ownerId: query.from.id.toString(), date: messageDay(), action: 'done' };

  return null;
}

async function handleAnswer(query, { taskId, ownerId, date, action }) {
  const chatId = query.message.chat.id;
  const userId = query.from.id.toString();
  const username = query.from.username || query.from.first_name;

  if (userId !== ownerId) {
    bot.answerCallbackQuery(query.id, { text: '❌ This button is not for you!', show_alert: true });
    return;
  }

  let result;
  try {
    await getOrCreateUser(userId, username);
    result = await occurrences.mark({ taskId, userId, date, action, source: 'bot' });
  } catch (error) {
    if (!error.status) console.error('Error recording answer:', error);
    bot.answerCallbackQuery(query.id, { text: error.status ? `⏰ ${error.message}` : 'Error recording answer', show_alert: true });
    if (error.status === 409) {
      bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message.message_id }).catch(() => {});
    }
    return;
  }

  const o = result.occurrence;
  const stillOpen = o.status === 'pending';

  // A counter that is not finished yet keeps its buttons and shows progress.
  if (stillOpen) {
    bot.answerCallbackQuery(query.id, { text: `${o.progress}/${o.target} ${o.unit || ''}`.trim() });
    bot.editMessageText(`${occLabel(o)}`, {
      chat_id: chatId, message_id: query.message.message_id, reply_markup: answerKeyboard(o),
    }).catch(() => {});
    return;
  }

  bot.answerCallbackQuery(query.id);
  bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message.message_id }).catch(() => {});

  const week = o.weekKey;
  const [xp, streaks, excuses] = await Promise.all([
    occurrences.weeklyXp(userId, week),
    occurrences.streaksFor(userId),
    occurrences.excusesLeft(userId, week),
  ]);
  const streak = streaks[String(taskId)] || 0;
  const pooled = o.mode === 'pooled' ? '\n<i>Shared task — counts for both of you.</i>' : '';
  const dayNote = o.date === todayKey() ? '' : ` <i>(${o.date})</i>`;

  let responseMessage;
  if (o.status === 'done') {
    responseMessage = `✅ <b>${o.taskName}</b>${dayNote}\n${username} did it${o.advance ? ' early' : ''}!`;
    if (streak > 1) responseMessage += `\nStreak: <code>${streak}</code> 🔥`;
    responseMessage += `\nWeekly XP: <code>${xp}</code>`;
  } else if (o.status === 'missed') {
    responseMessage = `❌ <b>${o.taskName}</b>${dayNote}\n${username}: not done.\nWeekly XP: <code>-${o.penalty}</code> → <code>${xp}</code> 📉`;
  } else if (o.status === 'excused') {
    responseMessage = `🙏 <b>${o.taskName}</b>${dayNote}\n${username} used an excuse (${excuses} left this week). No XP lost.`;
  }
  responseMessage += pooled;
  responseMessage += `\n<a href="${websiteUrl}">View Dashboard</a>`;

  bot.sendMessage(chatId, responseMessage, { parse_mode: 'HTML', disable_web_page_preview: true });
}

// ==================== SCHEDULER ====================
// One tick a minute, in order: make sure today's occurrences exist, close any
// day past its deadline (catching up after downtime), settle finished weeks,
// then send this minute's reminders. Closing always runs before settling, so
// Sunday's misses always land in Sunday's week.

let lastEnsuredDay = null;
let ticking = false;

async function sendReminders(now) {
  const today = todayKey(now);
  const tasks = await getTasksDueNow(now);
  for (const task of tasks) {
    const rows = await Occurrence.find({ taskId: task._id, date: today }).lean();
    for (const o of rows) {
      if (o.status !== 'pending') continue; // done early, excused, or voided
      const progress = o.target > 1 ? ` (${o.progress}/${o.target}${o.unit ? ` ${o.unit}` : ''})` : '';
      const text = `⏰ Time for: ${o.taskName}${progress}\n\nHey ${config.memberName(o.userId)}, did you do it?`;
      await bot.sendMessage(config.telegram.groupChatId, text, { reply_markup: answerKeyboard(o) });
    }
  }
}

async function announceClosed(closed) {
  const byDay = {};
  for (const o of closed) ((byDay[o.date] ||= {})[o.userId] ||= []).push(o);

  for (const [date, people] of Object.entries(byDay)) {
    let message = `🌅 *${date} is closed*\n━━━━━━━━━━━━━━━━\n`;
    for (const [userId, items] of Object.entries(people)) {
      const lost = items.reduce((sum, o) => sum + o.penalty, 0);
      message += `\n*${config.memberName(userId)}* \`-${lost}\` XP\n`;
      message += items.map((o) => `  ${STATUS_ICON[o.status]} ${o.taskName} \`-${o.penalty}\``).join('\n') + '\n';
    }
    message += `\n_${STATUS_ICON.ignored} ignored = -${config.rules.penalty.ignored}, ${STATUS_ICON.missed} short of target = -${config.rules.penalty.missed}_`;
    await bot.sendMessage(config.telegram.groupChatId, message, { parse_mode: 'Markdown' });
  }
}

cron.schedule('* * * * *', async () => {
  if (ticking) return; // a slow tick never overlaps the next one
  ticking = true;
  const now = new Date();
  try {
    const today = todayKey(now);
    if (lastEnsuredDay !== today) {
      await occurrences.ensureDay(today, now);
      await Promise.all(config.memberIds().map((id) => occurrences.refreshUserCaches(id, now)));
      lastEnsuredDay = today;
    }

    const closed = await occurrences.closeDueDays(now);
    if (closed.length) await announceClosed(closed);

    for (const result of await occurrences.settleWeeks(now)) {
      await bot.sendMessage(config.telegram.groupChatId, weekReportMessage(result), { parse_mode: 'Markdown' });
    }

    await sendReminders(now);
  } catch (error) {
    console.error('Scheduler tick failed:', error);
  } finally {
    ticking = false;
  }
}, { timezone: TZ });

// Handle errors
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

// Export bot for API use
module.exports = bot;
