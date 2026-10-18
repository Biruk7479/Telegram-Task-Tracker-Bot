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

# The two members (only these Telegram ids can use the bot or the API)
USER1_ID=
USER1_NAME=
USER2_ID=
USER2_NAME=

# API login: each member's own password, and the secret that signs tokens
USER1_PASSWORD=
USER2_PASSWORD=
API_SECRET=a_long_random_string

# Dashboard link used in bot messages
WEB_URL=https://your-dashboard.example
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

## How scoring works

Every scheduled task becomes one **occurrence** per person per day (`pending → done | missed | ignored | excused`).
The bot, website and API all read and write these, and weekly XP is calculated from them:
`100 − this week's penalties`.

| Answer | XP |
| --- | --- |
| Done | 0 |
| Excused (2 per week) | 0 |
| Said No, or a counter task short of its target | −10 |
| Never answered before the day closed | −15 |

- A day stays open until **06:00 the next morning**, then closes. Closing catches up after downtime;
  days the server was down for entirely are `void` and cost nothing.
- Each week (Monday–Sunday) settles once, on Monday at 06:00, after Sunday closes.
- Counter tasks (`target`, e.g. 2 job applications) take `+1` taps. Pooled tasks (`mode: "pooled"`) have one result shared by both.
- Rules live in `bot/config.js` under `rules`.

## Upgrading existing data

Run once after deploying, any time except Monday 00:00–06:00:

```bash
npm run migrate            # dry run: shows what would change
npm run migrate -- --apply # copies old completions into occurrences, keeps this week's XP as-is
npm run seed -- --apply    # optional: loads the notebook structure, starter tasks and savings goal
```

## API

Reads are public; writes need `Authorization: Bearer <token>` from `POST /api/auth/login { password }`.

| Method | Path | What |
| --- | --- | --- |
| POST | `/api/auth/login` | `{ password }` → `{ token, user }` |
| GET | `/api/board` | Everything for the one-screen board and widgets |
| GET | `/api/day?date=` | Both members' occurrences for a day |
| GET | `/api/week?week=` | Scores, penalties and excuses left |
| POST | `/api/occurrences/mark` | `{ taskId, date?, action: done\|missed\|excused\|undo\|progress, amount? }` |
| GET/POST | `/api/goals`, `/api/goals/:id/contribute` | Shared goals such as combined savings |
| GET | `/api/structure` | Areas by owner (Li / Zen / shared) |
| GET/POST/PUT/DELETE | `/api/tasks` | Tasks (`target`, `unit`, `mode`, `area`, `item`, `startDate` optional) |

## Tests

```bash
npm test   # unit tests
# integration tests need a throwaway MongoDB:
docker run -d --rm --name duo-test-mongo -p 127.0.0.1:27099:27017 mongo:7
TEST_MONGODB_URI=mongodb://127.0.0.1:27099/duo_test npm test
```

## Project Structure

```
.
├── bot/
│   ├── api/          # Express server endpoints
│   ├── data/         # Static data (rewards, etc.)
│   ├── database/     # Mongoose models and connection
│   ├── scripts/      # One-off migration and seed scripts
│   ├── services/     # Business logic (occurrences, scheduling, tasks, users)
│   ├── utils/        # Timezone-safe date helpers
│   └── index.js      # Bot entry point and scheduler
├── test/             # node:test unit and integration tests
├── web/
│   ├── app/          # Next.js app router pages
│   ├── components/   # React UI components
│   └── lib/          # API client utilities
└── package.json      # Root configuration
```

## License

This project is licensed under the MIT License.
