// Small building blocks shared by the screens.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { usePalette } from '../lib/theme';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return (
    <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }, style]}>
      {children}
    </View>
  );
}

export function T({ children, size = 14, color, bold, muted, style, lines }: {
  children: ReactNode; size?: number; color?: string; bold?: boolean; muted?: boolean; style?: StyleProp<TextStyle>; lines?: number;
}) {
  const p = usePalette();
  return (
    <Text
      numberOfLines={lines}
      style={[{ fontSize: size, color: color ?? (muted ? p.muted : p.text), fontWeight: bold ? '600' : '400' }, style]}
    >
      {children}
    </Text>
  );
}

export function Bar({ fraction, color, height = 8 }: { fraction: number; color: string; height?: number }) {
  const p = usePalette();
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: p.faint, overflow: 'hidden', flex: 1 }}>
      <View style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%`, height, backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

// A day cell split diagonally: top-left = first member, bottom-right = second.
export function SplitCell({ a, b, size, today, label }: { a: string; b: string; size: number; today?: boolean; label?: string }) {
  const p = usePalette();
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.22, overflow: 'hidden', borderWidth: today ? 2 : 0, borderColor: p.text }}>
      <View style={[styles.tri, { borderTopWidth: size, borderRightWidth: size, borderTopColor: a }]} />
      <View style={[styles.tri, { borderBottomWidth: size, borderLeftWidth: size, borderBottomColor: b }]} />
      {label ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Text style={{ fontSize: size * 0.36, fontWeight: '600', color: p.text }}>{label}</Text>
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
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: kind === 'primary' ? bg : p.border, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
        style,
      ]}
    >
      <Text style={{ color: fg, fontWeight: '600', fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress, color }: { label: string; active: boolean; onPress: () => void; color?: string }) {
  const p = usePalette();
  const tint = color ?? p.accent;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { borderColor: active ? tint : p.border, backgroundColor: active ? tint : 'transparent' }]}
    >
      <Text style={{ color: active ? p.card : p.text, fontSize: 13, fontWeight: active ? '600' : '400' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  tri: { position: 'absolute', width: 0, height: 0, borderColor: 'transparent' },
  center: { alignItems: 'center', justifyContent: 'center' },
  button: { height: 46, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, marginRight: 6, marginBottom: 6 },
});
