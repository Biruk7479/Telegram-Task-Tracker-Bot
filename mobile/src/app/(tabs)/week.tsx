// This week's scores with every penalty listed, last week's result, the rules,
// and the account.
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bar, Button, Card, Chip, T } from '../../components/ui';
import { fetchWeek } from '../../lib/api';
import { useStore } from '../../lib/store';
import { memberColor, type as size, usePalette, useThemeMode, type ThemeMode } from '../../lib/theme';
import type { WeekReport } from '../../lib/types';

export default function WeekScreen() {
  const p = usePalette();
  const { session, board, logout, refresh } = useStore();
  const { mode, setMode } = useThemeMode();
  const [week, setWeek] = useState<WeekReport | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      setWeek(await fetchWeek(session));
    } catch {
      // Keep whatever was shown; the Board shows the connection state.
    } finally {
      setLoading(false);
    }
  }, [session]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const rules = board?.rules;
  const last = board?.lastWeek;
  const nameOf = (id?: string) => last?.scores.find((s) => s.userId === id)?.name ?? '';

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: p.bg }}>
      <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        <T size={size.xl} bold>This week</T>
        {week ? <T size={size.sm} muted>From {week.weekKey} · settles Monday 0{rules?.closeHour ?? 6}:00</T> : null}

        {(week?.members ?? []).map((m, i) => (
          <Card key={m.userId} style={{ gap: 8 }}>
            <View style={styles.row}>
              <T bold color={memberColor(p, i)} style={{ flex: 1 }}>{m.name}</T>
              <T bold>♥ {m.xp}</T>
              <T size={size.sm} muted> / {rules?.startXp ?? 100}</T>
            </View>
            <View style={styles.row}><Bar fraction={m.xp / (rules?.startXp ?? 100)} color={memberColor(p, i)} /></View>
            <T size={size.sm} muted>🙏 {m.excusesLeft} excuse{m.excusesLeft === 1 ? '' : 's'} left</T>
            {m.penalties.length === 0 ? <T size={size.sm} muted>No penalties yet 🎉</T> : m.penalties.map((x) => (
              <View key={x._id} style={styles.row}>
                <T size={size.sm} style={{ flex: 1 }} lines={1}>
                  <T size={size.sm} muted>{x.date.slice(5)} </T>{x.taskName}
                  <T size={size.xs} muted>{x.status === 'ignored' ? '  ignored' : x.progress ? `  ${x.progress}/${x.target}` : '  said no'}</T>
                </T>
                <T size={size.sm} bold color={p.danger}>−{x.penalty}</T>
              </View>
            ))}
          </Card>
        ))}

        {last ? (
          <Card style={{ gap: 4 }}>
            <T size={size.sm} muted>Last week ({last.weekKey})</T>
            {last.isTie ? <T bold>🤝 Tie — both leveled up</T> : (
              <>
                <T bold>🏆 {nameOf(last.winner)} won</T>
                <T size={size.sm}>🚨 {nameOf(last.loser)} owes: {last.reward}</T>
              </>
            )}
            <T size={size.sm} muted>{last.scores.map((s) => `${s.name} ${s.xp}`).join(' · ')}</T>
          </Card>
        ) : null}

        {rules ? (
          <Card style={{ gap: 4 }}>
            <T bold>Rules</T>
            <T size={size.sm}>Everyone starts the week at {rules.startXp}. XP only goes down.</T>
            <T size={size.sm}>✓ Done or 🙏 excused ({rules.excusesPerWeek}/week): 0</T>
            <T size={size.sm}>✗ Said no, or a counter short of its target: −{rules.penalty.missed}</T>
            <T size={size.sm}>👻 Never answered by 0{rules.closeHour}:00 next morning: −{rules.penalty.ignored}</T>
            <T size={size.sm}>Higher XP on Monday levels up; the other owes a penalty task.</T>
          </Card>
        ) : null}

        <Card style={{ gap: 10 }}>
          <T bold>Appearance</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {([['system', '📱 System'], ['light', '☀️ Light'], ['dark', '🌙 Dark']] as [ThemeMode, string][]).map(([m, label]) => (
              <Chip
                key={m}
                label={label}
                active={mode === m}
                onPress={() => {
                  setMode(m);
                  refresh(); // redraws the home-screen widgets in the new theme
                }}
              />
            ))}
          </View>
          <T size={size.xs} muted>The app and your home-screen widgets both follow this.</T>
        </Card>

        <Card style={{ gap: 8 }}>
          <T size={size.sm} muted>Logged in as <T size={size.sm} bold>{session?.user.name}</T></T>
          <T size={size.xs} muted lines={1}>{session?.serverUrl}</T>
          <Button label="Log out" kind="ghost" onPress={logout} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 12, gap: 10, paddingBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
