import { Stack } from 'expo-router';
import 'react-native-reanimated';

import { AppErrorBoundary } from '@/components/shell/app-error-boundary';
import { colors } from '@/constants/tokens';
import BootstrapScreen from '@/features/auth/screens/bootstrap-screen';
import { CaptureSessionProvider } from '@/features/capture/capture-session';
import { AppProviders } from '@/providers/app-providers';
import { useAppSession } from '@/providers/app-session-provider';

const stackScreenOptions = {
  contentStyle: { backgroundColor: colors.bg.canvas },
  headerShown: false,
} as const;

function RootNavigator() {
  const { bootstrapState } = useAppSession();

  if (bootstrapState === 'checking') {
    return <BootstrapScreen />;
  }

  if (bootstrapState === 'signed-out') {
    return (
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
      </Stack>
    );
  }

  return (
    <CaptureSessionProvider>
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="personal/index" />
          <Stack.Screen name="groups/[groupId]" />
          <Stack.Screen name="groups/chat/[groupId]" />
          <Stack.Screen name="capture/index" />
          <Stack.Screen name="capture/share" />
          <Stack.Screen name="calendar/[date]" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="profile" />
          <Stack.Screen
            name="group-actions"
            options={{
              animation: 'fade',
              contentStyle: { backgroundColor: 'transparent' },
              presentation: 'transparentModal',
            }}
          />
      </Stack>
    </CaptureSessionProvider>
  );
}

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <AppProviders>
        <RootNavigator />
      </AppProviders>
    </AppErrorBoundary>
  );
}
