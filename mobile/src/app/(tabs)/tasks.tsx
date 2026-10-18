// Every active task, grouped the way the notebook is: shared (Lizen), then
// each person's own. Tap to edit, + to add.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T } from '../../components/ui';
import { fetchTasks } from '../../lib/api';
import { useStore } from '../../lib/store';
import { memberColor, usePalette } from '../../lib/theme';
import { scheduleText } from '../../lib/local';
import type { Task } from '../../lib/types';

export default function TasksScreen() {
  const p = usePalette();
  const { session, board } = useStore();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      setTasks(await fetchTasks(session));
    } finally {
      setLoading(false);
    }
  }, [session]);

  // Reload whenever the tab is shown again, e.g. after saving in the form.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const members = board?.members ?? [];
  const sections = [
    { title: 'Shared', color: p.text, data: (tasks ?? []).filter((t) => t.assignedTo.length > 1) },
    ...members.map((m, i) => ({
      title: m.name,
      color: memberColor(p, i),
      data: (tasks ?? []).filter((t) => t.assignedTo.length === 1 && t.assignedTo[0] === m.userId),
    })),
  ].filter((s) => s.data.length);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: p.bg }}>
      <View style={styles.header}>
        <T size={22} bold style={{ flex: 1 }}>Tasks</T>
        <Pressable onPress={() => router.push('/task/new')} style={[styles.add, { backgroundColor: p.accent }]}>
          <T size={22} color={p.card}>+</T>
        </Pressable>
      </View>
      {!tasks ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={p.muted} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(t) => t._id}
          contentContainerStyle={{ padding: 12, paddingTop: 0 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={<T muted style={{ textAlign: 'center', marginTop: 40 }}>No tasks yet — tap + to add one.</T>}
          renderSectionHeader={({ section }) => (
            <T size={12} bold color={section.color} style={styles.section}>{section.title.toUpperCase()}</T>
          )}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/task/[id]', params: { id: item._id } })}
              style={({ pressed }) => [styles.row, { backgroundColor: p.card, borderColor: p.border, opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <T bold lines={1}>{item.name}</T>
                <T size={12} muted lines={1}>
                  {[item.area, scheduleText(item), item.target > 1 ? `${item.target} ${item.unit}`.trim() : '', item.mode === 'pooled' ? 'pooled' : '']
                    .filter(Boolean).join(' · ')}
                </T>
              </View>
              <T muted>›</T>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  add: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: 14, marginBottom: 6, marginLeft: 4, letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginBottom: 6 },
});
