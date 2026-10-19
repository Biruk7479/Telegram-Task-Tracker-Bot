import { dark, light, type ThemeMode } from '../lib/theme';
import { WIDGETS, type Size, type WidgetData, type WidgetName } from './components';

export const WIDGET_NAMES = Object.keys(WIDGETS) as WidgetName[];

export const isWidgetName = (name: string): name is WidgetName => name in WIDGETS;

// "system" gives Android both versions to pick from; a chosen theme forces one.
export function renderWidget(name: WidgetName, data: WidgetData, size: Size, mode: ThemeMode = 'system') {
  const Component = WIDGETS[name];
  if (mode === 'light') return <Component data={data} size={size} p={light} />;
  if (mode === 'dark') return <Component data={data} size={size} p={dark} />;
  return {
    light: <Component data={data} size={size} p={light} />,
    dark: <Component data={data} size={size} p={dark} />,
  };
}
