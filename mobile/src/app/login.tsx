import { Redirect } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, T } from '../components/ui';
import { defaultServerUrl } from '../lib/storage';
import { useStore } from '../lib/store';
import { type as size, usePalette } from '../lib/theme';

export default function Login() {
  const p = usePalette();
  const { session, login, error: storeError } = useStore();
  const [serverUrl, setServerUrl] = useState(defaultServerUrl());
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Redirect href="/" />;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await login(serverUrl, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const input = [styles.input, { color: p.text, borderColor: p.border, backgroundColor: p.card }];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }}>
      <KeyboardAvoidingView behavior="padding" style={styles.wrap}>
        <View style={{ gap: 4, marginBottom: 24 }}>
          <T size={size.xxl} bold>Lizen</T>
          <T muted>Zen & Lily, one board.</T>
        </View>
        <T size={size.sm} muted>Server</T>
        <TextInput
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="https://your-server.example"
          placeholderTextColor={p.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={input}
        />
        <T size={size.sm} muted>Your password</T>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={p.muted}
          secureTextEntry
          onSubmitEditing={submit}
          style={input}
        />
        {error || storeError ? <T size={size.sm} color={p.danger}>{error || storeError}</T> : null}
        <Button label={busy ? 'Logging in…' : 'Log in'} onPress={submit} disabled={busy || !serverUrl || !password} style={{ marginTop: 8 }} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 24, gap: 8 },
  input: { height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, marginBottom: 8 },
});
