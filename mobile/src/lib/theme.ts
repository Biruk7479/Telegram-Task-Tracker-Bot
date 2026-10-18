// One small palette for the app and the widgets, in light and dark. Member
// colors follow the website: Zen blue, Lily green.
import { useColorScheme } from 'react-native';
import type { DayState } from './types';

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
}

export const light: Palette = {
  bg: '#F6F6F4',
  card: '#FFFFFF',
  border: '#E7E5E1',
  text: '#1C1B1A',
  muted: '#77736D',
  faint: '#EFEDEA',
  accent: '#1C1B1A',
  danger: '#D9483B',
  warn: '#E2A33B',
  good: '#2F9E6A',
  zen: '#3B6FE0',
  lily: '#2F9E6A',
  state: {
    none: '#EFEDEA',
    future: '#E4ECF9',
    open: '#BFD6F6',
    perfect: '#3FB27F',
    partial: '#A6DDBF',
    miss: '#F2A39B',
    bad: '#D9483B',
  },
};

export const dark: Palette = {
  bg: '#121211',
  card: '#1C1C1B',
  border: '#2C2B29',
  text: '#F2F1EE',
  muted: '#9A968F',
  faint: '#262523',
  accent: '#F2F1EE',
  danger: '#EF6A5D',
  warn: '#F0B755',
  good: '#4CC28C',
  zen: '#6E95F0',
  lily: '#4CC28C',
  state: {
    none: '#262523',
    future: '#1F2A3B',
    open: '#2C4C78',
    perfect: '#3FB27F',
    partial: '#2D6B4C',
    miss: '#9A4A42',
    bad: '#D9483B',
  },
};

export const usePalette = () => (useColorScheme() === 'dark' ? dark : light);

// Zen is user 1 on the server; members come back in that order, so index 0 = blue.
export const memberColor = (p: Palette, index: number) => (index === 0 ? p.zen : p.lily);
