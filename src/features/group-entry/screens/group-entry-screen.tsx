import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { SoftCard } from '@/components/ui/soft-card';
import { colors, radius, shadow, spacing, typography } from '@/constants/tokens';

const entryOptions = [
  {
    title: '그룹 만들기',
    description: '그룹명, 설명, 대표 컬러, 초기 태그, 임계값을 설정하는 폼이 들어올 자리입니다.',
  },
  {
    title: '초대 코드로 참여',
    description: '정원 12명과 초대 코드 검증을 확인한 뒤 새 그룹에 참여합니다.',
  },
  {
    title: '초대 링크 공유',
    description: '홈 헤더에서 현재 그룹 진입 관련 액션을 한 곳으로 묶어 두는 시트입니다.',
  },
] as const;

export default function GroupEntryScreen() {
  return (
    <View style={styles.overlay}>
      <Pressable onPress={() => router.back()} style={StyleSheet.absoluteFill} />
      <View style={styles.sheetWrap}>
        <SoftCard style={styles.sheet} variant="empty">
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>Group actions</Text>
              <Text style={styles.title}>그룹 생성 / 참여</Text>
              <Text style={styles.description}>
                새 서드파티 바텀시트 없이 modal route 위에 하단 고정 레이아웃만 입혔습니다.
              </Text>
            </View>
            <AppButton label="닫기" onPress={() => router.back()} variant="secondary" />
          </View>
          <View style={styles.optionList}>
            {entryOptions.map((option) => (
              <View key={option.title} style={styles.optionItem}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </View>
            ))}
          </View>
        </SoftCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: colors.bg.overlay,
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    padding: spacing.md,
  },
  sheet: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
    ...shadow.sheet,
  },
  headerRow: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.brand.primary,
    fontSize: typography.eyebrow.fontSize,
    fontWeight: typography.eyebrow.fontWeight,
    letterSpacing: 0.8,
    lineHeight: typography.eyebrow.lineHeight,
    textTransform: 'uppercase',
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
  },
  optionList: {
    gap: spacing.sm,
  },
  optionItem: {
    backgroundColor: colors.surface.tertiary,
    borderColor: colors.line.soft,
    borderRadius: radius.input,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  optionTitle: {
    color: colors.text.primary,
    fontSize: typography.body.fontSize,
    fontWeight: typography.bodyStrong.fontWeight,
    lineHeight: typography.body.lineHeight,
  },
  optionDescription: {
    color: colors.text.secondary,
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
    lineHeight: 20,
  },
});
