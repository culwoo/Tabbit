import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { colors, radius, shadow } from '@/constants/tokens';

type SoftCardVariant = 'personal-space' | 'group-space' | 'certification' | 'empty';

type SoftCardProps = PropsWithChildren<{
  variant: SoftCardVariant;
  style?: StyleProp<ViewStyle>;
}>;

const variantStyles: Record<SoftCardVariant, ViewStyle> = {
  'personal-space': {
    backgroundColor: colors.bg.warm,
    borderColor: colors.line.warm,
  },
  'group-space': {
    backgroundColor: colors.brand.primarySoft,
    borderColor: colors.line.accent,
  },
  certification: {
    backgroundColor: colors.brand.mintSoft,
    borderColor: colors.line.soft,
  },
  empty: {
    backgroundColor: colors.surface.primary,
    borderColor: colors.line.soft,
  },
};

export function SoftCard({ variant, style, children }: SoftCardProps) {
  return <View style={[styles.base, variantStyles[variant], style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: 20,
    ...shadow.card,
  },
});
