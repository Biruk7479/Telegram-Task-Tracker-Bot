// Entry point for cPanel Node.js App
// This file starts both the Telegram Bot and the API Server

console.log('Starting Telegram Task Tracker...');

// Start the Telegram Bot
require('./bot/index.js');

// Start the API Server
require('./bot/api/server.js');

console.log('Bot and API server initialized successfully!');
