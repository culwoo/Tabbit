import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/constants/tokens';

export default function BootstrapScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.brand.primary} size="small" />
      <Text style={styles.title}>Tabbit</Text>
      <Text style={styles.description}>앱 셸과 세션 상태를 준비하고 있습니다.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.bg.canvas,
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    lineHeight: typography.title.lineHeight,
  },
  description: {
    color: colors.text.secondary,
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: typography.body.lineHeight,
    textAlign: 'center',
  },
});
