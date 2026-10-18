import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider } from '../lib/store';
import { usePalette } from '../lib/theme';

function Screens() {
  const p = usePalette();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen
        name="task/[id]"
        options={{ presentation: 'modal', headerShown: true, headerStyle: { backgroundColor: p.card }, headerTintColor: p.text }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="auto" />
        <Screens />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
