// Every opportunity — scholarships, internships, jobs and the like — grouped
// by who it is for: mine, both of us, then my partner's. Open ones by default
// (still asking something of you); All shows the settled ones too. Tap to
// edit, + New to add.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bar, Chip, PressableScale, T } from '../../components/ui';
import { fetchOpportunities } from '../../lib/api';
import { countdownText, daysUntil, isOpenOpportunity, localToday } from '../../lib/local';
import { useStore } from '../../lib/store';
import { countdownColor, memberColor, statusColor, type as size, usePalette } from '../../lib/theme';
import type { Opportunity, OpportunityStatus } from '../../lib/types';

type Filter = 'open' | 'all';

export function StatusChip({ status }: { status: OpportunityStatus }) {
  const p = usePalette();
  const tint = statusColor(p, status);
  return (
    <View style={[styles.status, { borderColor: tint }]}>
      <T size={size.xs} bold color={tint}>{status}</T>
    </View>
  );
}

export default function OpportunitiesScreen() {
  const p = usePalette();
  const { session, board } = useStore();
  const [opps, setOpps] = useState<Opportunity[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>('open');

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      setOpps(await fetchOpportunities(session));
    } finally {
      setLoading(false);
    }
  }, [session]);

  // Reload whenever the tab is shown again, e.g. after saving in the form.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const today = board?.today ?? localToday();
  const meId = session?.user.telegramId ?? '';
  const members = board?.members ?? [];
  const myIndex = members.findIndex((m) => m.userId === meId);
  const partner = members.find((m) => m.userId !== meId);
  const shown = (opps ?? []).filter((o) => filter === 'all' || isOpenOpportunity(o.status));
  const sections = [
    { title: 'Mine', color: memberColor(p, myIndex < 0 ? 0 : myIndex), data: shown.filter((o) => o.assignedTo.length === 1 && o.assignedTo[0] === meId) },
    { title: 'Both of us', color: p.text, data: shown.filter((o) => o.assignedTo.length > 1) },
    ...(partner ? [{
      title: partner.name,
      color: memberColor(p, members.indexOf(partner)),
      data: shown.filter((o) => o.assignedTo.length === 1 && o.assignedTo[0] === partner.userId),
    }] : []),
  ].filter((s) => s.data.length);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: p.bg }}>
      <View style={styles.header}>
        <T size={size.xl} bold style={{ flex: 1 }}>Opportunities</T>
      </View>
      <View style={styles.filters}>
        <Chip label="Open" active={filter === 'open'} onPress={() => setFilter('open')} />
        <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
      </View>
      {!opps ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={p.muted} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(o) => o._id}
          contentContainerStyle={{ padding: 12, paddingTop: 0, paddingBottom: 96 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={(
            <T muted style={{ textAlign: 'center', marginTop: 40 }}>
              {filter === 'open' && opps.length ? 'Nothing open — tap All to see the rest.' : 'No opportunities yet — tap + New to add one.'}
            </T>
          )}
          renderSectionHeader={({ section }) => (
            <T size={size.sm} bold color={section.color} style={styles.section}>{section.title.toUpperCase()}</T>
          )}
          renderItem={({ item }) => <Row item={item} today={today} />}
        />
      )}
      <PressableScale
        onPress={() => router.push('/opportunity/new')}
        containerStyle={styles.fabWrap}
        style={[styles.fab, { backgroundColor: p.accent }]}
      >
        <T size={size.md} bold color={p.card}>+ New</T>
      </PressableScale>
    </SafeAreaView>
  );
}

function Row({ item, today }: { item: Opportunity; today: string }) {
  const p = usePalette();
  const days = item.deadline ? daysUntil(item.deadline, today) : null;
  const ready = item.requirements.filter((r) => r.done).length;
  const total = item.requirements.length;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/opportunity/[id]', params: { id: item._id } })}
      style={({ pressed }) => [styles.row, { backgroundColor: p.card, borderColor: p.border, opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={styles.rowTop}>
        <View style={{ flex: 1, gap: 2 }}>
          <T bold lines={1}>{item.name}</T>
          <T size={size.sm} muted lines={1}>{[item.organisation, item.category].filter(Boolean).join(' · ')}</T>
        </View>
        <StatusChip status={item.status} />
      </View>
      <View style={styles.rowBottom}>
        {days === null ? (
          <T size={size.sm} muted style={{ flex: 1 }}>No deadline</T>
        ) : (
          <T size={size.sm} bold color={countdownColor(p, days)} style={{ flex: 1 }} lines={1}>
            {countdownText(days)}{item.deadlineTime ? ` · ${item.deadlineTime}` : ''}
          </T>
        )}
        {total ? (
          <View style={styles.ready}>
            <T size={size.xs} muted>{ready}/{total} ready</T>
            <View style={{ width: 64, flexDirection: 'row' }}>
              <Bar fraction={ready / total} color={ready === total ? p.good : p.zen} height={5} />
            </View>
          </View>
        ) : null}
        <T muted>›</T>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  filters: { flexDirection: 'row', paddingHorizontal: 14, marginBottom: 4 },
  section: { marginTop: 14, marginBottom: 6, marginLeft: 4, letterSpacing: 0.5 },
  row: { padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginBottom: 6, gap: 8 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ready: { alignItems: 'flex-end', gap: 3 },
  status: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  fabWrap: { position: 'absolute', right: 18, bottom: 18 },
  fab: { height: 50, borderRadius: 25, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', elevation: 4 },
});
