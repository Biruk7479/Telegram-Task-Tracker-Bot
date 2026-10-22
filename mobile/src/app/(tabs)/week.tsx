// This week's scores with every penalty listed, last week's result, the rules,
// and the account.
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bar, Button, Card, Chip, T } from '../../components/ui';
import { fetchWeek } from '../../lib/api';
import { loadNotifyPrefs, saveNotifyPrefs, type NotifyPrefs } from '../../lib/notify';
import { useStore } from '../../lib/store';
import { memberColor, type as size, usePalette, useThemeMode, type SurfaceStyle, type ThemeMode } from '../../lib/theme';
import type { WeekReport } from '../../lib/types';

export default function WeekScreen() {
  const p = usePalette();
  const { session, board, logout, refresh } = useStore();
  const { mode, setMode, surface, setSurface } = useThemeMode();
  const [week, setWeek] = useState<WeekReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [notify, setNotify] = useState<NotifyPrefs | null>(null);

  useEffect(() => { loadNotifyPrefs().then(setNotify); }, []);

  const toggleNotify = async (key: keyof NotifyPrefs) => {
    if (!notify) return;
    const next = { ...notify, [key]: !notify[key] };
    setNotify(next);
    await saveNotifyPrefs(next);
    refresh(); // re-plans the phone's reminders with the new settings
  };

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
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: 'transparent' }}>
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
          <T size={size.sm} bold style={{ marginTop: 4 }}>Style</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {([['solid', '▢ Solid'], ['glass', '◇ Glass'], ['blur', '❄ Frosted blur']] as [SurfaceStyle, string][]).map(([v, label]) => (
              <Chip
                key={v}
                label={label}
                active={surface === v}
                onPress={() => {
                  setSurface(v);
                  refresh();
                }}
              />
            ))}
          </View>
          <T size={size.xs} muted>The app and your home-screen widgets both follow these. Widgets can’t blur, so Glass and Frosted blur both look like clear glass there.</T>
        </Card>

        {notify ? (
          <Card style={{ gap: 10 }}>
            <T bold>Notifications</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <Chip label="⏰ Task reminders" active={notify.reminders} onPress={() => toggleNotify('reminders')} />
              <Chip label="🌙 Evening nudge" active={notify.nudge} onPress={() => toggleNotify('nudge')} />
              <Chip label={`👀 ${board?.members.find((m) => m.userId !== session?.user.telegramId)?.name ?? 'Partner'}’s ticks`} active={notify.partner} onPress={() => toggleNotify('partner')} />
            </View>
            <T size={size.xs} muted>Reminders arrive at each task’s time (skipped once it’s ticked). The nudge comes at 21:30 and 05:00 while tasks are still open. Partner ticks show up when the app or widgets sync.</T>
          </Card>
        ) : null}

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
