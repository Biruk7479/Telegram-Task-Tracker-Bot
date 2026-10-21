// Create or edit a task. Areas come from the notebook structure: shared tasks
// pick from the shared (Lizen) areas, personal ones from that person's areas.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Button, Chip, T } from '../../components/ui';
import { createTask, deleteTask, fetchStructure, fetchTasks, updateTask, type TaskInput } from '../../lib/api';
import { useStore } from '../../lib/store';
import { memberColor, type as size, usePalette } from '../../lib/theme';
import type { Owner, StructureArea, Task } from '../../lib/types';

type Who = 'me' | 'partner' | 'both';
type Kind = 'daily' | 'weekly' | 'one-time' | 'flexible';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const KINDS: [Kind, string][] = [['daily', 'Every day'], ['weekly', 'Some days'], ['one-time', 'Once'], ['flexible', 'Whenever']];

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function TaskForm() {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { session, board, refresh } = useStore();

  const [loaded, setLoaded] = useState(isNew);
  const [structure, setStructure] = useState<StructureArea[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<Kind>('daily');
  const [time, setTime] = useState('09:00');
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [date, setDate] = useState(board?.today ?? '');
  const [who, setWho] = useState<Who>('both');
  const [mode, setMode] = useState<'each' | 'pooled'>('each');
  const [target, setTarget] = useState('1');
  const [unit, setUnit] = useState('');
  const [area, setArea] = useState('');
  const [item, setItem] = useState('');
  const [busy, setBusy] = useState(false);

  const meId = session?.user.telegramId ?? '';
  const members = board?.members ?? [];
  const partnerId = members.find((m) => m.userId !== meId)?.userId ?? '';
  // Server user 1 is Zen ("zen" areas), user 2 is Lily ("li" areas).
  const ownerOf = (userId: string): Owner => (members.findIndex((m) => m.userId === userId) === 0 ? 'zen' : 'li');

  useEffect(() => {
    if (!session) return;
    fetchStructure(session).then(setStructure).catch(() => {});
    if (isNew) return;
    fetchTasks(session).then((tasks) => {
      const t = tasks.find((x: Task) => x._id === id);
      if (!t) return router.back();
      setName(t.name);
      setDescription(t.description ?? '');
      setKind(t.type === 'custom' ? 'weekly' : t.type);
      setTime(t.schedule?.time ?? '');
      setDays(t.schedule?.days ?? []);
      setDate(String(t.schedule?.date ?? '').slice(0, 10));
      setWho(t.assignedTo.length > 1 ? 'both' : t.assignedTo[0] === meId ? 'me' : 'partner');
      setMode(t.mode ?? 'each');
      setTarget(String(t.target ?? 1));
      setUnit(t.unit ?? '');
      setArea(t.area ?? '');
      setItem(t.item ?? '');
      setLoaded(true);
    });
  }, [session, id, isNew, meId]);

  const areaOwner: Owner = who === 'both' ? 'lizen' : ownerOf(who === 'me' ? meId : partnerId);
  const areas = structure.filter((s) => s.owner === areaOwner);
  const items = areas.find((a) => a.area === area)?.items ?? [];

  const problem = (() => {
    if (!name.trim()) return 'Give it a name';
    if (kind !== 'flexible' && !TIME_RE.test(time)) return 'Time must look like 07:30';
    if (kind === 'weekly' && days.length === 0) return 'Pick at least one day';
    if (kind === 'one-time' && !DATE_RE.test(date)) return 'Date must look like 2026-10-25';
    if (!(Number(target) >= 1)) return 'Target must be 1 or more';
    return null;
  })();

  const save = async () => {
    if (!session || problem) return;
    setBusy(true);
    const assignedTo = who === 'both' ? [meId, partnerId] : [who === 'me' ? meId : partnerId];
    const schedule = kind === 'flexible' ? {} : kind === 'weekly' ? { time, days } : kind === 'one-time' ? { time, date } : { time };
    const body: Partial<TaskInput> = {
      name: name.trim(), description, schedule, assignedTo, target: Number(target), unit: unit.trim(),
      mode: who === 'both' ? mode : 'each', area, item,
    };
    try {
      if (isNew) await createTask(session, { ...body, type: kind });
      else await updateTask(session, id, body);
      await refresh();
      router.back();
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : '');
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!session) return;
    Alert.alert('Delete task?', 'Past days keep their history. Today’s unanswered copy stops counting.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteTask(session, id);
          await refresh();
          router.back();
        },
      },
    ]);
  };

  const input = [styles.input, { color: p.text, borderColor: p.border, backgroundColor: p.glass }];

  if (!loaded) return <ActivityIndicator style={{ marginTop: 60 }} color={p.muted} />;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: 'transparent' }}>
      <Stack.Screen options={{ title: isNew ? 'New task' : 'Edit task' }} />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <T size={size.sm} muted>Name</T>
        <TextInput value={name} onChangeText={setName} placeholder="Bible — 1 chapter" placeholderTextColor={p.muted} style={input} />

        <T size={size.sm} muted>Who</T>
        <View style={styles.wrap}>
          <Chip label="Me" active={who === 'me'} onPress={() => { setWho('me'); setArea(''); }} color={memberColor(p, members.findIndex((m) => m.userId === meId))} />
          <Chip label={members.find((m) => m.userId === partnerId)?.name ?? 'Partner'} active={who === 'partner'} onPress={() => { setWho('partner'); setArea(''); }} color={memberColor(p, members.findIndex((m) => m.userId === partnerId))} />
          <Chip label="Both" active={who === 'both'} onPress={() => { setWho('both'); setArea(''); }} />
        </View>
        {who === 'both' ? (
          <>
            <View style={styles.wrap}>
              <Chip label="Each of us" active={mode === 'each'} onPress={() => setMode('each')} />
              <Chip label="Together (one result)" active={mode === 'pooled'} onPress={() => setMode('pooled')} />
            </View>
            <T size={size.xs} muted>{mode === 'each' ? 'You both have to do it; each miss costs only the one who missed.' : 'Done by either counts for both; a miss costs you both.'}</T>
          </>
        ) : null}

        {areas.length ? (
          <>
            <T size={size.sm} muted>Area</T>
            <View style={styles.wrap}>
              {areas.map((a) => <Chip key={a.area} label={a.area} active={area === a.area} onPress={() => { setArea(area === a.area ? '' : a.area); setItem(''); }} />)}
            </View>
            {items.length ? (
              <View style={styles.wrap}>
                {items.map((i) => <Chip key={i} label={i} active={item === i} onPress={() => setItem(item === i ? '' : i)} />)}
              </View>
            ) : null}
          </>
        ) : null}

        <T size={size.sm} muted>When</T>
        {isNew ? (
          <View style={styles.wrap}>
            {KINDS.map(([k, label]) => <Chip key={k} label={label} active={kind === k} onPress={() => setKind(k)} />)}
          </View>
        ) : (
          <T size={size.sm}>{KINDS.find(([k]) => k === kind)?.[1]} <T size={size.xs} muted>(to change this, make a new task)</T></T>
        )}
        {kind === 'weekly' ? (
          <View style={styles.wrap}>
            {DAYS.map((d, i) => (
              <Chip key={d} label={d} active={days.includes(i)} onPress={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i].sort())} />
            ))}
          </View>
        ) : null}
        {kind === 'one-time' ? (
          <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={p.muted} style={input} />
        ) : null}
        {kind !== 'flexible' ? (
          <TextInput value={time} onChangeText={setTime} placeholder="Reminder time, e.g. 21:00" placeholderTextColor={p.muted} keyboardType="numbers-and-punctuation" style={input} />
        ) : null}

        <T size={size.sm} muted>How many each time</T>
        <View style={[styles.wrap, { gap: 8 }]}>
          <TextInput value={target} onChangeText={setTarget} keyboardType="number-pad" style={[input, { width: 80 }]} />
          <TextInput value={unit} onChangeText={setUnit} placeholder="unit, e.g. apps" placeholderTextColor={p.muted} style={[input, { flex: 1 }]} />
        </View>
        <T size={size.xs} muted>More than 1 makes it a counter: tap +1 each time; short of the target at day’s end counts as a miss.</T>

        <T size={size.sm} muted>Notes</T>
        <TextInput value={description} onChangeText={setDescription} placeholder="Optional" placeholderTextColor={p.muted} multiline style={[input, { height: 80, paddingTop: 12 }]} />

        {problem ? <T size={size.sm} color={p.warn}>{problem}</T> : null}
        <Button label={busy ? 'Saving…' : 'Save'} onPress={save} disabled={!!problem || busy} />
        {!isNew ? <Button label="Delete task" kind="danger" onPress={remove} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 8, paddingBottom: 48 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
});
