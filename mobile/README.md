# Lizen — Android app and widgets

The mobile companion to the task tracker: one Board screen with everything on
it, a split-day calendar, task management, the weekly duel, and six home-screen
widgets. It talks to the same API as the bot and the website (`bot/api/server.js`).

## Screens

| Tab | What it shows |
| --- | --- |
| **Board** | Everything at once, no scrolling: the duel, both of your days side by side, this week, savings, the next deadline and the latest activity. Tap your task to mark it (counters go +1); long-press for *Not done*, *Excuse*, *Undo*. |
| **Calendar** | The month, each day split diagonally between you; tap a day for both lists. |
| **Tasks** | Every task grouped as Shared / Zen / Lily, with areas from the notebook structure. |
| **Week** | Scores, every penalty this week, excuses left, last week's result, the rules. |

## Widgets

Long-press the home screen → Widgets → **Lizen**. All of them resize, follow the
system light/dark theme, and redraw whenever the app refreshes; Android also
refreshes them every 30 minutes on its own. Taps on your tasks mark them without
opening the app.

| Widget | Default size | What it shows |
| --- | --- | --- |
| Duel | 4×1 | Both weekly XP bars, days left, penalty tasks owed |
| My today | 4×2 | Your checklist — tap to mark done |
| Partner | 4×1 | Your partner's progress ring and what they just did |
| Week | 4×1 | This week's split-day cells, shared streak, savings bar |
| Month | 4×2 | The month as split-day cells |
| Everything | 4×4 | Duel, both checklists, the week, savings and the next deadline |

**One-screen layout** (a standard 4×5 home screen): Duel, My today, Partner, Week
stacked top to bottom fill it exactly. Or use **Everything** alone and resize it
to the whole screen.

## Logging in

Use your own password (`USER1_PASSWORD` / `USER2_PASSWORD` on the server) and the
server address — the same base the website calls, including any base path. To
prefill the server field, set `EXPO_PUBLIC_API_URL` in `mobile/.env` for local
runs, or as an EAS environment variable for cloud builds:

```bash
npx eas-cli@latest env:create --name EXPO_PUBLIC_API_URL --value https://your-server.example --environment preview
```

## Building an installable APK

Widgets need a real build (they don't run in Expo Go). With a free Expo account:

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

EAS builds in the cloud and gives a link to download the `.apk`; open it on each
phone to install.

## Developing

```bash
npm install
npx expo start          # needs a development build: npx eas-cli@latest build --profile development
npx tsc --noEmit        # typecheck
npx expo lint           # lint
npx expo-doctor         # dependency/config checks
```

## Layout

```
index.ts                 entry: Expo Router + the widget task handler
src/app/                 screens (Expo Router)
src/components/          UI pieces for the Board and shared building blocks
src/lib/                 API client, session/cache storage, app state, theme
src/widgets/             widget layouts, data loading, tap handling, refresh
```
