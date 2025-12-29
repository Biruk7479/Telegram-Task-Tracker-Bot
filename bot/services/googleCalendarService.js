const { google } = require('googleapis');
const config = require('../config');

/**
 * Google Calendar Color IDs
 * We'll use these to color-code tasks based on assignment
 */
const CALENDAR_COLORS = {
  USER1_ONLY: '9',    // Blue - Tasks for User 1 only
  USER2_ONLY: '10',   // Green - Tasks for User 2 only
  BOTH_USERS: '11',   // Red - Tasks for both users
};

/**
 * Create OAuth2 client for a specific user
 * @param {string} userId - 'user1' or 'user2' (optional - defaults to user1)
 * @returns {OAuth2Client}
 */
function getOAuth2Client(userId) {
  const oauth2Client = new google.auth.OAuth2(
    config.googleCalendar.clientId,
    config.googleCalendar.clientSecret,
    config.googleCalendar.redirectUri
  );

  // Use single shared calendar (user1's token) for all tasks
  // This shows all tasks in one calendar with color-coding
  const refreshToken = config.googleCalendar.user1RefreshToken;

  if (refreshToken) {
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });
  }

  return oauth2Client;
}

/**
 * Get calendar color based on task assignment
 * @param {Array<string>} assignedTo - Array of user IDs
 * @returns {string} Color ID
 */
function getTaskColor(assignedTo) {
  if (!assignedTo || assignedTo.length === 0) {
    return CALENDAR_COLORS.BOTH_USERS;
  }

  const hasUser1 = assignedTo.includes(config.users.user1.id);
  const hasUser2 = assignedTo.includes(config.users.user2.id);

  if (hasUser1 && hasUser2) {
    return CALENDAR_COLORS.BOTH_USERS; // Red - Both users
  } else if (hasUser1) {
    return CALENDAR_COLORS.USER1_ONLY; // Blue - User 1 only
  } else if (hasUser2) {
    return CALENDAR_COLORS.USER2_ONLY; // Green - User 2 only
  }

  return CALENDAR_COLORS.BOTH_USERS;
}

/**
 * Create a Google Calendar event for a task
 * @param {Object} task - The task object
 * @param {Date} scheduledDate - The date the task is scheduled for
 * @returns {Promise<string>} The event ID or null if failed
 */
async function createCalendarEvent(task, scheduledDate) {
  try {
    // Determine which user's calendar to use (prefer user1, or creator)
    const userId = task.assignedTo?.includes(config.users.user1.id) 
      ? config.users.user1.id 
      : task.createdBy;

    const oauth2Client = getOAuth2Client(userId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Parse task time or use default
    const taskTime = task.schedule?.time || '09:00';
    const [hours, minutes] = taskTime.split(':').map(Number);

    // Create event date/time
    const startDateTime = new Date(scheduledDate);
    startDateTime.setHours(hours, minutes, 0, 0);

    const endDateTime = new Date(startDateTime);
    endDateTime.setHours(hours + 1, minutes, 0, 0); // 1 hour duration

    // Determine recurrence rule based on task type
    let recurrence = null;
    if (task.type === 'daily') {
      recurrence = ['RRULE:FREQ=DAILY'];
    } else if (task.type === 'weekly' && task.schedule?.days) {
      const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      const byDay = task.schedule.days.map(d => dayMap[d]).join(',');
      recurrence = [`RRULE:FREQ=WEEKLY;BYDAY=${byDay}`];
    } else if (task.type === 'custom' && task.schedule?.days) {
      const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      const byDay = task.schedule.days.map(d => dayMap[d]).join(',');
      recurrence = [`RRULE:FREQ=WEEKLY;BYDAY=${byDay}`];
    }

    // Build event description
    let description = task.description || '';
    description += `\n\n🤖 Created by Task Tracker Bot`;
    description += `\nTask ID: ${task._id}`;
    
    const assignedNames = [];
    if (task.assignedTo?.includes(config.users.user1.id)) assignedNames.push(config.users.user1.name);
    if (task.assignedTo?.includes(config.users.user2.id)) assignedNames.push(config.users.user2.name);
    description += `\nAssigned to: ${assignedNames.join(', ')}`;

    const event = {
      summary: task.name,
      description: description,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'Africa/Addis_Ababa', // Ethiopia timezone
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'Africa/Addis_Ababa',
      },
      colorId: getTaskColor(task.assignedTo),
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
        ],
      },
    };

    // Add recurrence if applicable
    if (recurrence && task.type !== 'one-time') {
      event.recurrence = recurrence;
    }

    const response = await calendar.events.insert({
      calendarId: config.googleCalendar.calendarId,
      requestBody: event,
    });

    console.log(`✅ Created Google Calendar event: ${response.data.id} for task: ${task.name}`);
    return response.data.id;
  } catch (error) {
    console.error('❌ Error creating Google Calendar event:', error.message);
    return null;
  }
}

