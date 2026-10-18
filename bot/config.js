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
      password: process.env.USER1_PASSWORD,
    },
    user2: {
      id: process.env.USER2_ID,
      name: process.env.USER2_NAME,
      password: process.env.USER2_PASSWORD,
    },
  },
  webUrl: process.env.WEB_URL || 'https://aj-and-lis-task-tracker.vercel.app/',
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
  // Penalty-only scoring: weekly XP starts at startXp and only goes down.
  rules: {
    startXp: 100,
    penalty: {
      missed: 10,  // answered "No", or a counter task short of its target
      ignored: 15, // never answered before the day closed
    },
    excusesPerWeek: 2,
    closeHour: 6,         // a day stays open until 06:00 the next morning
    maxBackfillDays: 14,  // how far back closing catches up after downtime
  },
  timezone: {
    name: 'Africa/Addis_Ababa',
    offset: 3, // Ethiopia is UTC+3
  },
};

module.exports.memberIds = () =>
  [module.exports.users.user1.id, module.exports.users.user2.id].filter(Boolean);

module.exports.isMember = (telegramId) =>
  module.exports.memberIds().includes(String(telegramId));

module.exports.memberName = (telegramId) => {
  const { user1, user2 } = module.exports.users;
  if (String(telegramId) === user1.id) return user1.name;
  if (String(telegramId) === user2.id) return user2.name;
  return 'User';
};
