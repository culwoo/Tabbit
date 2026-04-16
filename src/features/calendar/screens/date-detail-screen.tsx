import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { router, useLocalSearchParams } from 'expo-router';

import { AppButton } from '@/components/ui/app-button';
import { SoftCard } from '@/components/ui/soft-card';
import { colors, radius, spacing, typography } from '@/constants/tokens';
import { formatLifeDayLabel, formatTimestampLabel } from '@/lib/life-day';
import { selectDateDetail, useStoryShareStore } from '@/store/story-share-store';

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

export default function DateDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const selectedDate = Array.isArray(date) ? date[0] : date ?? '2026-04-15';
  const store = useStoryShareStore();
  const detail = selectDateDetail(store, selectedDate);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <SoftCard style={styles.heroCard} variant="empty">
          <Text style={styles.heroEyebrow}>Date detail</Text>
          <Text style={styles.heroTitle}>{formatLifeDayLabel(selectedDate)}</Text>
          <Text style={styles.heroDescription}>
            그룹 언락 기록과 저장된 스냅샷, 개인 회고를 한 화면에서 분리해 보여줍니다.
          </Text>
          <View style={styles.heroMetrics}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>그룹 기록</Text>
              <Text style={styles.metricValue}>{detail.groupEntries.length}</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>개인 기록</Text>
              <Text style={styles.metricValue}>{detail.personalRecords.length}</Text>
            </View>
          </View>
        </SoftCard>

        <SoftCard style={styles.sectionCard} variant="group-space">
          <Text style={styles.sectionTitle}>그룹 언락 / 공유 기록</Text>
          {detail.groupEntries.length === 0 ? (
            <Text style={styles.emptyCopy}>이 날짜에 저장된 그룹 인증 기록이 아직 없습니다.</Text>
          ) : (
            <View style={styles.groupEntryList}>
              {detail.groupEntries.map((entry) => (
                <View key={`${entry.groupId}:${entry.tagId}:${entry.lifeDay}`} style={styles.groupEntryCard}>
                  <View style={styles.groupEntryHeader}>
                    <View style={styles.groupEntryCopy}>
                      <Text style={styles.groupEntryTitle}>
                        {entry.groupEmoji} {entry.groupName} {entry.tagLabel}
                      </Text>
                      <Text style={styles.groupEntryMeta}>
                        {entry.shareProgressLabel} · {entry.thresholdState.status === 'locked' ? '미언락' : '언락됨'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.badge,
                        entry.snapshot ? styles.badgeSaved : styles.badgeUnlocked,
                      ]}>
                      <Text style={styles.badgeText}>{entry.snapshot ? 'snapshot 저장됨' : '언락됨'}</Text>
                    </View>
                  </View>

                  <Text style={styles.groupEntryDescription}>{entry.subtitle}</Text>

                  <View style={styles.timelineRow}>
                    <Text style={styles.timelineText}>
                      언락 시점 {formatTimestampLabel(entry.thresholdState.unlockedAt)}
                    </Text>
                    {entry.snapshot ? (
                      <Text style={styles.timelineText}>
                        저장 시점 {formatTimestampLabel(entry.snapshot.exportedAt)}
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
              ))}
            </View>
          )}
        </SoftCard>

        <SoftCard style={styles.sectionCard} variant="personal-space">
          <Text style={styles.sectionTitle}>개인공간 기록</Text>
          {detail.personalRecords.length === 0 ? (
            <Text style={styles.emptyCopy}>이 날짜에는 개인 회고가 없습니다.</Text>
          ) : (
            <View style={styles.personalList}>
              {detail.personalRecords.map((record) => (
                <View key={record.id} style={[styles.personalCard, { backgroundColor: record.accentColor }]}>
                  <Text style={styles.personalTitle}>{record.title}</Text>
                  <Text style={styles.personalSummary}>{record.summary}</Text>
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
  container: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  heroCard: {
    gap: spacing.sm,
  },
  heroEyebrow: {
    color: colors.brand.primary,
    fontSize: 12,
    fontWeight: typography.eyebrow.fontWeight,
    letterSpacing: 0.8,
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
    backgroundColor: colors.surface.secondary,
    borderRadius: radius.input,
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
    backgroundColor: colors.surface.primary,
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
    borderRadius: radius.card - 8,
    gap: spacing.xs,
    padding: spacing.md,
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
});
