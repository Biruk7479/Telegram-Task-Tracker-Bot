// The glass look: a soft, colorful backdrop that every card, sheet and the tab
// bar blur through. On Android the backdrop must live in a BlurTargetView, and
// each BlurView points at it through context.
import { BlurTargetView, BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { createContext, useContext, useRef, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { dark as darkPalette, usePalette, useThemeMode } from '../lib/theme';

type Target = RefObject<ComponentRef<typeof View> | null>;

const GlassContext = createContext<Target | null>(null);

// A blob with a soft edge: concentric circles whose opacity builds toward the
// middle, which reads as a glow once the glass above blurs it.
function Blob({ color, size, x, y }: { color: string; size: number; x: number; y: number }) {
  const rings = 10;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size }}>
      {Array.from({ length: rings }, (_, i) => {
        const d = size * (1 - i / rings);
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: (size - d) / 2,
              top: (size - d) / 2,
              width: d,
              height: d,
              borderRadius: d / 2,
              backgroundColor: color,
              opacity: 0.09,
            }}
          />
        );
      })}
    </View>
  );
}

// Wraps the whole app: the backdrop behind, everything else on top.
export function GlassProvider({ children }: { children: ReactNode }) {
  const p = usePalette();
  const { surface } = useThemeMode();
  const target = useRef<ComponentRef<typeof View>>(null);
  const { width, height } = useWindowDimensions();
  const [b1, b2, b3] = p.blobs;
  return (
    <GlassContext.Provider value={target}>
      <BlurTargetView ref={target} style={StyleSheet.absoluteFill}>
        {surface === 'solid' ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: p.bg }]} />
        ) : (
          <>
            <LinearGradient colors={p.backdrop} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Blob color={b1} size={width * 1.1} x={width * 0.1} y={height * 0.12} />
            <Blob color={b2} size={width * 1.0} x={width * 0.95} y={height * 0.45} />
            <Blob color={b3} size={width * 0.9} x={width * 0.2} y={height * 0.85} />
          </>
        )}
      </BlurTargetView>
      {children}
    </GlassContext.Provider>
  );
}

// The frosted fill for a rounded container: put it first inside the container.
// Follows the chosen style: solid = opaque card, glass = clear translucent
// pane, blur = frosted pane that blurs the backdrop.
export function GlassFill({ strong }: { strong?: boolean }) {
  const p = usePalette();
  const { surface } = useThemeMode();
  const target = useContext(GlassContext);
  const isDark = p === darkPalette;
  if (surface === 'solid') {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: p.card }]} />;
  }
  return (
    <>
      {target && surface === 'blur' ? (
        <BlurView
          blurTarget={target}
          blurMethod="dimezisBlurViewSdk31Plus"
          intensity={isDark ? 45 : 55}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: strong ? p.glassStrong : p.glass }]} />
    </>
  );
}
