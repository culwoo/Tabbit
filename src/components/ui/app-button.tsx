import type { ComponentProps } from 'react';

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/tokens';

type AppButtonProps = {
  label: string;
  onPress: () => void;
  icon?: ComponentProps<typeof Ionicons>['name'];
  variant?: 'primary' | 'secondary' | 'muted' | 'danger';
  disabled?: boolean;
};

export function AppButton({ label, onPress, icon, variant = 'primary', disabled = false }: AppButtonProps) {
  const tone = {
    primary: {
      backgroundColor: colors.surface.inverse,
      borderColor: colors.surface.inverse,
      color: colors.text.inverse,
      iconColor: colors.text.inverse,
    },
    secondary: {
      backgroundColor: colors.surface.raised,
      borderColor: colors.line.accent,
      color: colors.brand.primaryDeep,
      iconColor: colors.brand.primary,
    },
    muted: {
      backgroundColor: colors.badge.neutral,
      borderColor: colors.line.soft,
      color: colors.text.secondary,
      iconColor: colors.text.secondary,
    },
    danger: {
      backgroundColor: colors.brand.blushSoft,
      borderColor: colors.status.danger,
      color: colors.status.danger,
      iconColor: colors.status.danger,
    },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: tone.backgroundColor,
          borderColor: tone.borderColor,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
        },
      ]}>
      {icon ? <Ionicons color={tone.iconColor} name={icon} size={17} /> : null}
      <Text numberOfLines={1} style={[styles.label, { color: tone.color }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    borderRadius: radius.button,
    borderWidth: 1,
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: {
    flexShrink: 1,
    fontSize: typography.body.fontSize,
    fontWeight: typography.bodyStrong.fontWeight,
    lineHeight: typography.body.lineHeight,
    textAlign: 'center',
  },
});
