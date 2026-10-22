// The Board: everything at once, no page scrolling. Duel on top, both of your
// days side by side, the week, then savings / next deadline / latest activity.
// Tap your own task to mark it (counters +1); long-press for No, Excuse, Undo.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DuelCard, GoalCard, ItemSheet, MemberColumn, WeekStrip } from '../../components/board';
import { Avatar, Card, Confetti, FadeIn, T } from '../../components/ui';
import { contribute, tapAction } from '../../lib/api';
import { useStore } from '../../lib/store';
import { memberColor, type as size, usePalette } from '../../lib/theme';
import type { Occurrence } from '../../lib/types';

const FEED_ICON: Record<string, string> = { done: '✓', missed: '✕', ignored: '✕', excused: '–' };

const greeting = (time: string) => {
  const h = Number(time.slice(0, 2));
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export default function BoardScreen() {
  const p = usePalette();
  const { board, session, me, error, refreshing, refresh, act } = useStore();
  const [sheet, setSheet] = useState<Occurrence | null>(null);
  const [burst, setBurst] = useState(0);

  // Celebrate the moment your last task of the day is ticked (not on every load).
  const allDone = !!me && me.total > 0 && me.done === me.total;
  const wasAllDone = useRef<boolean | null>(null);
  useEffect(() => {
    if (wasAllDone.current === false && allDone) setBurst((n) => n + 1);
    if (me) wasAllDone.current = allDone;
  }, [allDone, me]);

  if (!board || !session) {
    return (
      <SafeAreaView style={[styles.fill, styles.center, { backgroundColor: p.bg }]}>
        {error ? <T muted>{error}</T> : <ActivityIndicator color={p.text} size="large" />}
      </SafeAreaView>
    );
  }

  const next = board.deadlines[0];
  const goal = board.goals[0];
  const feed = board.feed.slice(0, 3);
  const indexOf = (userId: string) => board.members.findIndex((m) => m.userId === userId);
  const firstName = session.user.name.split(' ')[0];

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: p.bg }]}>
      <View style={styles.page}>
        <Pressable onPress={refresh} style={styles.header}>
          <View style={{ flex: 1 }}>
            <T size={size.sm} muted>{greeting(board.now)}, {firstName}</T>
            <T size={size.xl} bold>{allDone ? 'All done today 🎉' : 'Today'}</T>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T size={size.sm} muted>{board.today.slice(5).replace('-', '/')} · {board.daysLeftInWeek}d left</T>
            {refreshing
              ? <ActivityIndicator size="small" color={p.muted} />
              : <T size={size.sm} color={error ? p.warn : p.muted}>{error ? 'offline ↻' : '↻'}</T>}
          </View>
        </Pressable>

        <FadeIn><DuelCard board={board} /></FadeIn>

        <FadeIn delay={80} style={[styles.fill, styles.row]}>
          {board.members.map((m, i) => (
            <MemberColumn
              key={m.userId}
              member={m}
              index={i}
              mine={m.userId === session.user.telegramId}
              today={board.today}
              onTap={(o) => (o.status === 'missed' || o.status === 'ignored' || o.status === 'excused' ? setSheet(o) : act(o, tapAction(o)))}
              onLong={setSheet}
            />
          ))}
        </FadeIn>

        <FadeIn delay={160}><WeekStrip board={board} /></FadeIn>

        <FadeIn delay={240} style={[styles.row, { height: 112 }]}>
          {goal ? (
            <GoalCard goal={goal} onAdd={async (amount) => { await contribute(session, goal._id, amount); await refresh(); }} />
          ) : null}
          <Card style={{ flex: 1, justifyContent: 'center', gap: 5 }}>
            {next ? (
              <T size={size.sm} bold lines={1} color={next.daysLeft <= 2 ? p.danger : p.text}>
                {next.kind === 'opportunity' ? '💼' : '📅'} {next.name} · {next.daysLeft === 0 ? 'today' : `${next.daysLeft}d`}
              </T>
            ) : (
              <T size={size.sm} muted>No deadlines soon</T>
            )}
            {feed.length === 0 ? <T size={size.xs} muted>No activity yet today</T> : null}
            {feed.map((f) => (
              <View key={f._id} style={styles.feedRow}>
                <Avatar name={f.name} color={memberColor(p, indexOf(f.userId))} diameter={18} />
                <T size={size.xs} lines={1} style={{ flex: 1 }}>
                  <T size={size.xs} bold>{FEED_ICON[f.status]} </T>{f.taskName}
                </T>
              </View>
            ))}
          </Card>
        </FadeIn>
      </View>

      <Confetti trigger={burst} />

      <ItemSheet
        item={sheet}
        excusesLeft={me?.excusesLeft ?? 0}
        rules={board.rules}
        onClose={() => setSheet(null)}
        onAction={(action, amount) => sheet && act(sheet, action, amount)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  page: { flex: 1, padding: 14, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 4, paddingBottom: 2 },
  row: { flexDirection: 'row', gap: 10 },
  feedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
