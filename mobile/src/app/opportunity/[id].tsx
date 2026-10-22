// Create or edit an opportunity: what it is, who it is for, when it closes,
// when to apply, and the checklist of what it asks for.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Button, Chip, T } from '../../components/ui';
import { createOpportunity, deleteOpportunity, fetchOpportunities, setRequirement, updateOpportunity, type OpportunityInput } from '../../lib/api';
import { localToday } from '../../lib/local';
import { useStore } from '../../lib/store';
import { memberColor, statusColor, type as size, usePalette } from '../../lib/theme';
import type { OpportunityCategory, OpportunityStatus, Requirement } from '../../lib/types';

type Who = 'me' | 'partner' | 'both';

const CATEGORIES: OpportunityCategory[] = [
  'Scholarship', 'Internship', 'Job', 'Fellowship', 'Competition', 'Grant', 'Conference', 'Programme', 'Research', 'Volunteering', 'Other',
];
const STATUSES: OpportunityStatus[] = ['Watching', 'Preparing', 'Applied', 'Interview', 'Accepted', 'Rejected', 'Missed', 'Withdrawn'];

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const orNull = (s: string) => (s.trim() ? s.trim() : null);

export default function OpportunityForm() {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { session, board, refresh } = useStore();

  const [loaded, setLoaded] = useState(isNew);
  const [name, setName] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [link, setLink] = useState('');
  const [category, setCategory] = useState<OpportunityCategory>('Scholarship');
  const [status, setStatus] = useState<OpportunityStatus>('Watching');
  const [who, setWho] = useState<Who>('me');
  const [deadline, setDeadline] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [applyFrom, setApplyFrom] = useState('');
  const [applyOn, setApplyOn] = useState('');
  const [applyTime, setApplyTime] = useState('');
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  // How many requirement lines the server knows about: only those can be ticked in place.
  const [savedCount, setSavedCount] = useState(0);
  const [appliedOn, setAppliedOn] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const meId = session?.user.telegramId ?? '';
  const members = board?.members ?? [];
  const partner = members.find((m) => m.userId !== meId);
  const partnerId = partner?.userId ?? '';

  useEffect(() => {
    if (!session || isNew) return;
    fetchOpportunities(session).then((opps) => {
      const o = opps.find((x) => x._id === id);
      if (!o) return router.back();
      setName(o.name);
      setOrganisation(o.organisation ?? '');
      setLink(o.link ?? '');
      setCategory(o.category ?? 'Other');
      setStatus(o.status ?? 'Watching');
      setWho(o.assignedTo.length > 1 ? 'both' : o.assignedTo[0] === meId ? 'me' : 'partner');
      setDeadline(o.deadline ?? '');
      setDeadlineTime(o.deadlineTime ?? '');
      setApplyFrom(o.applyFrom ?? '');
      setApplyOn(o.applyOn ?? '');
      setApplyTime(o.applyTime ?? '');
      setRequirements(o.requirements ?? []);
      setSavedCount((o.requirements ?? []).length);
      setAppliedOn(o.appliedOn ?? null);
      setNotes(o.notes ?? '');
      setLoaded(true);
    }).catch(() => router.back());
  }, [session, id, isNew, meId]);

  const problem = (() => {
    if (!name.trim()) return 'Give it a name';
    if (deadline.trim() && !DATE_RE.test(deadline.trim())) return 'Deadline must look like 2026-10-25';
    if (deadlineTime.trim() && !TIME_RE.test(deadlineTime.trim())) return 'Deadline time must look like 17:00';
    if (applyFrom.trim() && !DATE_RE.test(applyFrom.trim())) return 'Opening date must look like 2026-10-25';
    if (applyOn.trim() && !DATE_RE.test(applyOn.trim())) return 'Apply date must look like 2026-10-25';
    if (applyTime.trim() && !TIME_RE.test(applyTime.trim())) return 'Apply time must look like 09:00';
    return null;
  })();

  const save = async () => {
    if (!session || problem) return;
    setBusy(true);
    const assignedTo = who === 'both' ? [meId, partnerId] : [who === 'me' ? meId : partnerId];
    const today = board?.today ?? localToday();
    const body: Partial<OpportunityInput> = {
      name: name.trim(),
      organisation: organisation.trim(),
      link: link.trim(),
      category,
      status,
      assignedTo,
      deadline: orNull(deadline),
      deadlineTime: orNull(deadlineTime),
      applyFrom: orNull(applyFrom),
      applyOn: orNull(applyOn),
      applyTime: orNull(applyTime),
      requirements: requirements.map((r) => ({ text: r.text.trim(), done: r.done })).filter((r) => r.text),
      notes,
      // The day it was applied for: stamped the first time it leaves Watching/Preparing.
      appliedOn,
    };
    try {
      if (isNew) await createOpportunity(session, body);
      else await updateOpportunity(session, id, body);
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
    Alert.alert('Delete opportunity?', `“${name.trim() || 'This one'}” and its checklist will be gone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteOpportunity(session, id);
            await refresh();
            router.back();
          } catch (err) {
            Alert.alert('Could not delete', err instanceof Error ? err.message : '');
          }
        },
      },
    ]);
  };

  // Ticking a line the server already has saves straight away; new unsaved
  // lines only flip locally until Save.
  const toggle = async (index: number) => {
    const done = !requirements[index].done;
    setRequirements((rs) => rs.map((r, i) => (i === index ? { ...r, done } : r)));
    if (isNew || !session || index >= savedCount) return;
    try {
      const fresh = await setRequirement(session, id, index, done);
      if (fresh?.requirements) setSavedCount(fresh.requirements.length);
    } catch (err) {
      setRequirements((rs) => rs.map((r, i) => (i === index ? { ...r, done: !done } : r)));
      Alert.alert('Could not update', err instanceof Error ? err.message : '');
    }
  };

  const input = [styles.input, { color: p.text, borderColor: p.border, backgroundColor: p.card }];

  if (!loaded) return <ActivityIndicator style={{ marginTop: 60 }} color={p.muted} />;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: isNew ? 'New opportunity' : 'Edit opportunity' }} />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <T size={size.sm} muted>Name</T>
        <TextInput value={name} onChangeText={setName} placeholder="Chevening Scholarship" placeholderTextColor={p.muted} style={input} />

        <T size={size.sm} muted>Organisation</T>
        <TextInput value={organisation} onChangeText={setOrganisation} placeholder="Who offers it" placeholderTextColor={p.muted} style={input} />

        <T size={size.sm} muted>Link</T>
        <View style={[styles.wrap, { gap: 8 }]}>
          <TextInput
            value={link} onChangeText={setLink} placeholder="https://…" placeholderTextColor={p.muted}
            autoCapitalize="none" keyboardType="url" style={[input, { flex: 1 }]}
          />
          {/^https?:\/\//i.test(link.trim()) ? (
            <Button label="Open" kind="ghost" onPress={() => Linking.openURL(link.trim()).catch(() => {})} style={{ height: 48 }} />
          ) : null}
        </View>

        <T size={size.sm} muted>Category</T>
        <View style={styles.wrap}>
          {CATEGORIES.map((c) => <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />)}
        </View>

        <T size={size.sm} muted>Status</T>
        <View style={styles.wrap}>
          {STATUSES.map((s) => <Chip key={s} label={s} active={status === s} onPress={() => setStatus(s)} color={statusColor(p, s)} />)}
        </View>

        <T size={size.sm} muted>Who</T>
        <View style={styles.wrap}>
          <Chip label="Me" active={who === 'me'} onPress={() => setWho('me')} color={memberColor(p, Math.max(0, members.findIndex((m) => m.userId === meId)))} />
          {partner ? (
            <Chip label={partner.name} active={who === 'partner'} onPress={() => setWho('partner')} color={memberColor(p, members.indexOf(partner))} />
          ) : null}
          <Chip label="Both" active={who === 'both'} onPress={() => setWho('both')} />
        </View>

        <T size={size.sm} muted>Deadline</T>
        <View style={[styles.wrap, { gap: 8 }]}>
          <TextInput value={deadline} onChangeText={setDeadline} placeholder="YYYY-MM-DD" placeholderTextColor={p.muted} keyboardType="numbers-and-punctuation" style={[input, { flex: 1 }]} />
          <TextInput value={deadlineTime} onChangeText={setDeadlineTime} placeholder="HH:MM" placeholderTextColor={p.muted} keyboardType="numbers-and-punctuation" style={[input, { width: 104 }]} />
        </View>

        <T size={size.sm} muted>Applications open on</T>
        <TextInput value={applyFrom} onChangeText={setApplyFrom} placeholder="YYYY-MM-DD (optional)" placeholderTextColor={p.muted} keyboardType="numbers-and-punctuation" style={input} />

        <T size={size.sm} muted>I will apply on</T>
        <View style={[styles.wrap, { gap: 8 }]}>
          <TextInput value={applyOn} onChangeText={setApplyOn} placeholder="YYYY-MM-DD" placeholderTextColor={p.muted} keyboardType="numbers-and-punctuation" style={[input, { flex: 1 }]} />
          <TextInput value={applyTime} onChangeText={setApplyTime} placeholder="HH:MM" placeholderTextColor={p.muted} keyboardType="numbers-and-punctuation" style={[input, { width: 104 }]} />
        </View>

        <T size={size.sm} muted>What it asks for</T>
        {requirements.map((r, i) => (
          <View key={i} style={[styles.wrap, { gap: 8 }]}>
            <Pressable onPress={() => toggle(i)} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: r.done }}>
              <Ionicons name={r.done ? 'checkbox' : 'square-outline'} size={28} color={r.done ? p.good : p.muted} />
            </Pressable>
            <TextInput
              value={r.text}
              onChangeText={(text) => setRequirements((rs) => rs.map((x, j) => (j === i ? { ...x, text } : x)))}
              placeholder="e.g. Two reference letters"
              placeholderTextColor={p.muted}
              style={[input, { flex: 1 }, r.done ? { textDecorationLine: 'line-through', color: p.muted } : null]}
            />
            <Pressable onPress={() => setRequirements((rs) => rs.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel="Remove requirement">
              <Ionicons name="close" size={24} color={p.muted} />
            </Pressable>
          </View>
        ))}
        <Button label="Add a requirement" kind="ghost" onPress={() => setRequirements((rs) => [...rs, { text: '', done: false }])} />
        {!isNew && requirements.length > savedCount ? (
          <T size={size.xs} muted>New lines are kept once you save.</T>
        ) : null}

        <T size={size.sm} muted>Notes</T>
        <TextInput value={notes} onChangeText={setNotes} placeholder="Optional" placeholderTextColor={p.muted} multiline style={[input, { height: 100, paddingTop: 12 }]} />

        {problem ? <T size={size.sm} color={p.warn}>{problem}</T> : null}
        <Button label={busy ? 'Saving…' : 'Save'} onPress={save} disabled={!!problem || busy} />
        {!isNew ? <Button label="Delete opportunity" kind="danger" onPress={remove} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 8, paddingBottom: 48 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
});
