# Google Calendar Integration & Web Management Setup Guide

## Overview

Your Task Tracker Bot now includes:
- ✅ Full web-based task management (create, edit, delete)
- ✅ Google Calendar sync with color-coding
- ✅ Task completion from web interface
- ✅ Proper `scheduledFor` field for all tasks

---

## 1. Setup Google Calendar Integration

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable **Google Calendar API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

### Step 2: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client ID"
3. Configure consent screen if prompted:
   - User Type: External (for personal use)
   - App name: "Task Tracker Bot"
   - User support email: Your email
   - Developer contact: Your email
4. Create OAuth Client ID:
   - Application type: **Web application**
   - Name: "Task Tracker Bot"
   - Authorized redirect URIs: 
     ```
     http://localhost:3001/api/auth/google/callback
     ```
     (Add production URL later if deploying)
5. Save the **Client ID** and **Client Secret**

### Step 3: Update Environment Variables

1. Open your `.env` file
2. Add the Google Calendar configuration:

```env
# Google Calendar Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
GOOGLE_CALENDAR_ID=primary

# These will be filled after authorization
USER1_GOOGLE_REFRESH_TOKEN=
USER2_GOOGLE_REFRESH_TOKEN=
```

3. **Add your new MongoDB URI**:

```env
MONGODB_URI=mongodb+srv://username:password@your-new-cluster.mongodb.net/tasktracker?retryWrites=true&w=majority
```

### Step 4: Authorize Google Calendar Access

1. Start the API server:
   ```bash
   npm run dev:api
   ```

2. Get authorization URL:
   - Open browser: `http://localhost:3001/api/auth/google/url`
   - Or use the web UI component

3. Click the authorization link

