import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { router, useLocalSearchParams, useNavigation } from 'expo-router';

import { AppHeader } from '@/components/shell/app-header';
import { AppButton } from '@/components/ui/app-button';
import { SoftCard } from '@/components/ui/soft-card';
import { colors, radius, spacing, typography } from '@/constants/tokens';
import { formatLifeDayLabel, formatTimestampLabel } from '@/lib/life-day';
import { resolveLifestyleDate } from '@/lib/domain';
import { useDateDetail } from '../hooks/use-date-detail';

function buildGroupRoute(groupId: string, tagId: string, lifeDay: string, shareMode?: boolean) {
  const query = new URLSearchParams({
    tagId,
    lifeDay,
  });

  if (shareMode) {
    query.set('shareMode', '1');
  }

  return `/groups/${groupId}?${query.toString()}`;
}

function renderThresholdLabel(status: string) {
  if (status === 'provisional_unlocked' || status === 'finalized') {
    return '언락됨';
  }

  if (status === 'expired') {
    return '마감됨';
  }

  return '미언락';
}

export default function DateDetailScreen() {
  const navigation = useNavigation();
  const { date } = useLocalSearchParams<{ date: string }>();
  const selectedDate = Array.isArray(date) ? date[0] : date ?? resolveLifestyleDate(new Date());

  const { errorMessage, loading, groupEntries, personalRecords, refresh } = useDateDetail(selectedDate);

  function handleBack() {
    if (navigation.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  }

  if (loading) {
    return (
      <View style={styles.screen}>
        <AppHeader onBack={handleBack} title="날짜 상세" variant="detail" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader onBack={handleBack} title="날짜 상세" variant="detail" />
      <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <SoftCard style={styles.heroCard} variant="empty">
          <Text style={styles.heroEyebrow}>Daily keepsake</Text>
          <Text style={styles.heroTitle}>{formatLifeDayLabel(selectedDate)}</Text>
          <Text style={styles.heroDescription}>
            이날의 그룹 스토리와 개인공간 기록을 한 번에 다시 봅니다.
          </Text>
          <View style={styles.heroMetrics}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>그룹 기록</Text>
              <Text style={styles.metricValue}>{groupEntries.length}</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>개인 기록</Text>
              <Text style={styles.metricValue}>{personalRecords.length}</Text>
            </View>
          </View>
        </SoftCard>

        {errorMessage ? (
          <SoftCard style={styles.sectionCard} variant="empty">
            <Text selectable style={styles.emptyCopy}>{errorMessage}</Text>
            <AppButton label="다시 불러오기" onPress={() => void refresh()} variant="secondary" />
          </SoftCard>
        ) : null}

        <SoftCard style={styles.sectionCard} variant="group-space">
          <Text style={styles.sectionTitle}>그룹 스토리 기록</Text>
          {groupEntries.length === 0 ? (
            <Text style={styles.emptyCopy}>이 날짜에 저장된 그룹 인증 기록이 아직 없습니다.</Text>
          ) : (
            <View style={styles.groupEntryList}>
              {groupEntries.map((entry, entryIndex) => {
                const hasSavedSnapshot = Boolean(entry.snapshot?.last_snapshot_exported_at);

                return (
                <View key={`${entry.groupId}:${entry.tagId}:${entry.lifeDay}:${entryIndex}`} style={styles.groupEntryCard}>
                  <View style={styles.groupEntryHeader}>
                    <View style={styles.groupEntryCopy}>
                      <Text style={styles.groupEntryTitle}>
                        {entry.groupName} {entry.tagLabel}
                      </Text>
                      <Text style={styles.groupEntryMeta}>
                        {entry.shareProgressLabel} · {renderThresholdLabel(entry.thresholdState.status)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.badge,
                        hasSavedSnapshot ? styles.badgeSaved : styles.badgeUnlocked,
                      ]}>
                      <Text style={styles.badgeText}>{hasSavedSnapshot ? '스토리 저장됨' : renderThresholdLabel(entry.thresholdState.status)}</Text>
                    </View>
                  </View>

                  <Text style={styles.groupEntryDescription}>{entry.subtitle}</Text>

                  <View style={styles.timelineRow}>
                    <Text style={styles.timelineText}>
                      언락 시점 {formatTimestampLabel('unlocked_at' in entry.thresholdState ? entry.thresholdState.unlocked_at ?? '' : '')}
                    </Text>
                    {hasSavedSnapshot ? (
                      <Text style={styles.timelineText}>
                        저장 시점 {formatTimestampLabel(entry.snapshot?.last_snapshot_exported_at ?? '')}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.actionsRow}>
                    <View style={styles.flexAction}>
                      <AppButton
                        label="원본 그룹 열기"
                        onPress={() => router.push(buildGroupRoute(entry.groupId, entry.tagId, entry.lifeDay))}
                        variant="secondary"
                      />
                    </View>
                    <View style={styles.flexAction}>
                      <AppButton
                        label="Share Mode 열기"
                        onPress={() =>
                          router.push(buildGroupRoute(entry.groupId, entry.tagId, entry.lifeDay, true))
                        }
                        disabled={!entry.shareEnabled}
                      />
                    </View>
                  </View>
                </View>
                );
              })}
            </View>
          )}
        </SoftCard>

        <SoftCard style={styles.sectionCard} variant="personal-space">
          <Text style={styles.sectionTitle}>나만의 기록</Text>
          {personalRecords.length === 0 ? (
            <Text style={styles.emptyCopy}>이 날짜에는 개인 회고가 없습니다.</Text>
          ) : (
            <View style={styles.personalList}>
              {personalRecords.map((record, recordIndex) => (
                <View key={`${record.id}:${recordIndex}`} style={styles.personalCard}>
                  {record.imageUrl ? (
                    <Image source={{ uri: record.imageUrl }} style={styles.personalImage} />
                  ) : null}
                  <View style={styles.personalCopy}>
                    <Text style={styles.personalTitle}>{record.title}</Text>
                    <Text style={styles.personalSummary}>{record.summary}</Text>
                    <Text style={styles.personalMeta}>{formatTimestampLabel(record.uploadedAt)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </SoftCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  heroCard: {
    backgroundColor: colors.bg.warm,
    borderColor: colors.line.warm,
    gap: spacing.sm,
  },
  heroEyebrow: {
    color: colors.brand.accent,
    fontSize: 12,
    fontWeight: typography.eyebrow.fontWeight,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.text.primary,
    fontSize: typography.hero.fontSize,
    fontWeight: typography.hero.fontWeight,
    lineHeight: typography.hero.lineHeight,
  },
  heroDescription: {
    color: colors.text.secondary,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  heroMetrics: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricBox: {
    backgroundColor: colors.surface.raised,
    borderColor: colors.line.warm,
    borderRadius: radius.input,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xxs,
    padding: spacing.md,
  },
  metricLabel: {
    color: colors.text.tertiary,
    fontSize: 12,
    fontWeight: typography.label.fontWeight,
  },
  metricValue: {
    color: colors.text.primary,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
  },
  sectionCard: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    lineHeight: typography.title.lineHeight,
  },
  emptyCopy: {
    color: colors.text.secondary,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  groupEntryList: {
    gap: spacing.sm,
  },
  groupEntryCard: {
    backgroundColor: colors.surface.raised,
    borderColor: colors.line.soft,
    borderWidth: 1,
    borderRadius: radius.card - 8,
    gap: spacing.sm,
    padding: spacing.md,
  },
  groupEntryHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  groupEntryCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  groupEntryTitle: {
    color: colors.text.primary,
    fontSize: typography.body.fontSize,
    fontWeight: typography.bodyStrong.fontWeight,
    lineHeight: typography.body.lineHeight,
  },
  groupEntryMeta: {
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 16,
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeUnlocked: {
    backgroundColor: colors.brand.secondarySoft,
  },
  badgeSaved: {
    backgroundColor: colors.brand.primarySoft,
  },
  badgeText: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: typography.label.fontWeight,
  },
  groupEntryDescription: {
    color: colors.text.secondary,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  timelineRow: {
    gap: spacing.xxs,
  },
  timelineText: {
    color: colors.text.tertiary,
    fontSize: 12,
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  flexAction: {
    flex: 1,
    minWidth: 140,
  },
  personalList: {
    gap: spacing.sm,
  },
  personalCard: {
    alignItems: 'center',
    backgroundColor: colors.surface.raised,
    borderColor: colors.line.warm,
    borderWidth: 1,
    borderRadius: radius.card - 8,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.md,
  },
  personalImage: {
    backgroundColor: colors.surface.secondary,
    borderRadius: radius.input,
    height: 64,
    width: 64,
  },
  personalCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  personalTitle: {
    color: colors.text.primary,
    fontSize: typography.body.fontSize,
    fontWeight: typography.bodyStrong.fontWeight,
    lineHeight: typography.body.lineHeight,
  },
  personalSummary: {
    color: colors.text.secondary,
    fontSize: typography.label.fontSize,
    lineHeight: 20,
  },
  personalMeta: {
    color: colors.text.tertiary,
    fontSize: 12,
    lineHeight: 16,
  },
});
