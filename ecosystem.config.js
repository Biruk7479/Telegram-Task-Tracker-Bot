module.exports = {
  apps: [
    {
      name: 'telegram-bot',
      script: 'bot/index.js',
      watch: false,
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/bot-error.log',
      out_file: './logs/bot-out.log',
      time: true
    },
    {
      name: 'api-server',
      script: 'bot/api/server.js',
      watch: false,
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      time: true
    }
  ]
};
