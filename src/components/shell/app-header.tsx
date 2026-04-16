import type { ComponentProps } from 'react';

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow, spacing, typography } from '@/constants/tokens';

type HeaderIconName = ComponentProps<typeof Ionicons>['name'];

export type HeaderAction = {
  icon: HeaderIconName;
  accessibilityLabel: string;
  onPress: () => void;
};

type AppHeaderProps = {
  variant: 'home' | 'calendar-tab' | 'detail' | 'capture';
  title?: string;
  rightActions?: HeaderAction[];
  onBack?: () => void;
};

type HeaderIconButtonProps = HeaderAction;

function HeaderIconButton({ icon, accessibilityLabel, onPress }: HeaderIconButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        {
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <Ionicons color={colors.text.primary} name={icon} size={20} />
    </Pressable>
  );
}

function HeaderActions({ actions }: { actions?: HeaderAction[] }) {
  if (!actions?.length) {
    return <View style={styles.actionPlaceholder} />;
  }

  return (
    <View style={styles.actionsRow}>
      {actions.map((action) => (
        <HeaderIconButton key={action.accessibilityLabel} {...action} />
      ))}
    </View>
  );
}

export function AppHeader({ variant, title, rightActions, onBack }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const topPadding = insets.top + spacing.sm;

  if (variant === 'home') {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.homeRow}>
          <View>
            <Text style={styles.logo}>Tabbit</Text>
            <Text style={styles.logoCaption}>today, together, softly</Text>
          </View>
          <HeaderActions actions={rightActions} />
        </View>
      </View>
    );
  }

  if (variant === 'calendar-tab') {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.basicRow}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <HeaderActions actions={rightActions} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.detailRow}>
        <View style={styles.leadingSlot}>
          <HeaderIconButton
            accessibilityLabel={variant === 'capture' ? '닫기' : '뒤로가기'}
            icon={variant === 'capture' ? 'close' : 'chevron-back'}
            onPress={onBack ?? (() => undefined)}
          />
        </View>
        <View style={styles.centerSlot}>
          <Text numberOfLines={1} style={styles.detailTitle}>
            {title}
          </Text>
        </View>
        <View style={styles.trailingSlot}>
          <HeaderActions actions={rightActions} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg.canvas,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  homeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  basicRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  leadingSlot: {
    alignItems: 'flex-start',
    width: 56,
  },
  centerSlot: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
  trailingSlot: {
    alignItems: 'flex-end',
    minWidth: 56,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    borderColor: colors.line.soft,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
    ...shadow.card,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionPlaceholder: {
    width: 40,
  },
  logo: {
    color: colors.text.primary,
    fontSize: 28,
    fontWeight: typography.title.fontWeight,
    letterSpacing: -0.6,
    lineHeight: 32,
  },
  logoCaption: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: typography.label.fontWeight,
    lineHeight: 18,
    marginTop: spacing.xxs,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    lineHeight: typography.title.lineHeight,
  },
  detailTitle: {
    color: colors.text.primary,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
    textAlign: 'center',
  },
});
