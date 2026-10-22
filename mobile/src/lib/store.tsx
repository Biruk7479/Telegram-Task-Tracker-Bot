// App-wide state: who is logged in and the current board. The board refreshes
// every minute while the app is open and whenever it comes back to the
// foreground; marks are applied optimistically, then confirmed by the server.
import * as Haptics from 'expo-haptics';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { ApiError, fetchBoard, login as apiLogin, mark } from './api';
import { applyLocally, replaceOccurrence } from './local';
import { clearSession, loadCachedBoard, loadSession, normalizeServerUrl, saveSession, type Session } from './storage';
import type { Action, Board, Member, Occurrence } from './types';
import { refreshWidgets } from '../widgets/refresh';
import { syncNotifications } from './notify';

interface Store {
  ready: boolean;
  session: Session | null;
  board: Board | null;
  error: string | null;
  refreshing: boolean;
  me: Member | null;
  partner: Member | null;
  login: (serverUrl: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  act: (o: Occurrence, action: Action, amount?: number) => Promise<void>;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Callbacks read the session through a ref so they stay stable across renders.
  const sessionRef = useRef<Session | null>(null);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const handleError = useCallback(async (err: unknown) => {
    if (err instanceof ApiError && err.status === 401) {
      await clearSession();
      setSession(null);
      setBoard(null);
      setError('Your login expired. Please log in again.');
      return;
    }
    setError(err instanceof Error ? err.message : 'Something went wrong');
  }, []);

  const refresh = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    setRefreshing(true);
    try {
      const fresh = await fetchBoard(s);
      setBoard(fresh);
      setError(null);
      refreshWidgets(s, fresh);
      syncNotifications(s, fresh);
    } catch (err) {
      await handleError(err);
    } finally {
      setRefreshing(false);
    }
  }, [handleError]);

  // Restore the session and the cached board, then refresh.
  useEffect(() => {
    (async () => {
      const [saved, cached] = await Promise.all([loadSession(), loadCachedBoard()]);
      setSession(saved);
      if (saved && cached) setBoard(cached.board);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!session) return;
    refresh();
    const timer = setInterval(refresh, 60_000);
    const sub = AppState.addEventListener('change', (state) => state === 'active' && refresh());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [session, refresh]);

  const login = useCallback(async (serverUrl: string, password: string) => {
    const url = normalizeServerUrl(serverUrl);
    const { token, user } = await apiLogin(url, password);
    const next = { serverUrl: url, token, user };
    await saveSession(next);
    setError(null);
    setSession(next);
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
    setSession(null);
    setBoard(null);
  }, []);

  const act = useCallback(async (o: Occurrence, action: Action, amount = 1) => {
    const s = sessionRef.current;
    if (!s) return;
    Haptics.impactAsync(action === 'done' || action === 'progress'
      ? Haptics.ImpactFeedbackStyle.Light
      : Haptics.ImpactFeedbackStyle.Medium);
    setBoard((b) => (b ? replaceOccurrence(b, applyLocally(o, action, amount)) : b));
    try {
      await mark(s, { taskId: o.taskId, date: o.date, action, amount });
    } catch (err) {
      await handleError(err);
    }
    await refresh();
  }, [handleError, refresh]);

  const value = useMemo<Store>(() => {
    const me = board?.members.find((m) => m.userId === session?.user.telegramId) ?? null;
    const partner = board?.members.find((m) => m.userId !== session?.user.telegramId) ?? null;
    return { ready, session, board, error, refreshing, me, partner, login, logout, refresh, act };
  }, [ready, session, board, error, refreshing, login, logout, refresh, act]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
