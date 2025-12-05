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
