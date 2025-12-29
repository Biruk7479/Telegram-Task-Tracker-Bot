# 🚀 Quick Start Guide - Task Tracker Bot Upgrade

## 📋 What You Got

✅ **Google Calendar sync** with color-coding (Blue/Green/Red)  
✅ **Web task management** (create, edit, delete from website)  
✅ **Web task completion** (mark tasks done from website)  
✅ **Fixed all scheduledFor bugs** (tasks show on correct dates)  
✅ **Ready for new MongoDB** (clean database structure)

---

## ⚡ 5-Minute Setup

### Step 1: Install Package
```bash
cd /home/aj7479/Desktop/Telegram_task_tracker_bot_clean
npm install
```

### Step 2: Google Calendar Setup

1. **Go to**: https://console.cloud.google.com/
2. **Create project** → Enable "Google Calendar API"
3. **Create OAuth 2.0 credentials**:
   - Type: Web application
   - Redirect URI: `http://localhost:3001/api/auth/google/callback`
4. **Copy Client ID and Secret**

### Step 3: Update `.env`

```env
# Add these lines to your .env file:

# Google Calendar
GOOGLE_CLIENT_ID=paste_your_client_id
GOOGLE_CLIENT_SECRET=paste_your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
GOOGLE_CALENDAR_ID=primary

# Will fill these next:
USER1_GOOGLE_REFRESH_TOKEN=
USER2_GOOGLE_REFRESH_TOKEN=

# Your NEW MongoDB URI:
MONGODB_URI=mongodb+srv://your-new-cluster-uri
```

### Step 4: Authorize Google Calendar

**Terminal 1 - Start API:**
```bash
npm run dev:api
```

**Browser:**
1. Go to: `http://localhost:3001/api/auth/google/url`
2. Copy the URL and open it
3. Sign in with Zen's Google account
4. Allow permissions
5. **Copy the refresh token** from the page
6. Paste into `.env` as `USER1_GOOGLE_REFRESH_TOKEN`

**Repeat for Lily:**
1. Get new auth URL (same endpoint)
2. Sign in with Lily's Google account
3. Copy her refresh token
4. Paste into `.env` as `USER2_GOOGLE_REFRESH_TOKEN`

### Step 5: Restart Everything

```bash
# Terminal 1: Bot
npm run dev:bot

# Terminal 2: API
npm run dev:api

# Terminal 3: Web
npm run dev:web
```

---

## 🎨 Color System

| Who | Color | In Calendar |
|-----|-------|-------------|
| Zen only | 🔵 Blue | Clearly Zen's task |
| Lily only | 🟢 Green | Clearly Lily's task |
| Both | 🔴 Red | Shared responsibility |

---

## 🌐 Using Web Interface

### Add Task Manager to Your Page

```tsx
// app/tasks/page.tsx
import TaskManager from '@/components/TaskManager';

const ZEN_ID = '5780476905';
const LILY_ID = '1362950195';

<TaskManager
  tasks={tasks}
  currentUserId={ZEN_ID}
  partnerUserId={LILY_ID}
  onTaskCreated={() => refetch()}
  onTaskUpdated={() => refetch()}
  onTaskDeleted={() => refetch()}
/>
```

### Add Completion Buttons

```tsx
import TaskCompletionButton from '@/components/TaskCompletionButton';

<TaskCompletionButton
  taskId={task._id}
  taskName={task.name}
  userId={currentUserId}
  scheduledFor="2025-12-29"
  onCompletionChanged={() => refetch()}
/>
```

---

## 🧪 Test It

### Test 1: Create Task via Telegram
```
/addtask
→ Follow prompts
→ Check Google Calendar
→ Should appear with correct color
```

### Test 2: Create Task via Web
```
1. Go to task management page
2. Click "Create New Task"
3. Fill form
4. Submit
→ Check Google Calendar
```

### Test 3: Complete Task via Web
```
1. Click "✓ Complete" button
2. Check Google Calendar
→ Event should show ✅ in title
```