4. Sign in with Google (use User 1's account first)

5. Grant calendar permissions

6. Copy the **refresh token** from the callback page

7. Add it to `.env`:
   ```env
   USER1_GOOGLE_REFRESH_TOKEN=paste_token_here
   ```

8. **Repeat for User 2** (your partner):
   - Get new auth URL
   - Sign in with their Google account
   - Copy their refresh token
   - Add to `.env`:
     ```env
     USER2_GOOGLE_REFRESH_TOKEN=paste_token_here
     ```

9. Restart the bot and API server

---

## 2. Google Calendar Color Coding

Tasks will automatically appear in Google Calendar with these colors:

| Color | Assignment | Calendar Color ID |
|-------|-----------|-------------------|
| 🔵 **Blue** | User 1 only (Zen) | 9 |
| 🟢 **Green** | User 2 only (Lily) | 10 |
| 🔴 **Red** | Both users | 11 |

### How it works:

1. When you create a task, it's automatically added to Google Calendar
2. Tasks show up with the correct color based on `assignedTo`
3. When task is completed: ✅ added to title
4. When task is missed: ❌ added to title
5. Recurring tasks (daily/weekly) appear as recurring events

---

## 3. Web Interface Features

### Task Management Page

Add to your Next.js page (e.g., `/app/tasks/page.tsx`):

```tsx
import TaskManager from '@/components/TaskManager';
import GoogleCalendarAuth from '@/components/GoogleCalendarAuth';

// In your component:
<GoogleCalendarAuth />
<TaskManager
  tasks={tasks}
  currentUserId="5780476905" // Zen's ID
  partnerUserId="1362950195" // Lily's ID
  onTaskCreated={refetchTasks}
  onTaskUpdated={refetchTasks}
  onTaskDeleted={refetchTasks}
/>
```

### Task Completion Buttons

Add to calendar or task list:

```tsx
import TaskCompletionButton from '@/components/TaskCompletionButton';

<TaskCompletionButton
  taskId={task._id}
  taskName={task.name}
  userId={currentUserId}
  scheduledFor={date} // YYYY-MM-DD format
  initialCompleted={completion?.completed ?? null}
  onCompletionChanged={refetch}
/>
```

---

## 4. New MongoDB Database

### Migration Steps:

1. **Export existing data** (optional, if you want to keep history):
   ```bash
   # From old cluster
   mongodump --uri="mongodb+srv://old_connection_string" --out=backup
   ```

2. **Update `.env` with new MongoDB URI**:
   ```env
   MONGODB_URI=mongodb+srv://username:password@new-cluster.mongodb.net/tasktracker?retryWrites=true&w=majority
   ```

3. **Start fresh** (recommended since you mentioned fixing errors):
   - Delete bot and restart
   - All new tasks will have proper `scheduledFor` field
   - Clean slate for calendar sync

4. **Or restore data** (if keeping history):
   ```bash
   # To new cluster
   mongorestore --uri="mongodb+srv://new_connection_string" backup
   ```

---

## 5. API Endpoints Reference

### Task Operations

```javascript
// Create task
POST /api/tasks
Body: {
  name: string,
  description?: string,
  type: 'daily' | 'weekly' | 'custom' | 'one-time' | 'flexible',
  schedule?: { time?, days?, date? },
  createdBy: string,
  assignedTo?: string[],
  xpReward?: number
}

// Update task
PUT /api/tasks/:taskId
Body: { name?, description?, schedule?, assignedTo? }

// Delete task
DELETE /api/tasks/:taskId

// Mark complete/incomplete
POST /api/tasks/:taskId/complete
Body: {
  userId: string,
  completed: boolean,
  scheduledFor?: string (YYYY-MM-DD)
}

// Get task by ID
GET /api/tasks/:taskId
```

### Google Calendar Auth

```javascript
// Get authorization URL
GET /api/auth/google/url
Response: { authUrl: string }

// OAuth callback (automatic)
GET /api/auth/google/callback?code=...
```

---

## 6. Testing Checklist

### Before Going Live:

- [ ] Google Calendar credentials configured
- [ ] Both users authorized Google Calendar
- [ ] Refresh tokens added to `.env`
- [ ] New MongoDB URI configured
- [ ] Bot restarted
- [ ] API server running

### Test Cases:

1. **Create Task**:
   - Create task from Telegram bot
   - Check it appears in Google Calendar
   - Verify correct color (blue/green/red)

2. **Complete Task**:
   - Mark complete from web UI
   - Check ✅ appears in Google Calendar event title

3. **Edit Task**:
   - Edit task name from web
   - Verify Google Calendar event updates

4. **Delete Task**:
   - Delete task from web
   - Verify removed from Google Calendar

5. **Recurring Tasks**:
   - Create daily/weekly task
   - Check recurring pattern in Google Calendar

---

## 7. Troubleshooting

### "Failed to sync to Google Calendar"

**Causes:**
- Missing or invalid refresh tokens
- Calendar API not enabled
- Wrong redirect URI

**Solutions:**
1. Check `.env` has both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
2. Verify Google Calendar API is enabled in Cloud Console
3. Re-authorize users to get fresh tokens
4. Check console logs for specific error messages

### "Tasks not showing correct color"

**Cause:** Task `assignedTo` field might be incorrect

**Solution:**
- Check task in MongoDB: `db.tasks.findOne({ name: "Task Name" })`
- Verify `assignedTo` array has correct user IDs
- Re-create task if needed

### "scheduledFor is null or undefined"

**Cause:** Old tasks created before fix

**Solution:**
- New tasks will have proper `scheduledFor`
- Old tasks: Either delete or manually fix in MongoDB:
  ```javascript
  db.completions.updateMany(
    { scheduledFor: { $exists: false } },
    { $set: { scheduledFor: new Date() } }
  )
  ```

---

## 8. Production Deployment

When deploying to production:

1. **Update redirect URI** in Google Cloud Console:
   ```
   https://your-domain.com/api/auth/google/callback
   ```

2. **Update `.env.production`**:
   ```env
   GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/google/callback
   ```

3. **Re-authorize users** with production URL

4. **Test thoroughly** before announcing to users

---

## Next Steps

1. Set up Google Calendar (Steps 1-4)
2. Test task creation from Telegram bot
3. Verify Google Calendar sync works
4. Add web components to your Next.js app
5. Test web-based task management
6. Switch to new MongoDB database
7. Monitor for any issues

Need help? Check the console logs or ask for assistance!
