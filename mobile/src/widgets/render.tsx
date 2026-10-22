import { dark, light, type Palette, type SurfaceStyle, type ThemeMode } from '../lib/theme';
import { WIDGETS, type Size, type WidgetData, type WidgetName } from './components';

export const WIDGET_NAMES = Object.keys(WIDGETS) as WidgetName[];

export const isWidgetName = (name: string): name is WidgetName => name in WIDGETS;

// "system" gives Android both versions to pick from; a chosen theme forces one.
// The Solid style turns the translucent glass card into an opaque one.
const solid = (p: Palette): Palette => (p === dark
  ? { ...p, glassFrom: 'rgba(28, 28, 27, 1)', glassTo: 'rgba(28, 28, 27, 1)', glassPanel: 'rgba(255, 255, 255, 0.06)' }
  : { ...p, glassFrom: 'rgba(255, 255, 255, 1)', glassTo: 'rgba(255, 255, 255, 1)', glassPanel: 'rgba(30, 40, 80, 0.06)' });

export function renderWidget(name: WidgetName, data: WidgetData, size: Size, mode: ThemeMode = 'system', style: SurfaceStyle = 'blur') {
  const Component = WIDGETS[name];
  const L = style === 'solid' ? solid(light) : light;
  const D = style === 'solid' ? solid(dark) : dark;
  if (mode === 'light') return <Component data={data} size={size} p={L} />;
  if (mode === 'dark') return <Component data={data} size={size} p={D} />;
  return {
    light: <Component data={data} size={size} p={L} />,
    dark: <Component data={data} size={size} p={D} />,
  };
}
