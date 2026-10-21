import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GlassProvider } from '../components/glass';
import { StoreProvider } from '../lib/store';
import { ThemeProvider, usePalette, useThemeMode } from '../lib/theme';

function Screens() {
  const p = usePalette();
  const { mode } = useThemeMode();
  return (
    <>
    <StatusBar style={mode === 'system' ? 'auto' : mode === 'dark' ? 'light' : 'dark'} />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen
        name="task/[id]"
        options={{ presentation: 'modal', headerShown: true, headerStyle: { backgroundColor: p.glassStrong }, headerTintColor: p.text, headerShadowVisible: false }}
      />
    </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <GlassProvider>
          <StoreProvider>
            <Screens />
          </StoreProvider>
        </GlassProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
