import { dark, light } from '../lib/theme';
import { WIDGETS, type Size, type WidgetData, type WidgetName } from './components';

export const WIDGET_NAMES = Object.keys(WIDGETS) as WidgetName[];

export const isWidgetName = (name: string): name is WidgetName => name in WIDGETS;

// Light and dark versions; Android picks one to match the system theme.
export function renderWidget(name: WidgetName, data: WidgetData, size: Size) {
  const Component = WIDGETS[name];
  return {
    light: <Component data={data} size={size} p={light} />,
    dark: <Component data={data} size={size} p={dark} />,
  };
}
