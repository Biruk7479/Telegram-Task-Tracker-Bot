import { dark, light, type ThemeMode } from '../lib/theme';
import { WIDGETS, type Size, type WidgetData, type WidgetName } from './components';

export const WIDGET_NAMES = Object.keys(WIDGETS) as WidgetName[];

export const isWidgetName = (name: string): name is WidgetName => name in WIDGETS;

// "system" gives Android both versions to pick from; a chosen theme forces one.
export function renderWidget(name: WidgetName, data: WidgetData, size: Size, mode: ThemeMode = 'system') {
  const Component = WIDGETS[name];
  // Text grows with the widget: single-column widgets up to +35%; the two-column
  // board barely, so task names still fit side by side.
  const k = name === 'Board'
    ? Math.min(1.1, Math.max(1, size.width / 330))
    : Math.min(1.35, Math.max(1, size.width / 270));
  const L = { ...light, k };
  const D = { ...dark, k };
  if (mode === 'light') return <Component data={data} size={size} p={L} />;
  if (mode === 'dark') return <Component data={data} size={size} p={D} />;
  return {
    light: <Component data={data} size={size} p={L} />,
    dark: <Component data={data} size={size} p={D} />,
  };
}
