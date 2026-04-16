import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/tokens';

type TagPillProps = {
  selected?: boolean;
  label: string;
  overflowCount?: number;
};

export function TagPill({ selected = false, label, overflowCount }: TagPillProps) {
  const content = overflowCount && overflowCount > 0 ? `... +${overflowCount}개` : label;

  return (
    <View style={[styles.base, selected ? styles.selected : styles.default]}>
      <Text style={[styles.label, { color: selected ? colors.text.primary : colors.text.secondary }]}>
        {content}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  default: {
    backgroundColor: colors.surface.primary,
    borderColor: colors.line.soft,
  },
  selected: {
    backgroundColor: colors.brand.primarySoft,
    borderColor: colors.brand.primary,
  },
  label: {
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
    lineHeight: typography.label.lineHeight,
  },
});
