import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow, spacing, typography } from '@/constants/tokens';

const tabConfig = {
  calendar: {
    icon: 'calendar-outline',
    label: '캘린더',
  },
  index: {
    icon: 'home-outline',
    label: '홈',
  },
  camera: {
    icon: 'camera',
    label: '카메라',
  },
} as const;

export function BottomPillTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      style={[
        styles.outer,
        {
          paddingBottom: insets.bottom + spacing.sm,
        },
      ]}>
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
              key={route.key}
              accessibilityLabel={descriptors[route.key]?.options.tabBarAccessibilityLabel}
              accessibilityRole="tab"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              style={({ pressed }) => [
                route.name === 'camera' ? styles.cameraWrap : styles.tabWrap,
                {
                  opacity: pressed ? 0.86 : 1,
                },
              ]}>
              {route.name === 'camera' ? (
                <View style={styles.cameraButton}>
                  <Ionicons color={colors.text.inverse} name={config.icon} size={22} />
                  <Text style={styles.cameraLabel}>{config.label}</Text>
                </View>
              ) : (
                <View style={[styles.tabButton, isFocused ? styles.tabButtonActive : undefined]}>
                  <Ionicons
                    color={isFocused ? colors.text.primary : colors.text.tertiary}
                    name={config.icon}
                    size={20}
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      {
                        color: isFocused ? colors.text.primary : colors.text.tertiary,
                      },
                    ]}>
                    {config.label}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: colors.bg.canvas,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  inner: {
    alignItems: 'center',
    backgroundColor: colors.surface.raised,
    borderColor: colors.line.warm,
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 74,
    paddingHorizontal: spacing.sm,
    ...shadow.floating,
  },
  tabWrap: {
    flex: 1,
    paddingVertical: spacing.xs,
  },
  tabButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    gap: spacing.xxs,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.sm,
  },
  tabButtonActive: {
    backgroundColor: colors.brand.butterSoft,
  },
  tabLabel: {
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
    lineHeight: typography.label.lineHeight,
  },
  cameraWrap: {
    alignItems: 'center',
    flex: 1,
    marginTop: -22,
  },
  cameraButton: {
    alignItems: 'center',
    backgroundColor: colors.surface.inverse,
    borderColor: colors.brand.accent,
    borderRadius: 24,
    borderWidth: 2,
    gap: spacing.xxs,
    justifyContent: 'center',
    minHeight: 64,
    minWidth: 86,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadow.floating,
  },
  cameraLabel: {
    color: colors.text.inverse,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 16,
  },
});
