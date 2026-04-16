import { Tabs } from 'expo-router';

import { BottomPillTabBar } from '@/components/shell/bottom-pill-tab-bar';
import { colors } from '@/constants/tokens';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg.canvas },
      }}
      tabBar={(props) => <BottomPillTabBar {...props} />}>
      <Tabs.Screen name="calendar" options={{ title: '캘린더' }} />
      <Tabs.Screen name="index" options={{ title: '홈' }} />
      <Tabs.Screen name="camera" options={{ title: '카메라' }} />
    </Tabs>
  );
}
