import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { paperColors } from '@/components/ui/paper-design';
import { spacing } from '@/constants/tokens';

const tabConfig = {
  calendar: {
    icon: 'calendar-outline',
    label: '달력',
  },
  index: {
    icon: 'home-outline',
    label: '홈',
  },
  camera: {
    icon: 'camera-outline',
    label: '인증',
  },
} as const;

export function BottomPillTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.outer, { paddingBottom: insets.bottom + spacing.sm }]}>
      <View style={styles.inner}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const config = tabConfig[route.name as keyof typeof tabConfig];

          if (!config) {
            return null;
          }

          const onPress = () => {
            const event = navigation.emit({
              canPreventDefault: true,
              target: route.key,
              type: 'tabPress',
            });

            if (event.defaultPrevented) {
              return;
            }

            if (route.name === 'camera') {
              router.push('/capture');
              return;
            }

            navigation.navigate(route.name);
          };

          return (
            <Pressable
              accessibilityLabel={descriptors[route.key]?.options.tabBarAccessibilityLabel}
              accessibilityRole="tab"
              accessibilityState={isFocused ? { selected: true } : {}}
              android_ripple={{ color: 'transparent' }}
              key={route.key}
              onPress={onPress}
              style={({ pressed }) => [styles.tabWrap, { opacity: pressed ? 0.86 : 1 }]}>
              <View style={[styles.tabButton, isFocused ? styles.tabButtonActive : undefined]}>
                <Ionicons
                  color={isFocused ? paperColors.card : paperColors.ink1}
                  name={config.icon}
                  size={route.name === 'camera' ? 22 : 20}
                />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inner: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(253,251,245,0.94)',
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 13,
    paddingVertical: 6,
    shadowColor: '#1E190F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 4,
  },
  outer: {
    backgroundColor: paperColors.paper0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  tabButton: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    height: 44,
    width: 44,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(70, 67, 61, 0.82)',
  },
  tabWrap: {
    borderRadius: 999,
    overflow: 'hidden',
    paddingVertical: 0,
  },
});
