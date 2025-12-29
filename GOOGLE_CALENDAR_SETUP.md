# 🚀 Google Calendar Setup - Step by Step

## ✅ Setup Uses ONE Shared Calendar

All tasks for both Zen and Lily will appear in **one Google Calendar** with colors:
- 🔵 **Blue** = Zen's tasks only
- 🟢 **Green** = Lily's tasks only
- 🔴 **Red** = Tasks for both

You only need to authorize **one** Google account (Zen's or Lily's).

---

## 📝 Step-by-Step Instructions

### Step 1: Go to Google Cloud Console

1. Open browser: https://console.cloud.google.com/
2. Sign in with the Google account you want to use for the shared calendar

### Step 2: Create a Project

1. Click the project dropdown at the top
2. Click "New Project"
3. Name: "Task Tracker Bot"
4. Click "Create"
5. Wait a few seconds for it to be created
6. Make sure you're in the new project (check top bar)

### Step 3: Enable Google Calendar API

1. Go to "APIs & Services" (left sidebar)
2. Click "Library"
3. Search for "Google Calendar API"
4. Click on it
5. Click the blue "Enable" button
6. Wait for it to enable

### Step 4: Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials" (left sidebar)
2. If prompted, configure consent screen first:
   - Click "Configure Consent Screen"
   - Choose "External"
   - Click "Create"
   - Fill in:
     - App name: **Task Tracker Bot**
     - User support email: **your email**
     - Developer contact: **your email**
   - Click "Save and Continue"
   - Skip "Scopes" (click "Save and Continue")
   - Add test users:
     - Add the Gmail address you'll use
     - Click "Save and Continue"
   - Click "Back to Dashboard"

3. Now create credentials:
   - Click "Create Credentials" at the top
   - Choose "OAuth 2.0 Client ID"
   - Application type: **Web application**
   - Name: **Task Tracker Bot**
   - Authorized redirect URIs:
     - Click "Add URI"
     - Paste: `http://localhost:3001/api/auth/google/callback`
   - Click "Create"

4. **IMPORTANT**: Copy these values:
   - **Client ID** (looks like: `123456789-abc123.apps.googleusercontent.com`)
   - **Client Secret** (looks like: `GOCSPX-abc123xyz`)

### Step 5: Add to .env File

1. Open: `/home/aj7479/Desktop/Telegram_task_tracker_bot_clean/.env`

2. Find these lines:
   ```env
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   ```

3. Paste your values:
   ```env
   GOOGLE_CLIENT_ID=123456789-abc123.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-abc123xyz
   ```

### Step 6: Get Refresh Token

1. **Open Terminal** and start the API server:
   ```bash
   cd /home/aj7479/Desktop/Telegram_task_tracker_bot_clean
   npm run dev:api
   ```

2. **Open Browser**: http://localhost:3001/api/auth/google/url

3. You'll see JSON like:
   ```json
   {"authUrl":"https://accounts.google.com/o/oauth2/v2/auth?..."}
   ```

4. **Copy the entire URL** from `authUrl` (starts with `https://accounts.google.com`)

5. **Paste URL in browser** and press Enter

6. **Sign in** with the Google account you want to use (Zen's or Lily's Gmail)

7. You'll see a warning "Google hasn't verified this app":
   - Click "Advanced"
   - Click "Go to Task Tracker Bot (unsafe)"
   - Click "Continue"

8. Grant permissions:
   - Check both boxes for Calendar access
   - Click "Continue"

9. **Copy the refresh token** from the page (long string starting with `1//`)

10. **Add to .env**:
    ```env
    USER1_GOOGLE_REFRESH_TOKEN=1//04-abc123xyz-longstringhere
    ```

### Step 7: Test It!

1. **Restart the API server**:
   - Press `Ctrl+C` in terminal
   - Run: `npm run dev:api`

2. **Start the bot** (new terminal):
   ```bash
   npm run dev:bot
   ```

3. **Create a test task** in Telegram:
   ```
   /addtask
   Test Task
   skip
   (choose assignment)
   (choose type)
   (choose time)
   ```

4. **Check Google Calendar**:
   - Go to: https://calendar.google.com
   - Sign in with the same Google account
   - You should see your task with the correct color!

---

## 🎨 What You'll See in Google Calendar

### Example Tasks:

**Task: "Morning Prayer"**
- Assigned to: Both
- Color: 🔴 **Red**
- Appears at: 7:00 AM daily

**Task: "Gym"**
- Assigned to: Zen only
- Color: 🔵 **Blue**
- Appears at: 6:00 PM Mon/Wed/Fri

**Task: "Study"**
- Assigned to: Lily only
- Color: 🟢 **Green**
- Appears at: 8:00 PM Tue/Thu

### When Tasks Are Completed:

**Before:** `Morning Prayer`
**After:** `✅ Morning Prayer`

### When Tasks Are Missed:

**Before:** `Morning Prayer`
**After:** `❌ Morning Prayer`

---

## 🔍 Troubleshooting

### "Error: invalid_client"
- Double-check Client ID and Secret in `.env`
- Make sure no extra spaces or quotes
- Restart API server after changing `.env`

### "Error: redirect_uri_mismatch"
- In Google Cloud Console, verify redirect URI is exactly:
  `http://localhost:3001/api/auth/google/callback`
- No trailing slash
- Must match exactly

### "Tasks not appearing in calendar"
- Check console logs in terminal running API
- Verify refresh token is set in `.env`
- Make sure Google Calendar API is enabled
- Restart bot: `Ctrl+C` then `npm run dev:bot`

### "Wrong colors"
- Blue = User 1 (Zen) only
- Green = User 2 (Lily) only
- Red = Both users
- Check task assignment when creating

---

## 📱 Sharing the Calendar

Both Zen and Lily can see the same calendar:

**Option 1: Share Calendar** (if using Zen's Google account)
1. Go to Google Calendar settings
2. Find the calendar
3. Click "Share with specific people"
4. Add Lily's email
5. Give her "Make changes to events" permission

**Option 2: Use Shared Google Account**
1. Both sign in with the same Google account
2. Both see all tasks automatically

---

## ✅ You're Done!

Your `.env` file should now have:
```env
GOOGLE_CLIENT_ID=your_actual_client_id
GOOGLE_CLIENT_SECRET=your_actual_secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
GOOGLE_CALENDAR_ID=primary
USER1_GOOGLE_REFRESH_TOKEN=1//your_refresh_token
USER2_GOOGLE_REFRESH_TOKEN=  # Empty is fine!
```

All tasks will appear in one shared Google Calendar with beautiful color-coding! 🎉

---

## 🚀 Next: Use It!

- **Create tasks**: Telegram `/addtask` or Web UI
- **View tasks**: Google Calendar (color-coded!)
- **Complete tasks**: Telegram `/markdone` or Web UI
- **Edit tasks**: Web UI or Telegram `/edittask`

Everything syncs automatically! ✨