### Test 4: Color Coding
```
Create 3 tasks:
- Assigned to Zen → 🔵 Blue
- Assigned to Lily → 🟢 Green  
- Assigned to Both → 🔴 Red
```

---

## 📁 New Files Created

```
bot/services/googleCalendarService.js  ← Calendar sync logic
web/components/TaskManager.tsx         ← Full CRUD UI
web/components/TaskCompletionButton.tsx ← Mark complete/skip
web/components/GoogleCalendarAuth.tsx   ← Easy authorization
SETUP_GUIDE.md                         ← Detailed setup
IMPLEMENTATION_SUMMARY.md              ← Complete overview
QUICK_START.md                         ← This file
```

---

## 🛠️ Troubleshooting

### Calendar not syncing?
```bash
# Check these in .env:
✓ GOOGLE_CLIENT_ID is set
✓ GOOGLE_CLIENT_SECRET is set
✓ USER1_GOOGLE_REFRESH_TOKEN is set
✓ USER2_GOOGLE_REFRESH_TOKEN is set

# Restart bot and API
```

### Tasks showing wrong color?
```javascript
// Check task in MongoDB:
db.tasks.findOne({ name: "Task Name" })

// Should have:
assignedTo: ["5780476905"] // Just Zen → Blue
assignedTo: ["1362950195"] // Just Lily → Green
assignedTo: ["5780476905", "1362950195"] // Both → Red
```

### Can't mark task complete?
```javascript
// Check user ID matches:
currentUserId must be in task.assignedTo array
```

---

## 📊 What Changed

**Before:**
- ❌ No Google Calendar
- ❌ No web task management  
- ❌ Tasks showing on wrong dates
- ❌ MongoDB had inconsistent data

**After:**
- ✅ Automatic Google Calendar sync
- ✅ Full web CRUD for tasks
- ✅ Tasks always show on correct dates
- ✅ Clean MongoDB structure
- ✅ Color-coded calendar view

---

## 🎯 Your Workflow Now

### Create Tasks:
- Option 1: Telegram `/addtask` or `/bulkadd`
- Option 2: Web UI form
- **Both** → Automatically synced to Google Calendar

### Check Tasks:
- Option 1: Google Calendar (visual, color-coded)
- Option 2: Website calendar view
- Option 3: Telegram `/listtasks`

### Complete Tasks:
- Option 1: Telegram `/markdone`
- Option 2: Web completion button
- Option 3: Telegram bot asks at scheduled time
- **All** → Updates Google Calendar with ✅

---

## 🚦 Status Indicators

**Google Calendar:**
- `Task Name` → Pending
- `✅ Task Name` → Completed
- `❌ Task Name` → Missed

**Colors:**
- 🔵 Blue → Zen's responsibility
- 🟢 Green → Lily's responsibility
- 🔴 Red → Both responsible

---

## 📞 Need Help?

1. Check `SETUP_GUIDE.md` for detailed steps
2. Check `IMPLEMENTATION_SUMMARY.md` for architecture
3. Check console logs: `npm run dev:bot` and `npm run dev:api`
4. Check browser console (F12)

---

## ✅ Ready Checklist

Before using in production:

- [ ] Google Calendar API enabled
- [ ] OAuth credentials created
- [ ] Zen authorized (refresh token in .env)
- [ ] Lily authorized (refresh token in .env)
- [ ] New MongoDB URI configured
- [ ] All 3 services running (bot, API, web)
- [ ] Created test task from Telegram
- [ ] Created test task from web
- [ ] Verified task appears in Google Calendar
- [ ] Verified correct color (blue/green/red)
- [ ] Marked task complete from web
- [ ] Verified ✅ appears in Google Calendar

---

**🎉 You're all set! Start creating tasks and enjoy your color-coded, web-managed, Google Calendar-synced task tracker!**

**Questions? Check SETUP_GUIDE.md or IMPLEMENTATION_SUMMARY.md**
