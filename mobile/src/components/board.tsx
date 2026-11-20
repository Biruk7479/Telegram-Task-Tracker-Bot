// Pieces of the Board screen: the duel, a member's checklist, the week strip,
// the savings goal, and the sheet that opens on a long press.
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { counterText, shortNumber } from '../lib/local';
import { memberColor, type as size, usePalette, type Palette } from '../lib/theme';
import type { Action, Board, DaySummary, Goal, Member, Occurrence } from '../lib/types';
import { Avatar, Bar, Button, Card, PressableScale, SplitCell, T } from './ui';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function DuelCard({ board }: { board: Board }) {
  const p = usePalette();
  const owed = board.members.flatMap((m) => m.pendingRewards.map((r) => ({ name: m.name, r })));
  return (
    <Card style={{ gap: 12 }}>
      {board.members.map((m, i) => (
        <View key={m.userId} style={{ gap: 6 }}>
          <View style={styles.row}>
            <Avatar name={m.name} color={memberColor(p, i)} diameter={26} />
            <T bold size={size.md} style={{ flex: 1 }}>{m.name}</T>
            <T bold size={size.md} color={m.weeklyXp < board.rules.startXp ? p.danger : p.text}>♥ {m.weeklyXp}</T>
            <T size={size.sm} muted>  L{m.level} · 🙏{m.excusesLeft}</T>
          </View>
          <View style={styles.row}>
            <Bar fraction={m.weeklyXp / board.rules.startXp} color={memberColor(p, i)} height={14} />
          </View>
        </View>
      ))}
      {owed.length ? <T size={size.sm} color={p.danger} lines={1}>🚨 {owed[0].name} owes: {owed[0].r}</T> : null}
    </Card>
  );
}

// The checkbox pops when an item becomes done.
function Check({ o, color }: { o: Occurrence; color: string }) {
  const p = usePalette();
  const done = o.status === 'done';
  const failed = o.status === 'missed' || o.status === 'ignored';
  const scale = useState(() => new Animated.Value(1))[0];
  const wasDone = useRef(done);
  useEffect(() => {
    if (done && !wasDone.current) {
      scale.setValue(0.6);
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 3, tension: 160 }).start();
    }
    wasDone.current = done;
  }, [done, scale]);

  const partial = !done && o.target > 1 && o.progress > 0;
  const glyph = done ? '✓' : failed ? '✕' : o.status === 'excused' ? '–' : partial ? String(o.progress) : '';
  return (
    <Animated.View
      style={[styles.check, {
        transform: [{ scale }],
        borderColor: done ? color : failed ? p.danger : partial ? color : p.border,
        backgroundColor: done ? color : 'transparent',
      }]}
    >
      <T size={size.sm} bold color={done ? '#fff' : failed ? p.danger : color}>{glyph}</T>
    </Animated.View>
  );
}

function ItemRow({ o, color, mine, onTap, onLong }: {
  o: Occurrence; color: string; mine: boolean; onTap?: () => void; onLong?: () => void;
}) {
  const done = o.status === 'done';
  const failed = o.status === 'missed' || o.status === 'ignored';
  const meta = [counterText(o) && `${counterText(o)} ${o.unit}`.trim(), o.time].filter(Boolean).join(' · ');
  return (
    <PressableScale
      onPress={mine ? onTap : undefined}
      onLongPress={mine ? onLong : undefined}
      disabled={!mine}
      style={styles.item}
    >
      <Check o={o} color={color} />
      <View style={{ flex: 1 }}>
        <T size={size.md} lines={2} muted={done || failed} style={done ? { textDecorationLine: 'line-through' } : undefined}>
          {o.taskName}
        </T>
        {meta ? <T size={size.xs} muted lines={1}>{meta}</T> : null}
      </View>
    </PressableScale>
  );
}

export function MemberColumn({ member, index, mine, today, onTap, onLong }: {
  member: Member; index: number; mine: boolean; today: string;
  onTap: (o: Occurrence) => void; onLong: (o: Occurrence) => void;
}) {
  const p = usePalette();
  const color = memberColor(p, index);
  const list = mine ? [...member.yesterdayPending, ...member.items] : member.items;
  const allDone = member.total > 0 && member.done === member.total;
  return (
    <Card style={{ flex: 1, paddingBottom: 6 }}>
      <View style={[styles.row, { marginBottom: 8 }]}>
        <Avatar name={member.name} color={color} diameter={28} />
        <T bold size={size.lg} style={{ flex: 1 }} lines={1}>{mine ? 'You' : member.name}</T>
        <T size={size.lg} bold color={allDone ? color : p.text}>{member.done}/{member.total}</T>
      </View>
      <View style={styles.row}>
        <Bar fraction={member.total ? member.done / member.total : 0} color={color} height={10} />
      </View>
      <ScrollView style={{ marginTop: 8 }} showsVerticalScrollIndicator={false}>
        {list.length === 0 ? <T size={size.sm} muted>Nothing scheduled</T> : null}
        {list.map((o) => (
          <View key={o._id}>
            {o.date !== today ? <T size={size.xs} bold color={p.warn}>YESTERDAY</T> : null}
            <ItemRow o={o} color={color} mine={mine} onTap={() => onTap(o)} onLong={() => onLong(o)} />
          </View>
        ))}
        {mine && list.length ? <T size={size.xs} muted style={{ marginTop: 6 }}>Tap to tick · hold for more</T> : null}
        {!mine && list.length ? <T size={size.xs} muted style={{ marginTop: 6 }}>Only {member.name} can tick these</T> : null}
      </ScrollView>
    </Card>
  );
}

