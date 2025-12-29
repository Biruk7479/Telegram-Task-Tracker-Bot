const express = require('express');
const cors = require('cors');
const connectDB = require('../database/connection');
const { User, Task, Completion } = require('../database/models');
const config = require('../config');

const app = express();
const router = express.Router();

// Get base path from environment or default to empty string
const BASE_PATH = process.env.BASE_PATH || '';

// Middleware
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Connect to database
connectDB();

// API Routes

// Root route for health check
router.get('/', (req, res) => {
  res.send('Telegram Task Tracker API is running');
});

// Get all users
router.get('/api/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user by telegram ID
router.get('/api/users/:telegramId', async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.params.telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Get all tasks
router.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await Task.find({ active: true });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get completions for a date range
router.get('/api/completions', async (req, res) => {
  try {
    const { userId, startDate, endDate, taskId } = req.query;
    
    const query = {};
    
    if (userId) query.userId = userId;
    if (taskId) query.taskId = taskId;
    
    if (startDate || endDate) {
      query.completedAt = {};
      if (startDate) query.completedAt.$gte = new Date(startDate);
      if (endDate) query.completedAt.$lte = new Date(endDate);
    }
    
    const completions = await Completion.find(query)
      .populate('taskId')
      .sort({ completedAt: -1 });
    
    res.json(completions);
  } catch (error) {
    console.error('Error fetching completions:', error);
    res.status(500).json({ error: 'Failed to fetch completions' });
  }
});

// Get calendar data for a user
router.get('/api/calendar/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const { year, month } = req.query;
    
    // Get start and end of month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    
    // Query by scheduledFor (primary) OR completedAt (fallback for old data or flexible tasks)
    const completions = await Completion.find({
      userId: telegramId,
      $or: [
        { scheduledFor: { $gte: startDate, $lte: endDate } },
        { completedAt: { $gte: startDate, $lte: endDate }, scheduledFor: { $exists: false } }
      ]
    }).populate('taskId');
    
    // Get all active scheduled tasks assigned to this user
    const scheduledTasks = await Task.find({ 
      active: true,
      assignedTo: telegramId,
      $or: [
        { type: 'daily', 'schedule.time': { $exists: true } },
        { type: 'weekly', 'schedule.time': { $exists: true } },
        { type: 'custom', 'schedule.time': { $exists: true } },
        { type: 'one-time', 'schedule.date': { $exists: true } }
      ]
    });
    
    // Group by date
    const calendarData = {};
    
    // Initialize calendar data with scheduled tasks
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month - 1, day).getDay();
      
      calendarData[date] = {
        date,
        completions: [],
        scheduledTasks: [],
        totalXp: 0,
        tasksCompleted: 0,
        tasksFailed: 0,
      };
      
      // Add scheduled tasks for this day
      scheduledTasks.forEach(task => {
        let shouldShow = false;
        
        if (task.type === 'daily') {
          // Only show daily tasks starting from their creation date
          const createdDate = new Date(task.createdAt);
          createdDate.setHours(0, 0, 0, 0);
          const currentDate = new Date(year, month - 1, day);
          currentDate.setHours(0, 0, 0, 0);
          shouldShow = currentDate >= createdDate;
        } else if ((task.type === 'weekly' || task.type === 'custom') && task.schedule.days) {
          const createdDate = new Date(task.createdAt);
          createdDate.setHours(0, 0, 0, 0);
          const currentDate = new Date(year, month - 1, day);
          currentDate.setHours(0, 0, 0, 0);
          shouldShow = task.schedule.days.includes(dayOfWeek) && currentDate >= createdDate;
        } else if (task.type === 'one-time' && task.schedule.date) {
          const taskDate = new Date(task.schedule.date);
          taskDate.setHours(0, 0, 0, 0);
          const currentDate = new Date(year, month - 1, day);
          currentDate.setHours(0, 0, 0, 0);
          shouldShow = taskDate.getTime() === currentDate.getTime();
        }
        
        if (shouldShow) {
          // Check if this task was completed on this day (using scheduledFor, fallback to completedAt)
          const dayCompletion = completions.find(c => {
            if (!c.taskId || c.taskId._id.toString() !== task._id.toString()) return false;
            
            const completionDate = c.scheduledFor 
              ? c.scheduledFor.toISOString().split('T')[0]
              : c.completedAt.toISOString().split('T')[0];
            
            return completionDate === date;
          });
          
          calendarData[date].scheduledTasks.push({
            _id: task._id.toString(),
            name: task.name,
            time: task.schedule.time,
            xpReward: task.xpReward,
            completed: dayCompletion ? dayCompletion.completed : null,
            missedConfirmation: dayCompletion ? dayCompletion.missedConfirmation : false,
          });
        }
      });
    }
    
    completions.forEach(completion => {
      // Use scheduledFor to determine which calendar day to show the completion
      // This ensures tasks completed after midnight still show on the correct scheduled day
      const date = completion.scheduledFor 
        ? completion.scheduledFor.toISOString().split('T')[0]
        : completion.completedAt.toISOString().split('T')[0]; // fallback for old data
      
      if (!calendarData[date]) {
        calendarData[date] = {
          date,
          completions: [],
          scheduledTasks: [],
          totalXp: 0,
          tasksCompleted: 0,
          tasksFailed: 0,
        };
      }
      
      calendarData[date].completions.push({
        taskName: completion.taskId.name,
        completed: completion.completed,
        xpEarned: completion.xpEarned,
        streakCount: completion.streakCount,
      });
      
      calendarData[date].totalXp += completion.xpEarned;
      if (completion.completed) {
        calendarData[date].tasksCompleted++;
      } else {
        calendarData[date].tasksFailed++;
      }
    });
    
    res.json(Object.values(calendarData));
  } catch (error) {
    console.error('Error fetching calendar data:', error);
    res.status(500).json({ error: 'Failed to fetch calendar data' });
  }
});

