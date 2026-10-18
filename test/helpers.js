// Test environment: fixed members and secrets, set before any module reads
// config (dotenv never overrides variables that are already set).
Object.assign(process.env, {
  USER1_ID: '111',
  USER1_NAME: 'Zen',
  USER1_PASSWORD: 'zen-pass',
  USER2_ID: '222',
  USER2_NAME: 'Lily',
  USER2_PASSWORD: 'lily-pass',
  API_SECRET: 'test-secret',
  START_API: 'false',
  BASE_PATH: '',
  USER1_GOOGLE_REFRESH_TOKEN: '',
  MONGODB_URI: process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:1/unused',
});

// An instant at the given Addis Ababa wall-clock time (UTC+3, no DST).
const at = (dateKey, time = '12:00') => new Date(`${dateKey}T${time}:00+03:00`);

module.exports = { at, ZEN: '111', LILY: '222' };