/**
 * Update a Google Calendar event (e.g., when task is completed/missed)
 * @param {string} eventId - The Google Calendar event ID
 * @param {string} userId - User ID for OAuth
 * @param {Object} updates - Updates to apply (summary, description, colorId)
 * @returns {Promise<boolean>} Success status
 */
async function updateCalendarEvent(eventId, userId, updates) {
  try {
    const oauth2Client = getOAuth2Client(userId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.patch({
      calendarId: config.googleCalendar.calendarId,
      eventId: eventId,
      requestBody: updates,
    });

    console.log(`✅ Updated Google Calendar event: ${eventId}`);
    return true;
  } catch (error) {
    console.error('❌ Error updating Google Calendar event:', error.message);
    return false;
  }
}

/**
 * Delete a Google Calendar event
 * @param {string} eventId - The Google Calendar event ID
 * @param {string} userId - User ID for OAuth
 * @returns {Promise<boolean>} Success status
 */
async function deleteCalendarEvent(eventId, userId) {
  try {
    const oauth2Client = getOAuth2Client(userId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.delete({
      calendarId: config.googleCalendar.calendarId,
      eventId: eventId,
    });

    console.log(`✅ Deleted Google Calendar event: ${eventId}`);
    return true;
  } catch (error) {
    console.error('❌ Error deleting Google Calendar event:', error.message);
    return false;
  }
}

/**
 * Mark a calendar event as completed (add checkmark to title)
 * @param {string} eventId - The Google Calendar event ID
 * @param {string} userId - User ID for OAuth
 * @param {string} taskName - Original task name
 * @returns {Promise<boolean>} Success status
 */
async function markEventCompleted(eventId, userId, taskName) {
  return await updateCalendarEvent(eventId, userId, {
    summary: `✅ ${taskName}`,
  });
}

/**
 * Mark a calendar event as missed (add cross to title)
 * @param {string} eventId - The Google Calendar event ID
 * @param {string} userId - User ID for OAuth
 * @param {string} taskName - Original task name
 * @returns {Promise<boolean>} Success status
 */
async function markEventMissed(eventId, userId, taskName) {
  return await updateCalendarEvent(eventId, userId, {
    summary: `❌ ${taskName}`,
  });
}

/**
 * Generate OAuth URL for user to authorize Google Calendar access
 * @returns {string} Authorization URL
 */
function getAuthUrl() {
  const oauth2Client = new google.auth.OAuth2(
    config.googleCalendar.clientId,
    config.googleCalendar.clientSecret,
    config.googleCalendar.redirectUri
  );

  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent', // Force to get refresh token
  });
}

/**
 * Exchange authorization code for tokens
 * @param {string} code - Authorization code from OAuth callback
 * @returns {Promise<Object>} Tokens object with refresh_token
 */
async function getTokensFromCode(code) {
  const oauth2Client = new google.auth.OAuth2(
    config.googleCalendar.clientId,
    config.googleCalendar.clientSecret,
    config.googleCalendar.redirectUri
  );

  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

module.exports = {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  markEventCompleted,
  markEventMissed,
  getAuthUrl,
  getTokensFromCode,
  CALENDAR_COLORS,
};
