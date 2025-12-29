require('dotenv').config();

module.exports = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    groupChatId: process.env.TELEGRAM_GROUP_CHAT_ID,
  },
  users: {
    user1: {
      id: process.env.USER1_ID,
      name: process.env.USER1_NAME,
    },
    user2: {
      id: process.env.USER2_ID,
      name: process.env.USER2_NAME,
    },
  },
  mongodb: {
    uri: process.env.MONGODB_URI,
  },
  googleCalendar: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback',
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    user1RefreshToken: process.env.USER1_GOOGLE_REFRESH_TOKEN,
    user2RefreshToken: process.env.USER2_GOOGLE_REFRESH_TOKEN,
  },
  api: {
    port: process.env.PORT || process.env.API_PORT || 3001,
    secret: process.env.API_SECRET,
  },
  xp: {
    taskComplete: 10,
    streakBonus: 5,
    perfectDay: 50,
  },
  timezone: {
    offset: 3, // Ethiopia is UTC+3
  },
};