// Get stats summary
router.get('/api/stats/summary', async (req, res) => {
  try {
    const users = await User.find();
    const tasks = await Task.find({ active: true });
    const completions = await Completion.find();
    
    const stats = {
      totalUsers: users.length,
      totalTasks: tasks.length,
      totalCompletions: completions.filter(c => c.completed).length,
      users: users.map(u => ({
        telegramId: u.telegramId,
        username: u.username,
        level: u.level,
        xp: u.xp,
      })),
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Health check
router.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== TASK CRUD OPERATIONS ====================

// Create a new task
router.post('/api/tasks', async (req, res) => {
  try {
    const { name, description, type, schedule, createdBy, assignedTo, xpReward } = req.body;
    
    // Validation
    if (!name || !type || !createdBy) {
      return res.status(400).json({ error: 'Missing required fields: name, type, createdBy' });
    }
    
    const validTypes = ['daily', 'weekly', 'custom', 'one-time', 'flexible'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid task type' });
    }
    
    const task = new Task({
      name,
      description: description || '',
      type,
      schedule: schedule || {},
      xpReward: xpReward || 10,
      createdBy,
      assignedTo: assignedTo || [createdBy],
      active: true,
    });
    
    await task.save();
    
    // Sync to Google Calendar
    try {
      const { createCalendarEvent } = require('../services/googleCalendarService');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const eventId = await createCalendarEvent(task, today);
      if (eventId) {
        task.googleCalendarEventId = eventId;
        await task.save();
      }
    } catch (calendarError) {
      console.error('Failed to create calendar event:', calendarError);
      // Don't fail the task creation if calendar sync fails
    }
    
    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update an existing task
router.put('/api/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { name, description, schedule, assignedTo } = req.body;
    
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Update fields
    if (name) task.name = name;
    if (description !== undefined) task.description = description;
    if (schedule) {
      task.schedule = { ...task.schedule, ...schedule };
      task.markModified('schedule');
    }
    if (assignedTo) task.assignedTo = assignedTo;
    
    await task.save();
    
    // Update Google Calendar event
    try {
      const { updateCalendarEvent } = require('../services/googleCalendarService');
      if (task.googleCalendarEventId) {
        const userId = task.assignedTo?.includes(require('../config').users.user1.id) 
          ? require('../config').users.user1.id 
          : task.createdBy;
        
        await updateCalendarEvent(task.googleCalendarEventId, userId, {
          summary: task.name,
          description: task.description,
        });
      }
    } catch (calendarError) {
      console.error('Failed to update calendar event:', calendarError);
    }
    
    res.json(task);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete a task (soft delete)
router.delete('/api/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    task.active = false;
    await task.save();
    
    // Delete from Google Calendar
    try {
      const { deleteCalendarEvent } = require('../services/googleCalendarService');
      if (task.googleCalendarEventId) {
        const userId = task.assignedTo?.includes(require('../config').users.user1.id) 
          ? require('../config').users.user1.id 
          : task.createdBy;
        
        await deleteCalendarEvent(task.googleCalendarEventId, userId);
      }
    } catch (calendarError) {
      console.error('Failed to delete calendar event:', calendarError);
    }
    
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Mark task as complete/incomplete
router.post('/api/tasks/:taskId/complete', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { userId, completed, scheduledFor } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }
    
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Check if user is assigned to this task
    if (task.assignedTo && task.assignedTo.length > 0 && !task.assignedTo.includes(userId)) {
      return res.status(403).json({ error: 'User not assigned to this task' });
    }
    
    // Calculate proper scheduledFor date
    let scheduledForDate = scheduledFor ? new Date(scheduledFor) : new Date();
    scheduledForDate.setHours(0, 0, 0, 0);
    
    // Check if completion already exists for this task/user/date
    const existingCompletion = await Completion.findOne({
      taskId: task._id,
      userId: userId,
      scheduledFor: scheduledForDate,
    });
    
    if (existingCompletion) {
      // Update existing completion
      existingCompletion.completed = completed;
      existingCompletion.completedAt = new Date();
      await existingCompletion.save();
      
      // Update Google Calendar event
      try {
        const { markEventCompleted, markEventMissed } = require('../services/googleCalendarService');
        if (task.googleCalendarEventId) {
          if (completed) {
            await markEventCompleted(task.googleCalendarEventId, userId, task.name);
          } else {
            await markEventMissed(task.googleCalendarEventId, userId, task.name);
          }
        }
      } catch (calendarError) {
        console.error('Failed to update calendar event status:', calendarError);
      }
      
      return res.json(existingCompletion);
    }
    
    // Create new completion
    const { recordCompletion } = require('../services/userService');
    const { getOrCreateUser } = require('../services/userService');
    const User = require('../database/models').User;
    const user = await User.findOne({ telegramId: userId });
    const username = user?.username || 'User';
    
    await getOrCreateUser(userId, username);
    const result = await recordCompletion(taskId, userId, completed, false);
    
    // Update Google Calendar event
    try {
      const { markEventCompleted, markEventMissed } = require('../services/googleCalendarService');
      if (task.googleCalendarEventId) {
        if (completed) {
          await markEventCompleted(task.googleCalendarEventId, userId, task.name);
        } else {
          await markEventMissed(task.googleCalendarEventId, userId, task.name);
        }
      }
    } catch (calendarError) {
      console.error('Failed to update calendar event status:', calendarError);
    }
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Error marking task complete:', error);
    res.status(500).json({ error: 'Failed to mark task complete' });
  }
});

// Get task by ID
router.get('/api/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await Task.findById(taskId);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// ==================== GOOGLE CALENDAR OAUTH ====================

// Google Calendar OAuth - Get authorization URL
router.get('/api/auth/google/url', (req, res) => {
  try {
    const { getAuthUrl } = require('../services/googleCalendarService');
    const authUrl = getAuthUrl();
    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
});

// Google Calendar OAuth - Callback
router.get('/api/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).send('No authorization code provided');
    }
    
    const { getTokensFromCode } = require('../services/googleCalendarService');
    const tokens = await getTokensFromCode(code);
    
    // Display the refresh token for user to add to .env
    res.send(`
      <html>
        <head><title>Google Calendar Authorization</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px;">
          <h1>✅ Authorization Successful!</h1>
          <p>Copy this refresh token and add it to your <code>.env</code> file:</p>
          <pre style="background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto;">
USER1_GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}
# or
USER2_GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}
          </pre>
          <p><strong>Important:</strong> Keep this token secure and don't share it publicly!</p>
          <p>After adding the token to your <code>.env</code> file, restart the bot.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    res.status(500).send('Failed to authorize. Please try again.');
  }
});

// Mount router with BASE_PATH
if (BASE_PATH) {
  console.log(`Mounting routes at BASE_PATH: ${BASE_PATH}`);
  app.use(BASE_PATH, router);
} else {
  console.log('Mounting routes at root /');
  app.use('/', router);
}

// 404 handler for debugging
app.use((req, res) => {
  console.log(`404 Not Found: ${req.method} ${req.originalUrl}`);
  console.log(`Base Path: ${BASE_PATH}`);
  res.status(404).send(`Cannot ${req.method} ${req.originalUrl} (Base Path: ${BASE_PATH})`);
});

// Start server
const PORT = config.api.port;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
  console.log(`Base path: ${BASE_PATH || '(root)'}`);
});

module.exports = app;
