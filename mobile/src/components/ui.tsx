// Small building blocks shared by the screens, with the motion that makes the
// app feel alive: bars that fill smoothly, presses that give, cards that
// settle into place, and a burst of confetti when a day is done.
import { useEffect, useState, type ReactNode } from 'react';
import {
  Animated, Easing, Pressable, StyleSheet, Text, View,
  type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import { type as size, usePalette } from '../lib/theme';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return (
    <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }, style]}>
      {children}
    </View>
  );
}

export function T({ children, size: fontSize = size.md, color, bold, muted, style, lines }: {
  children: ReactNode; size?: number; color?: string; bold?: boolean; muted?: boolean; style?: StyleProp<TextStyle>; lines?: number;
}) {
  const p = usePalette();
  return (
    <Text
      numberOfLines={lines}
      style={[{ fontSize, color: color ?? (muted ? p.muted : p.text), fontWeight: bold ? '700' : '400' }, style]}
    >
      {children}
    </Text>
  );
}

// A progress bar that eases to its new value instead of jumping.
export function Bar({ fraction, color, height = 12 }: { fraction: number; color: string; height?: number }) {
  const p = usePalette();
  const clamped = Math.max(0, Math.min(1, fraction));
  const value = useState(() => new Animated.Value(clamped))[0];
  useEffect(() => {
    Animated.spring(value, { toValue: clamped, useNativeDriver: false, friction: 9, tension: 50 }).start();
  }, [clamped, value]);
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: p.faint, overflow: 'hidden', flex: 1 }}>
      <Animated.View
        style={{
          height,
          borderRadius: height / 2,
          backgroundColor: color,
          width: value.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  );
}

// Fades and slides its children in once, optionally after a delay (for staggering).
export function FadeIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 380, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [delay, v]);
  return (
    <Animated.View
      style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}
    >
      {children}
    </Animated.View>
  );
}

// A Pressable that dips slightly while held, so every touch is felt.
// `containerStyle` sizes the touch area itself, e.g. { flex: 1 } to fill a row.
export function PressableScale({ children, onPress, onLongPress, disabled, style, containerStyle }: {
  children: ReactNode; onPress?: () => void; onLongPress?: () => void; disabled?: boolean;
  style?: StyleProp<ViewStyle>; containerStyle?: StyleProp<ViewStyle>;
}) {
  const scale = useState(() => new Animated.Value(1))[0];
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      disabled={disabled}
      onPressIn={() => to(0.96)}
      onPressOut={() => to(1)}
      style={containerStyle}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

// A day cell split diagonally: top-left = first member, bottom-right = second.
export function SplitCell({ a, b, size: s, today, label }: { a: string; b: string; size: number; today?: boolean; label?: string }) {
  const p = usePalette();
  return (
    <View style={{ width: s, height: s, borderRadius: s * 0.24, overflow: 'hidden', borderWidth: today ? 2.5 : 0, borderColor: p.text }}>
      <View style={[styles.tri, { borderTopWidth: s, borderRightWidth: s, borderTopColor: a }]} />
      <View style={[styles.tri, { borderBottomWidth: s, borderLeftWidth: s, borderBottomColor: b }]} />
      {label ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Text style={{ fontSize: Math.max(12, s * 0.38), fontWeight: '700', color: p.text }}>{label}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function Button({ label, onPress, kind = 'primary', disabled, style }: {
  label: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  const bg = kind === 'primary' ? p.accent : 'transparent';
  const fg = kind === 'primary' ? p.card : kind === 'danger' ? p.danger : p.text;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, { backgroundColor: bg, borderColor: kind === 'primary' ? bg : p.border, opacity: disabled ? 0.4 : 1 }, style]}
    >
      <Text style={{ color: fg, fontWeight: '700', fontSize: size.md }}>{label}</Text>
    </PressableScale>
  );
}

export function Chip({ label, active, onPress, color }: { label: string; active: boolean; onPress: () => void; color?: string }) {
  const p = usePalette();
  const tint = color ?? p.accent;
  return (
    <PressableScale
      onPress={onPress}
      style={[styles.chip, { borderColor: active ? tint : p.border, backgroundColor: active ? tint : 'transparent' }]}
    >
      <Text style={{ color: active ? p.card : p.text, fontSize: size.sm, fontWeight: active ? '700' : '500' }}>{label}</Text>
    </PressableScale>
  );
}

// Initial in a colored circle: who a column or a line of activity belongs to.
export function Avatar({ name, color, diameter = 30 }: { name: string; color: string; diameter?: number }) {
  return (
    <View style={{ width: diameter, height: diameter, borderRadius: diameter / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: diameter * 0.46 }}>{name.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

const CONFETTI = ['🎉', '✨', '💚', '💙', '⭐', '🔥'];

// A short celebratory burst. Change `trigger` to fire it again.
export function Confetti({ trigger }: { trigger: number }) {
  const [pieces] = useState(() =>
    Array.from({ length: 14 }, (_, i) => ({
      v: new Animated.Value(0),
      x: (Math.random() - 0.5) * 260,
      rise: 140 + Math.random() * 120,
      spin: (Math.random() - 0.5) * 540,
      emoji: CONFETTI[i % CONFETTI.length],
    })),
  );

  useEffect(() => {
    if (!trigger) return;
    pieces.forEach((piece, i) => {
      piece.v.setValue(0);
      Animated.timing(piece.v, {
        toValue: 1, duration: 1300, delay: i * 25, easing: Easing.out(Easing.quad), useNativeDriver: true,
      }).start();
    });
  }, [trigger, pieces]);

  if (!trigger) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
      {pieces.map((piece, i) => (
        <Animated.Text
          key={i}
          style={{
            position: 'absolute',
            fontSize: 26,
            opacity: piece.v.interpolate({ inputRange: [0, 0.1, 0.75, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateX: piece.v.interpolate({ inputRange: [0, 1], outputRange: [0, piece.x] }) },
              { translateY: piece.v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, -piece.rise, -piece.rise + 60] }) },
              { rotate: piece.v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${piece.spin}deg`] }) },
            ],
          }}
        >
          {piece.emoji}
        </Animated.Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  tri: { position: 'absolute', width: 0, height: 0, borderColor: 'transparent' },
  center: { alignItems: 'center', justifyContent: 'center' },
  button: { height: 52, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, marginRight: 8, marginBottom: 8 },
});
