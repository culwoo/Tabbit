import { PropsWithChildren } from 'react';

import { ThemeProvider, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/constants/tokens';

import { AppSessionProvider } from './app-session-provider';

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
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={navigationTheme}>
          <AppSessionProvider>
            {children}
            <StatusBar style="dark" />
          </AppSessionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
