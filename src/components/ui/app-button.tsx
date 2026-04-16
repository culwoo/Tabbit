import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/tokens';

type AppButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'muted';
  disabled?: boolean;
};

export function AppButton({ label, onPress, variant = 'primary', disabled = false }: AppButtonProps) {
  const tone = {
    primary: {
      backgroundColor: colors.brand.primary,
      borderColor: colors.brand.primary,
      color: colors.text.inverse,
    },
    secondary: {
      backgroundColor: colors.surface.tertiary,
      borderColor: colors.line.soft,
      color: colors.text.primary,
    },
    muted: {
      backgroundColor: colors.badge.neutral,
      borderColor: colors.line.soft,
      color: colors.text.secondary,
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
        },
      ]}>
      <Text style={[styles.label, { color: tone.color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    borderRadius: radius.button,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.bodyStrong.fontWeight,
    lineHeight: typography.body.lineHeight,
  },
});
