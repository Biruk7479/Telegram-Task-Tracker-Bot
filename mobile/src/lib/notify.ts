// Phone notifications, planned on the device so they work offline:
// - a reminder at each of your tasks' times over the next three days
//   (none for anything already ticked today),
// - an evening nudge and a last call before 06:00 while today still has open tasks,
// - your partner's ticks, noticed whenever the app or the widgets sync.
// Re-planned on every sync; a signature check avoids rescheduling when nothing changed.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { fetchTasks } from './api';
import type { Session } from './storage';
import type { Board, Task } from './types';

const PREFS_KEY = 'lizen.notify';
const PLAN_KEY = 'lizen.notifyPlan';
const SEEN_KEY = 'lizen.feedSeen';
const ASKED_KEY = 'lizen.notifyAsked';
const ZONE = '+03:00'; // Addis Ababa, no daylight saving

export interface NotifyPrefs {
  reminders: boolean;
  nudge: boolean;
  partner: boolean;
}

const DEFAULTS: NotifyPrefs = { reminders: true, nudge: true, partner: true };

export async function loadNotifyPrefs(): Promise<NotifyPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export async function saveNotifyPrefs(prefs: NotifyPrefs) {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  await AsyncStorage.removeItem(PLAN_KEY); // force a re-plan with the new settings
}

// Show notifications even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

async function ready(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Task reminders', importance: AndroidImportance.HIGH,
  });
  await Notifications.setNotificationChannelAsync('activity', {
    name: 'Partner activity', importance: AndroidImportance.DEFAULT,
  });
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  // Ask once, and only while the app is on screen (the widget task runs in the background).
  if (AppState.currentState !== 'active' || (await AsyncStorage.getItem(ASKED_KEY))) return false;
  await AsyncStorage.setItem(ASKED_KEY, '1');
  return (await Notifications.requestPermissionsAsync()).granted;
}

const addDays = (dateKey: string, n: number) => {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const at = (dateKey: string, time: string) => new Date(`${dateKey}T${time.padStart(5, '0')}:00${ZONE}`);

const scheduledOn = (t: Task & { startDate?: string }, dateKey: string) => {
  if (t.type === 'flexible' || !t.schedule?.time) return false;
  if (t.type === 'one-time') return String(t.schedule.date ?? '').slice(0, 10) === dateKey;
  if (t.startDate && dateKey < t.startDate) return false;
  if (t.type === 'daily') return true;
  const weekday = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
  return (t.schedule.days ?? []).includes(weekday);
};

interface Planned {
  id: string;
  when: number;
  title: string;
  body: string;
  channel: string;
}

function plan(board: Board, tasks: Task[], meId: string, prefs: NotifyPrefs, now: number): Planned[] {
  const me = board.members.find((m) => m.userId === meId);
  const doneToday = new Set((me?.items ?? []).filter((o) => o.status !== 'pending').map((o) => o.taskId));
  const openToday = (me?.items ?? []).filter((o) => o.status === 'pending').length
    + (me?.yesterdayPending.length ?? 0);
  const out: Planned[] = [];

  if (prefs.reminders) {
    for (let i = 0; i < 3; i++) {
      const day = addDays(board.today, i);
      for (const t of tasks) {
        if (!t.assignedTo.includes(meId) || !scheduledOn(t, day)) continue;
        if (i === 0 && doneToday.has(t._id)) continue;
        const when = at(day, t.schedule.time as string).getTime();
        if (when <= now) continue;
        out.push({
          id: `r:${t._id}:${day}`,
          when,
          title: `⏰ ${t.name}`,
          body: t.target > 1
            ? `Time for this — ${t.target} ${t.unit || ''} today. Tap +1 on the widget as you go.`.replace('  ', ' ')
            : 'Time for this. Tick it in Lizen or straight from the widget.',
          channel: 'reminders',
        });
      }
    }
  }

  if (prefs.nudge && openToday > 0) {
    const tasksWord = openToday === 1 ? 'task is' : 'tasks are';
    const evening = at(board.today, '21:30').getTime();
    if (evening > now) {
      out.push({ id: 'n:evening', when: evening, channel: 'reminders',
        title: '🌙 Still open today', body: `${openToday} ${tasksWord} still open. Unanswered ones cost −15 at 06:00.` });
    }
    const lastCall = at(addDays(board.today, 1), '05:00').getTime();
    if (lastCall > now) {
      out.push({ id: 'n:lastcall', when: lastCall, channel: 'reminders',
        title: '⚠️ One hour left', body: `${openToday} ${tasksWord} still open — the day locks at 06:00.` });
    }
  }
  return out.sort((a, b) => a.when - b.when).slice(0, 60);
}

async function syncReminders(session: Session, board: Board, prefs: NotifyPrefs) {
  const tasks = await fetchTasks(session);
  const planned = plan(board, tasks, session.user.telegramId, prefs, Date.now());
  const signature = JSON.stringify(planned.map((p) => [p.id, p.when, p.body]));
  if ((await AsyncStorage.getItem(PLAN_KEY)) === signature) return;

  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const p of planned) {
    await Notifications.scheduleNotificationAsync({
      identifier: p.id,
      content: { title: p.title, body: p.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.when, channelId: p.channel },
    });
  }
  await AsyncStorage.setItem(PLAN_KEY, signature);
}

// Your partner's new ticks since the last sync. Skipped while you're looking at the app.
async function notifyPartner(session: Session, board: Board) {
  const theirs = board.feed.filter((f) => f.userId !== session.user.telegramId && f.status === 'done' && f.resolvedAt);
  const newest = theirs.reduce((m, f) => (f.resolvedAt! > m ? f.resolvedAt! : m), '');
  const seen = await AsyncStorage.getItem(SEEN_KEY);
  if (newest && (!seen || newest > seen)) await AsyncStorage.setItem(SEEN_KEY, newest);
  if (!seen || AppState.currentState === 'active') return; // first run, or already on screen
  for (const f of theirs.filter((x) => x.resolvedAt! > seen).slice(0, 3)) {
    await Notifications.scheduleNotificationAsync({
      content: { title: `${f.name} ✓ ${f.taskName}`, body: 'Your turn 👀' },
      trigger: { channelId: 'activity' },
    });
  }
}

export async function syncNotifications(session: Session, board: Board) {
  try {
    if (!(await ready())) return;
    const prefs = await loadNotifyPrefs();
    await syncReminders(session, board, prefs);
    if (prefs.partner) await notifyPartner(session, board);
  } catch {
    // Notifications are a convenience; never let them break a sync.
  }
}
