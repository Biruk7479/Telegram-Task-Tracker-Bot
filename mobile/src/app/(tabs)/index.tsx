// The Board: everything at once, no page scrolling. Duel on top, both of your
// days side by side, the week, then savings / next deadline / latest activity.
// Tap your own task to mark it (counters +1); long-press for No, Excuse, Undo.
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DuelCard, GoalCard, ItemSheet, MemberColumn, WeekStrip } from '../../components/board';
import { Card, T } from '../../components/ui';
import { contribute, tapAction } from '../../lib/api';
import { useStore } from '../../lib/store';
import { memberColor, usePalette } from '../../lib/theme';
import type { Occurrence } from '../../lib/types';

const FEED_ICON: Record<string, string> = { done: '✓', missed: '✗', ignored: '✗', excused: '–' };

export default function BoardScreen() {
  const p = usePalette();
  const { board, session, me, error, refreshing, refresh, act } = useStore();
  const [sheet, setSheet] = useState<Occurrence | null>(null);

  if (!board || !session) {
    return (
      <SafeAreaView style={[styles.fill, styles.center, { backgroundColor: p.bg }]}>
        {error ? <T muted>{error}</T> : <ActivityIndicator color={p.text} />}
      </SafeAreaView>
    );
  }

  const next = board.deadlines[0];
  const goal = board.goals[0];
  const feed = board.feed.slice(0, 3);
  const indexOf = (userId: string) => board.members.findIndex((m) => m.userId === userId);

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: p.bg }]}>
      <View style={styles.page}>
        <Pressable onPress={refresh} style={styles.header}>
          <T size={22} bold style={{ flex: 1 }}>Today</T>
          {error ? <T size={11} color={p.warn}>offline · </T> : null}
          <T size={12} muted>{board.today.slice(5)} · {board.daysLeftInWeek}d left </T>
          {refreshing ? <ActivityIndicator size="small" color={p.muted} /> : <T muted>↻</T>}
        </Pressable>

        <DuelCard board={board} />

        <View style={[styles.fill, styles.row]}>
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
        </View>

        <WeekStrip board={board} />

        <View style={[styles.row, { height: 96 }]}>
          {goal ? (
            <GoalCard goal={goal} onAdd={async (amount) => { await contribute(session, goal._id, amount); await refresh(); }} />
          ) : null}
          <Card style={{ flex: 1, justifyContent: 'center', gap: 3 }}>
            {next ? (
              <T size={12} bold lines={1} color={next.daysLeft <= 2 ? p.danger : p.text}>
                📅 {next.name} · {next.daysLeft === 0 ? 'today' : `${next.daysLeft}d`}
              </T>
            ) : (
              <T size={12} muted>No deadlines in 2 weeks</T>
            )}
            {feed.map((f) => (
              <T key={f._id} size={11} lines={1}>
                <T size={11} bold color={memberColor(p, indexOf(f.userId))}>{f.name} </T>
                <T size={11} muted>{FEED_ICON[f.status]} {f.taskName}</T>
              </T>
            ))}
          </Card>
        </View>
      </View>

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
  page: { flex: 1, padding: 12, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 },
  row: { flexDirection: 'row', gap: 8 },
});
