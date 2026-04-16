import { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/constants/tokens';

import { SoftCard } from './soft-card';

type InfoCardProps = PropsWithChildren<{
  title: string;
  description: string;
}>;

export function InfoCard({ title, description, children }: InfoCardProps) {
  return (
    <SoftCard style={styles.card} variant="empty">
      <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.text.secondary }]}>{description}</Text>
      {children ? <View style={styles.children}>{children}</View> : null}
    </SoftCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
  },
  title: {
    fontSize: 17,
    fontWeight: typography.title.fontWeight,
    lineHeight: 22,
  },
  description: {
    fontSize: typography.label.fontSize,
    lineHeight: 20,
  },
  children: {
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
});
