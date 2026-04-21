import { Stack, router, useSegments } from 'expo-router';
import { useEffect } from 'react';
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
  const segments = useSegments();
  const firstSegment = segments[0];
  const isAuthRoute = firstSegment === '(auth)' || firstSegment === 'sign-in';

  useEffect(() => {
    if (bootstrapState === 'checking') {
      return;
    }

    if (bootstrapState === 'signed-out' && !isAuthRoute) {
      router.replace('/sign-in');
      return;
    }

    if (bootstrapState === 'signed-in' && isAuthRoute) {
      router.replace('/');
    }
  }, [bootstrapState, isAuthRoute]);

  if (bootstrapState === 'checking') {
    return <BootstrapScreen />;
  }

  return (
    <CaptureSessionProvider>
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="personal/index" />
        <Stack.Screen name="groups/[groupId]" />
        <Stack.Screen name="groups/settings/[groupId]" />
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
