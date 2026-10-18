// Loads what the widgets draw. Runs in the headless task too, so it only uses
// storage and fetch; on any network failure it falls back to the last cache.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchBoard, fetchRange } from '../lib/api';
import { loadCachedBoard, loadSession, type Session } from '../lib/storage';
import type { RangeReport } from '../lib/types';
import type { WidgetData } from './components';

const MONTH_KEY = 'lizen.month';
const TIMEOUT = 10000;

const monthBounds = (today: string) => {
  const [y, m] = today.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` };
};

export async function loadMonth(session: Session, today: string): Promise<RangeReport | null> {
  const { from, to } = monthBounds(today);
  try {
    const month = await fetchRange(session, from, to, TIMEOUT);
    await AsyncStorage.setItem(MONTH_KEY, JSON.stringify(month));
    return month;
  } catch {
    const raw = await AsyncStorage.getItem(MONTH_KEY).catch(() => null);
    return raw ? (JSON.parse(raw) as RangeReport) : null;
  }
}

export async function loadWidgetData({ withMonth = false } = {}): Promise<WidgetData> {
  const session = await loadSession();
  if (!session) return { board: null, meId: null, loggedOut: true };

  const meId = session.user.telegramId;
  let board;
  let offline = false;
  try {
    board = await fetchBoard(session, TIMEOUT);
  } catch {
    board = (await loadCachedBoard())?.board ?? null;
    offline = true;
  }
  const month = withMonth && board ? await loadMonth(session, board.today) : null;
  return { board, meId, month, offline };
}
