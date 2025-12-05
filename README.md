# Telegram Task Tracker Bot

A comprehensive productivity tool combining a Telegram bot for task management and a Next.js web dashboard for visualization and gamification.

## Project Overview

This application helps users track daily and weekly tasks, build streaks, and compete with a partner through an XP-based gamification system. It consists of three main components:
1. **Telegram Bot**: Interface for adding tasks, logging completions, and receiving notifications.
2. **REST API**: Backend service managing data persistence and business logic.
3. **Web Dashboard**: Frontend interface for viewing calendars, statistics, and streaks.

## Features

- **Task Management**: Create daily, weekly, custom, or one-time tasks.
- **Gamification**: Earn XP for completions, level up, and maintain streaks.
- **Weekly Competition**: Compete with a partner for the highest weekly XP score.
- **Penalty System**: Automated penalties for missed tasks and weekly losers.
- **Visual Dashboard**: Interactive calendar view and statistical breakdown.
- **Dark Mode**: Fully supported dark theme for the web interface.

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB (Mongoose)
- **Bot Framework**: node-telegram-bot-api
- **Frontend**: Next.js 14, Tailwind CSS
- **Scheduling**: node-cron

## Prerequisites

- Node.js (v18 or higher)
- MongoDB Database (Local or Atlas)
- Telegram Bot Token (from @BotFather)

## Installation

1. Clone the repository.
2. Install dependencies for the root project (Bot & API):
   ```bash
   npm install
   ```
3. Install dependencies for the web dashboard:
   ```bash
   cd web
   npm install
   cd ..
   ```

## Configuration

Create a `.env` file in the root directory with the following variables:

```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
MONGODB_URI=your_mongodb_connection_string
TELEGRAM_GROUP_CHAT_ID=your_group_chat_id
PORT=3001
```

Create a `.env` file in the `web/` directory:

```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## Running the Application

To run all services (Bot, API, and Web Dashboard) simultaneously:

```bash
npm start
```

This command executes:
- Bot Service
- API Server (Port 3001)
- Next.js Web Server (Port 3000)

## Project Structure

```
.
├── bot/
│   ├── api/          # Express server endpoints
│   ├── data/         # Static data (rewards, etc.)
│   ├── database/     # Mongoose models and connection
│   ├── services/     # Business logic (User, Task, XP)
│   └── index.js      # Bot entry point
├── web/
│   ├── app/          # Next.js app router pages
│   ├── components/   # React UI components
│   └── lib/          # API client utilities
└── package.json      # Root configuration
```

## License

This project is licensed under the MIT License.
