// Month view. Each day is split diagonally — top-left is the first member,
// bottom-right the second — and colored by how that day went. Tap a day to
// see both lists for it.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { stateColor } from '../../components/board';
import { Card, SplitCell, T } from '../../components/ui';
import { fetchDay, fetchRange } from '../../lib/api';
import { counterText, statusGlyph } from '../../lib/local';
import { useStore } from '../../lib/store';
import { memberColor, type as size, usePalette } from '../../lib/theme';
import type { DayState, Occurrence, RangeReport } from '../../lib/types';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const LEGEND: [DayState, string][] = [
  ['perfect', 'All done'], ['partial', 'Some done'], ['open', 'Open'], ['miss', '1 missed'], ['bad', '2+ missed'], ['future', 'Planned'],
];

const pad = (n: number) => String(n).padStart(2, '0');

export default function CalendarScreen() {
  const p = usePalette();
  const { width } = useWindowDimensions();
  const { session, board } = useStore();
  const today = board?.today ?? new Date().toISOString().slice(0, 10);
  const [cursor, setCursor] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }));
  const [range, setRange] = useState<RangeReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [day, setDay] = useState<{ userId: string; name: string; items: Occurrence[] }[] | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const last = new Date(Date.UTC(cursor.y, cursor.m, 0)).getUTCDate();
    fetchRange(session, `${cursor.y}-${pad(cursor.m)}-01`, `${cursor.y}-${pad(cursor.m)}-${pad(last)}`)
      .then((r) => { if (!cancelled) { setRange(r); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load'); });
    return () => { cancelled = true; };
  }, [session, cursor]);

  const select = (date: string) => {
    if (!session) return;
    setSelected(date);
    setDay(null);
    fetchDay(session, date).then((d) => setDay(d.members)).catch(() => setDay([]));
  };

  const move = (delta: number) => {
    setSelected(null);
    setRange(null);
    setCursor(({ y, m }) => {
      const d = new Date(Date.UTC(y, m - 1 + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
    });
  };

  const cell = Math.floor((width - 24 - 24 - 6 * 6) / 7);
  const lead = (new Date(Date.UTC(cursor.y, cursor.m - 1, 1)).getUTCDay() + 6) % 7;
  const [a, b] = range?.members ?? [];
  const title = new Date(Date.UTC(cursor.y, cursor.m - 1, 1)).toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: p.bg }}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <Pressable onPress={() => move(-1)} hitSlop={12}><T size={size.xl}>‹</T></Pressable>
          <T size={size.xl} bold style={{ flex: 1, textAlign: 'center' }}>{title}</T>
          <Pressable onPress={() => move(1)} hitSlop={12}><T size={size.xl}>›</T></Pressable>
        </View>

        <Card style={{ gap: 6 }}>
          <View style={styles.week}>
            {WEEKDAYS.map((d, i) => <T key={i} size={size.xs} muted style={{ width: cell, textAlign: 'center' }}>{d}</T>)}
          </View>
          {!range ? (
            <View style={{ height: cell * 5, justifyContent: 'center' }}>
              {error ? <T muted style={{ textAlign: 'center' }}>{error}</T> : <ActivityIndicator color={p.muted} />}
            </View>
          ) : (
            <View style={[styles.week, { flexWrap: 'wrap', rowGap: 6 }]}>
              {Array.from({ length: lead }).map((_, i) => <View key={`l${i}`} style={{ width: cell, height: cell }} />)}
              {range.days.map((d) => (
                <Pressable key={d.date} onPress={() => select(d.date)} style={{ opacity: selected && selected !== d.date ? 0.6 : 1 }}>
                  <SplitCell
                    a={stateColor(p, d, a?.userId)}
                    b={stateColor(p, d, b?.userId)}
                    size={cell}
                    today={d.date === range.today}
                    label={String(Number(d.date.slice(8)))}
                  />
                </Pressable>
              ))}
            </View>
          )}
        </Card>

        <View style={styles.legend}>
          <T size={size.xs} muted>◤ {a?.name ?? ''}   ◢ {b?.name ?? ''}</T>
          {LEGEND.map(([state, label]) => (
            <View key={state} style={styles.legendItem}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: p.state[state] }} />
              <T size={size.xs} muted>{label}</T>
            </View>
          ))}
        </View>

        {selected ? (
          <Card style={{ gap: 8 }}>
            <T bold>{selected}</T>
            {!day ? <ActivityIndicator color={p.muted} /> : day.map((m, i) => (
              <View key={m.userId} style={{ gap: 2 }}>
                <T size={size.sm} bold color={memberColor(p, i)}>{m.name}</T>
                {m.items.length === 0 ? <T size={size.sm} muted>Nothing</T> : m.items.map((o) => (
                  <T key={o._id} size={size.sm}>
                    <T size={size.sm} color={o.status === 'done' ? memberColor(p, i) : o.status === 'missed' || o.status === 'ignored' ? p.danger : p.muted}>
                      {statusGlyph(o)}{' '}
                    </T>
                    {o.taskName} <T size={size.xs} muted>{[counterText(o), o.penalty ? `−${o.penalty}` : '', o.status === 'ignored' ? 'ignored' : ''].filter(Boolean).join(' · ')}</T>
                  </T>
                ))}
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 12, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 },
  week: { flexDirection: 'row', columnGap: 6 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 4, alignItems: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
