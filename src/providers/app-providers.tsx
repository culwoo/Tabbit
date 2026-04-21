import { PropsWithChildren } from 'react';

import { useFonts } from 'expo-font';
import { ThemeProvider, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/constants/tokens';
import { PushNotificationProvider } from '@/features/notifications/push-notification-provider';

import { AppSessionProvider } from './app-session-provider';
import { FontPreferenceProvider } from './font-preference-provider';

const navigationTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.brand.primary,
    background: colors.bg.canvas,
    card: colors.surface.primary,
    text: colors.text.primary,
    border: colors.line.soft,
    notification: colors.brand.accent,
  },
};

export function AppProviders({ children }: PropsWithChildren) {
  const [fontsLoaded] = useFonts({
    Gaegu: require('../../assets/fonts/Gaegu-Regular.ttf'),
    'Gaegu-Bold': require('../../assets/fonts/Gaegu-Bold.ttf'),
    NanumPenScript: require('../../assets/fonts/NanumPenScript-Regular.ttf'),
    'Pretendard-Bold': require('../../assets/fonts/Pretendard-Bold.otf'),
    'Pretendard-Regular': require('../../assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-SemiBold': require('../../assets/fonts/Pretendard-SemiBold.otf'),
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={navigationTheme}>
          <FontPreferenceProvider>
            <AppSessionProvider>
              <PushNotificationProvider>{children}</PushNotificationProvider>
              <StatusBar style="dark" />
            </AppSessionProvider>
          </FontPreferenceProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
