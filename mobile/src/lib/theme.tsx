// One small palette for the app and the widgets, in light and dark, plus the
// viewer's choice of theme (system, light or dark) which both follow. Member
// colors follow the website: Zen blue, Lily green.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import type { DayState } from './types';

// Translucent colors for the home-screen widgets, in the exact form the widget
// library's RgbaColor type accepts: `rgba(r, g, b, a)` with a space after each comma.
export type Rgba = `rgba(${number}, ${number}, ${number}, ${number})`;

export interface Palette {
  bg: `#${string}`;
  card: `#${string}`;
  border: `#${string}`;
  text: `#${string}`;
  muted: `#${string}`;
  faint: `#${string}`;
  accent: `#${string}`;
  danger: `#${string}`;
  warn: `#${string}`;
  good: `#${string}`;
  zen: `#${string}`;
  lily: `#${string}`;
  state: Record<DayState, `#${string}`>;
  // Glass: translucent fills and edges over the blurred background.
  glass: string;
  glassStrong: string;
  glassBorder: string;
  track: string;
  backdrop: readonly [string, string, string];
  blobs: readonly [string, string, string];
  // Glass look for the widgets only (the app's screens keep using the keys above):
  // a translucent gradient from `glassFrom` to `glassTo` over the wallpaper, a 1px
  // `widgetBorder` edge, `glassPanel` for the layered rows inside, and `glassMuted`
  // for secondary text, which needs more contrast than `muted` on a translucent card.
  glassFrom: Rgba;
  glassTo: Rgba;
  widgetBorder: Rgba;
  glassPanel: Rgba;
  glassMuted: `#${string}`;
}

export const light: Palette = {
  bg: '#F6F6F4',
  card: '#FFFFFF',
  border: '#E7E5E1',
  text: '#1C1B1A',
  muted: '#5E6372',
  faint: '#EFEDEA',
  accent: '#1C1B1A',
  danger: '#D9483B',
  warn: '#E2A33B',
  good: '#2F9E6A',
  zen: '#3B6FE0',
  lily: '#2F9E6A',
  state: {
    none: '#E9EBF2',
    future: '#E4ECF9',
    open: '#BFD6F6',
    perfect: '#3FB27F',
    partial: '#A6DDBF',
    miss: '#F2A39B',
    bad: '#D9483B',
  },
  glass: 'rgba(255,255,255,0.42)',
  glassStrong: 'rgba(255,255,255,0.86)',
  glassBorder: 'rgba(255,255,255,0.75)',
  track: 'rgba(30,40,80,0.10)',
  backdrop: ['#EAF0FF', '#F4F1FF', '#ECFAF3'],
  blobs: ['#7EA4FF', '#5FD3A0', '#FFB0C9'],
  glassFrom: 'rgba(255, 255, 255, 0.62)',
  glassTo: 'rgba(255, 255, 255, 0.42)',
  widgetBorder: 'rgba(255, 255, 255, 0.55)',
  glassPanel: 'rgba(255, 255, 255, 0.5)',
  glassMuted: '#5A5751',
};

export const dark: Palette = {
  bg: '#121211',
  card: '#1C1C1B',
  border: '#2C2B29',
  text: '#F2F1EE',
  muted: '#A7ABB8',
  faint: '#262523',
  accent: '#F2F1EE',
  danger: '#EF6A5D',
  warn: '#F0B755',
  good: '#4CC28C',
  zen: '#6E95F0',
  lily: '#4CC28C',
  state: {
    none: '#262833',
    future: '#1F2A3B',
    open: '#2C4C78',
    perfect: '#3FB27F',
    partial: '#2D6B4C',
    miss: '#9A4A42',
    bad: '#D9483B',
  },
  glass: 'rgba(28,30,40,0.40)',
  glassStrong: 'rgba(24,26,36,0.92)',
  glassBorder: 'rgba(255,255,255,0.14)',
  track: 'rgba(255,255,255,0.10)',
  backdrop: ['#090B14', '#0E1020', '#0A1512'],
  blobs: ['#2F5BD8', '#1E9E6E', '#7B4BE0'],
  glassFrom: 'rgba(18, 18, 20, 0.58)',
  glassTo: 'rgba(18, 18, 20, 0.4)',
  widgetBorder: 'rgba(255, 255, 255, 0.18)',
  glassPanel: 'rgba(255, 255, 255, 0.1)',
  glassMuted: '#C2BEB7',
};

// Type scale, sized to be read at arm's length.
export const type = { xs: 13, sm: 15, md: 17, lg: 20, xl: 26, xxl: 34 } as const;

export type ThemeMode = 'system' | 'light' | 'dark';

// How cards look: opaque, clear translucent glass, or frosted glass that blurs
// the backdrop behind it. Widgets follow too (solid, or translucent for both
// glass styles, since home-screen widgets cannot blur).
export type SurfaceStyle = 'solid' | 'glass' | 'blur';

const THEME_KEY = 'lizen.theme';
const STYLE_KEY = 'lizen.style';

export async function loadSurfaceStyle(): Promise<SurfaceStyle> {
  try {
    const v = await AsyncStorage.getItem(STYLE_KEY);
    return v === 'solid' || v === 'glass' ? v : 'blur';
  } catch {
    return 'blur';
  }
}

export async function loadThemeMode(): Promise<ThemeMode> {
  try {
    const v = await AsyncStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

const ThemeContext = createContext<{
  mode: ThemeMode; setMode: (m: ThemeMode) => void;
  surface: SurfaceStyle; setSurface: (s: SurfaceStyle) => void;
}>({
  mode: 'system',
  setMode: () => {},
  surface: 'blur',
  setSurface: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [surface, setSurfaceState] = useState<SurfaceStyle>('blur');

  useEffect(() => {
    loadThemeMode().then((m) => {
      setModeState(m);
      Appearance.setColorScheme(m === 'system' ? 'unspecified' : m);
    });
    loadSurfaceStyle().then(setSurfaceState);
  }, []);

  const setSurface = useCallback((v: SurfaceStyle) => {
    setSurfaceState(v);
    AsyncStorage.setItem(STYLE_KEY, v).catch(() => {});
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    // Native views (dialogs, keyboard) follow too, not just our own colors.
    Appearance.setColorScheme(m === 'system' ? 'unspecified' : m);
    AsyncStorage.setItem(THEME_KEY, m).catch(() => {});
  }, []);

  return <ThemeContext.Provider value={{ mode, setMode, surface, setSurface }}>{children}</ThemeContext.Provider>;
}

export const useThemeMode = () => useContext(ThemeContext);

export const usePalette = () => {
  const { mode } = useThemeMode();
  const system = useColorScheme();
  return (mode === 'system' ? system : mode) === 'dark' ? dark : light;
};

// Zen is user 1 on the server; members come back in that order, so index 0 = blue.
export const memberColor = (p: Palette, index: number) => (index === 0 ? p.zen : p.lily);