export const stateColor = (p: Palette, d: DaySummary | undefined, userId: string | undefined) =>
  (d && userId && d.members[userId] ? p.state[d.members[userId].state] : p.state.none);

export function WeekStrip({ board }: { board: Board }) {
  const p = usePalette();
  const [a, b] = board.members;
  return (
    <Card style={[styles.row, { justifyContent: 'space-between', paddingVertical: 12 }]}>
      {board.weekDays.map((d, i) => (
        <View key={d.date} style={{ alignItems: 'center', gap: 4 }}>
          <SplitCell a={stateColor(p, d, a?.userId)} b={stateColor(p, d, b?.userId)} size={34} today={d.date === board.today} />
          <T size={size.xs} muted bold={d.date === board.today}>{DAY_LETTERS[i]}</T>
        </View>
      ))}
      <View style={{ alignItems: 'center', marginLeft: 4 }}>
        <T size={size.xl} bold>🔥{board.sharedStreak}</T>
        <T size={size.xs} muted>together</T>
      </View>
    </Card>
  );
}

export function GoalCard({ goal, onAdd }: { goal: Goal; onAdd: (amount: number) => Promise<void> }) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const value = Number(amount.replace(/,/g, ''));
  return (
    <View style={{ flex: 1 }}>
      <PressableScale onPress={() => setOpen(true)} containerStyle={{ flex: 1 }} style={{ flex: 1 }}>
        <Card style={{ flex: 1, justifyContent: 'center', gap: 8 }}>
          <T size={size.sm} muted lines={1}>💰 {goal.name}</T>
          <T bold size={size.lg}>{shortNumber(goal.current)} <T size={size.sm} muted>/ {shortNumber(goal.target)} {goal.unit}</T></T>
          <View style={styles.row}><Bar fraction={goal.percent / 100} color={p.good} height={10} /></View>
        </Card>
      </PressableScale>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: p.glassStrong, borderColor: p.glassBorder }]}>
            <T bold size={size.lg}>Add to {goal.name}</T>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder={`Amount in ${goal.unit}`}
              placeholderTextColor={p.muted}
              autoFocus
              style={[styles.input, { color: p.text, borderColor: p.glassBorder, backgroundColor: p.glass }]}
            />
            <Button
              label={busy ? 'Saving…' : 'Add'}
              disabled={!Number.isFinite(value) || value === 0 || busy}
              onPress={async () => {
                setBusy(true);
                await onAdd(value);
                setBusy(false);
                setAmount('');
                setOpen(false);
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function ItemSheet({ item, excusesLeft, rules, onClose, onAction }: {
  item: Occurrence | null; excusesLeft: number; rules: Board['rules'];
  onClose: () => void; onAction: (action: Action, amount?: number) => void;
}) {
  const p = usePalette();
  if (!item) return null;
  const options: { label: string; action: Action; amount?: number; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean }[] = [
    { label: '✓ Done', action: 'done', kind: 'primary' },
    ...(item.target > 1 ? [
      { label: '+1', action: 'progress' as Action, amount: 1, kind: 'ghost' as const },
      { label: '−1', action: 'progress' as Action, amount: -1, kind: 'ghost' as const, disabled: item.progress <= 0 },
    ] : []),
    { label: `✕ Not done (−${rules.penalty.missed})`, action: 'missed', kind: 'danger' },
    { label: `🙏 Excuse (${excusesLeft} left)`, action: 'excused', kind: 'ghost', disabled: excusesLeft <= 0 && item.status !== 'excused' },
    { label: 'Undo', action: 'undo', kind: 'ghost', disabled: item.status === 'pending' && item.progress === 0 },
  ];
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: p.glassStrong, borderColor: p.glassBorder }]}>
          <View style={[styles.grabber, { backgroundColor: p.border }]} />
          <T bold size={size.lg}>{item.taskName}</T>
          <T size={size.sm} muted>{[item.area, item.time, counterText(item), item.mode === 'pooled' ? 'shared result' : ''].filter(Boolean).join(' · ')}</T>
          <View style={{ gap: 10, marginTop: 10 }}>
            {options.map((o) => (
              <Button key={o.label} label={o.label} kind={o.kind} disabled={o.disabled} onPress={() => { onAction(o.action, o.amount); onClose(); }} />
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  check: { width: 28, height: 28, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  sheet: { padding: 22, paddingBottom: 36, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, gap: 6 },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginBottom: 10 },
  input: { height: 54, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, fontSize: size.md, marginVertical: 8 },
});
