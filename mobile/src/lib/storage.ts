// Session (server, token, who you are) lives in the encrypted SecureStore;
// the last board is cached in AsyncStorage so the app and the widgets can draw
// instantly and keep working offline. Both are readable from the widget's
// headless task, which runs without the app open.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { Board, User } from './types';

const SESSION_KEY = 'lizen.session';
const BOARD_KEY = 'lizen.board';

export interface Session {
  serverUrl: string;
  token: string;
  user: User;
}

// Accepts the server root (with any base path) or a URL ending in /api.
export const normalizeServerUrl = (url: string) => url.trim().replace(/\/+$/, '').replace(/\/api$/, '');

export const defaultServerUrl = () => normalizeServerUrl(process.env.EXPO_PUBLIC_API_URL ?? '');

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export const saveSession = (session: Session) => SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));

export async function clearSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
  await AsyncStorage.removeItem(BOARD_KEY);
}

export interface CachedBoard {
  board: Board;
  fetchedAt: number;
}

export async function loadCachedBoard(): Promise<CachedBoard | null> {
  try {
    const raw = await AsyncStorage.getItem(BOARD_KEY);
    return raw ? (JSON.parse(raw) as CachedBoard) : null;
  } catch {
    return null;
  }
}

export const cacheBoard = (board: Board) =>
  AsyncStorage.setItem(BOARD_KEY, JSON.stringify({ board, fetchedAt: Date.now() } satisfies CachedBoard));
