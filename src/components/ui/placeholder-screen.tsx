import { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { HeaderAction } from '@/components/shell/app-header';
import { AppHeader } from '@/components/shell/app-header';
import { colors, spacing, typography } from '@/constants/tokens';

import { AppButton } from './app-button';
import { SoftCard } from './soft-card';

type PlaceholderScreenProps = PropsWithChildren<{
  header?: {
    variant: 'home' | 'calendar-tab' | 'detail' | 'capture';
    title?: string;
    rightActions?: HeaderAction[];
    onBack?: () => void;
  };
  eyebrow?: string;
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  };
  secondaryAction?: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  };
}>;

export function PlaceholderScreen({
  header,
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
  children,
}: PlaceholderScreenProps) {
  return (
    <View style={styles.screen}>
      {header ? (
        <AppHeader
          onBack={header.onBack}
          rightActions={header.rightActions}
          title={header.title}
          variant={header.variant}
        />
      ) : null}
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            backgroundColor: colors.bg.canvas,
          },
        ]}>
        <SoftCard style={styles.hero} variant="empty">
          {eyebrow ? <Text style={[styles.eyebrow, { color: colors.brand.primary }]}>{eyebrow}</Text> : null}
          <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
          <Text style={[styles.description, { color: colors.text.secondary }]}>{description}</Text>
          {primaryAction || secondaryAction ? (
            <View style={styles.actionRow}>
              {primaryAction ? (
                <View style={styles.actionItem}>
                  <AppButton
                    disabled={primaryAction.disabled}
                    label={primaryAction.label}
                    onPress={primaryAction.onPress}
                  />
                </View>
              ) : null}
              {secondaryAction ? (
                <View style={styles.actionItem}>
                  <AppButton
                    disabled={secondaryAction.disabled}
                    label={secondaryAction.label}
                    onPress={secondaryAction.onPress}
                    variant="secondary"
                  />
                </View>
              ) : null}
            </View>
          ) : null}
        </SoftCard>
        <View style={styles.content}>{children}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  container: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  hero: {
    gap: spacing.sm,
  },
  eyebrow: {
    ...typography.eyebrow,
  },
  title: {
    ...typography.hero,
  },
  description: {
    ...typography.body,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionItem: {
    minWidth: 148,
    flexGrow: 1,
  },
  content: {
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
});
