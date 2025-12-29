# 🚀 Getting Refresh Token for Production Server

## Your Setup

You're using production URL: `https://aauaiandrobotics.com/api/auth/google/callback`

This means you need to deploy first, then get the token.

---

## Step-by-Step Process

### Step 1: Update Google Cloud Console Redirect URI

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your OAuth 2.0 Client ID
3. Under "Authorized redirect URIs", click **"ADD URI"**
4. Add this URL:
   ```
   https://aauaiandrobotics.com/api/auth/google/callback
   ```
5. Click **"SAVE"**

### Step 2: Push Code to Server

```bash
# In your local terminal
cd /home/aj7479/Desktop/Telegram_task_tracker_bot_clean

# Add all changes
git add .

# Commit
git commit -m "Add Google Calendar integration with production redirect URI"

# Push to main
git push origin main
```

### Step 3: Deploy to Server (cPanel)

Since you're using cPanel, your code should auto-deploy or:

1. SSH into your server
2. Navigate to your project directory
3. Pull latest changes:
   ```bash
   git pull origin main
   ```
4. Install new dependencies:
   ```bash
   npm install
   ```

### Step 4: Make Sure API is Running on Server

Check that your API server is running at:
```
https://aauaiandrobotics.com/api/health
```

You should see:
```json
{"status":"ok","timestamp":"2025-12-29T..."}
```

If not running, start it:
```bash
# On your server
npm run api
# or
node bot/api/server.js
# or however you start it on cPanel
```

### Step 5: Get Authorization URL

Once API is running, visit in your browser:
```
https://aauaiandrobotics.com/api/auth/google/url
```

You should see:
```json
{"authUrl":"https://accounts.google.com/o/oauth2/v2/auth?..."}
```

### Step 6: Authorize and Get Token

1. **Copy the entire URL** from the `authUrl` field
2. **Paste it in browser** and press Enter
3. **Sign in** with the Google account you want to use (Zen's or Lily's)
4. You may see "Google hasn't verified this app":
   - Click "Advanced"
   - Click "Go to Task Tracker Bot (unsafe)"
5. **Grant permissions** (allow calendar access)
6. You'll be redirected to:
   ```
   https://aauaiandrobotics.com/api/auth/google/callback?code=...
   ```
7. The page will display your **refresh token**
8. **Copy the refresh token** (long string starting with `1//`)

### Step 7: Add Token to Server .env

1. **SSH into your server**
2. **Edit the .env file**:
   ```bash
   nano /path/to/your/project/.env
   # or
   vim /path/to/your/project/.env
   ```
3. **Find this line**:
   ```env
   USER1_GOOGLE_REFRESH_TOKEN=
   ```
4. **Paste your token**:
   ```env
   USER1_GOOGLE_REFRESH_TOKEN=1//04abc123xyz...
   ```
5. **Save and exit**

### Step 8: Restart API Server

```bash
# On your server
pm2 restart api
# or however you manage your processes
```

### Step 9: Test It!

Create a task and check Google Calendar:

```bash
# Via Telegram
/addtask
Test Google Calendar Task
skip
(choose assignment - Both)
(choose type - daily)
(choose time - 09:00)
```

Then go to: https://calendar.google.com

You should see your task with a 🔴 red color!

---

## Alternative: Test Locally First

If you want to test locally before deploying:

### Option A: Use localhost temporarily

1. **Update .env locally**:
   ```env
   GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
   ```

2. **Add localhost to Google Cloud Console**:
   - Go to credentials
   - Add redirect URI: `http://localhost:3001/api/auth/google/callback`

3. **Get token locally**:
   ```bash
   npm run dev:api
   ```
   Visit: http://localhost:3001/api/auth/google/url

4. **Copy the refresh token**

5. **Update both .env files** (local and server) with the token

6. **Change redirect URI back to production**:
   ```env
   GOOGLE_REDIRECT_URI=https://aauaiandrobotics.com/api/auth/google/callback
   ```

7. **Push to server**

---

## Quick Checklist

Before getting the token:
- [ ] Google Cloud Console has production redirect URI added
- [ ] Code pushed to server
- [ ] Dependencies installed on server (`npm install`)
- [ ] API server running on server
- [ ] Can access: `https://aauaiandrobotics.com/api/health`

To get the token:
- [ ] Visit: `https://aauaiandrobotics.com/api/auth/google/url`
- [ ] Copy the authUrl
- [ ] Open in browser and authorize
- [ ] Copy refresh token from callback page
- [ ] Add to server's `.env` file
- [ ] Restart API server

---

## Troubleshooting

### "redirect_uri_mismatch" error

**Cause:** Google Cloud Console doesn't have your production URL

**Fix:**
1. Go to: https://console.cloud.google.com/apis/credentials
2. Click your OAuth client
3. Make sure this exact URL is in "Authorized redirect URIs":
   ```
   https://aauaiandrobotics.com/api/auth/google/callback
   ```
4. Save and wait 5 minutes for Google to propagate changes

### "Cannot GET /api/auth/google/url"

**Cause:** API server not running or BASE_PATH issue

**Fix:**
Check your .env has:
```env
BASE_PATH=
```
Or if using a base path:
```env
BASE_PATH=/repositories/private/backendAdvanced-telegram-task-tracker
```

Then the URL would be:
```
https://aauaiandrobotics.com/repositories/private/backendAdvanced-telegram-task-tracker/api/auth/google/url
```

### API not responding

**Check:**
1. Is API process running? `pm2 list` or `ps aux | grep node`
2. Check logs: `pm2 logs api` or check error logs
3. Test health endpoint first
4. Check firewall/port 3001

---

## Next Steps After Getting Token

1. ✅ Token in server's `.env`
2. ✅ API restarted
3. ✅ Create a test task
4. ✅ Check Google Calendar
5. ✅ See color-coded task!
6. 🎉 Start using it!

---

**Summary:** Push code → Deploy → Make sure API running → Get token from production URL → Add to server .env → Restart → Test!
