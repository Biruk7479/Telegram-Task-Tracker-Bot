// Pieces of the Board screen: the duel, a member's checklist, the week strip,
// the savings goal, and the sheet that opens on a long press.
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { counterText, statusGlyph, shortNumber } from '../lib/local';
import { memberColor, usePalette, type Palette } from '../lib/theme';
import type { Action, Board, DaySummary, Goal, Member, Occurrence } from '../lib/types';
import { Bar, Button, Card, SplitCell, T } from './ui';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function DuelCard({ board }: { board: Board }) {
  const p = usePalette();
  const owed = board.members.flatMap((m) => m.pendingRewards.map((r) => ({ name: m.name, r })));
  return (
    <Card style={{ gap: 6 }}>
      {board.members.map((m, i) => (
        <View key={m.userId} style={styles.row}>
          <T bold color={memberColor(p, i)} style={{ width: 52 }}>{m.name}</T>
          <Bar fraction={m.weeklyXp / board.rules.startXp} color={memberColor(p, i)} />
          <T size={13} style={{ width: 92, textAlign: 'right' }}>♥ {m.weeklyXp} · L{m.level} · 🙏{m.excusesLeft}</T>
        </View>
      ))}
      {owed.length ? <T size={12} color={p.danger} lines={1}>🚨 {owed[0].name} owes: {owed[0].r}</T> : null}
    </Card>
  );
}

function ItemRow({ o, color, mine, onTap, onLong }: {
  o: Occurrence; color: string; mine: boolean; onTap?: () => void; onLong?: () => void;
}) {
  const p = usePalette();
  const done = o.status === 'done';
  const failed = o.status === 'missed' || o.status === 'ignored';
  const meta = [counterText(o), o.time].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={mine ? onTap : undefined}
      onLongPress={mine ? onLong : undefined}
      delayLongPress={300}
      style={({ pressed }) => [styles.item, { opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={[styles.check, {
        borderColor: done ? color : failed ? p.danger : p.border,
        backgroundColor: done ? color : 'transparent',
      }]}
      >
        <T size={11} bold color={done ? p.card : failed ? p.danger : p.muted}>{statusGlyph(o) === '○' ? '' : statusGlyph(o)}</T>
      </View>
      <View style={{ flex: 1 }}>
        <T size={13} lines={1} muted={done || failed} style={done ? { textDecorationLine: 'line-through' } : undefined}>
          {o.taskName}
        </T>
        {meta ? <T size={10} muted lines={1}>{meta}</T> : null}
      </View>
    </Pressable>
  );
}

export function MemberColumn({ member, index, mine, today, onTap, onLong }: {
  member: Member; index: number; mine: boolean; today: string;
  onTap: (o: Occurrence) => void; onLong: (o: Occurrence) => void;
}) {
  const p = usePalette();
  const color = memberColor(p, index);
  const list = mine ? [...member.yesterdayPending, ...member.items] : member.items;
  return (
    <Card style={{ flex: 1, paddingBottom: 4 }}>
      <View style={[styles.row, { marginBottom: 4 }]}>
        <T bold color={color} style={{ flex: 1 }}>{member.name}</T>
        <T size={13} bold>{member.done}/{member.total}</T>
      </View>
      <Bar fraction={member.total ? member.done / member.total : 0} color={color} height={4} />
      <ScrollView style={{ marginTop: 6 }} showsVerticalScrollIndicator={false}>
        {list.length === 0 ? <T size={12} muted>Nothing scheduled</T> : null}
        {list.map((o) => (
          <View key={o._id}>
            {o.date !== today ? <T size={9} color={p.warn}>YESTERDAY</T> : null}
            <ItemRow o={o} color={color} mine={mine} onTap={() => onTap(o)} onLong={() => onLong(o)} />
          </View>
        ))}
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
    <Card style={[styles.row, { justifyContent: 'space-between' }]}>
      {board.weekDays.map((d, i) => (
        <View key={d.date} style={{ alignItems: 'center', gap: 2 }}>
          <SplitCell a={stateColor(p, d, a?.userId)} b={stateColor(p, d, b?.userId)} size={30} today={d.date === board.today} />
          <T size={10} muted>{DAY_LETTERS[i]}</T>
        </View>
      ))}
      <View style={{ alignItems: 'flex-end', marginLeft: 6 }}>
        <T size={18} bold>🔥{board.sharedStreak}</T>
        <T size={10} muted>together</T>
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
    <Pressable onPress={() => setOpen(true)} style={{ flex: 1 }}>
      <Card style={{ flex: 1, justifyContent: 'center', gap: 6 }}>
        <T size={12} muted lines={1}>💰 {goal.name}</T>
        <T bold>{shortNumber(goal.current)} <T size={12} muted>/ {shortNumber(goal.target)} {goal.unit}</T></T>
        <View style={styles.row}><Bar fraction={goal.percent / 100} color={p.good} /></View>
      </Card>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: p.card }]}>
            <T bold size={16}>Add to {goal.name}</T>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder={`Amount in ${goal.unit}`}
              placeholderTextColor={p.muted}
              autoFocus
              style={[styles.input, { color: p.text, borderColor: p.border }]}
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
    </Pressable>
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
    { label: `✗ Not done (−${rules.penalty.missed})`, action: 'missed', kind: 'danger' },
    { label: `🙏 Excuse (${excusesLeft} left)`, action: 'excused', kind: 'ghost', disabled: excusesLeft <= 0 && item.status !== 'excused' },
    { label: 'Undo', action: 'undo', kind: 'ghost', disabled: item.status === 'pending' && item.progress === 0 },
  ];
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: p.card }]}>
          <T bold size={16}>{item.taskName}</T>
          <T size={12} muted>{[item.area, item.time, counterText(item), item.mode === 'pooled' ? 'shared result' : ''].filter(Boolean).join(' · ')}</T>
          <View style={{ gap: 8, marginTop: 8 }}>
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
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { padding: 20, paddingBottom: 32, borderTopLeftRadius: 22, borderTopRightRadius: 22, gap: 6 },
  input: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, marginVertical: 8 },
});
