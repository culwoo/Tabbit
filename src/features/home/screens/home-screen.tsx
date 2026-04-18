import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { AppHeader, type HeaderAction } from '@/components/shell/app-header';
import { SoftCard } from '@/components/ui/soft-card';
import { TagPill } from '@/components/ui/tag-pill';
import { colors, radius, spacing, typography } from '@/constants/tokens';
import { resolveLifestyleDate } from '@/lib/domain';
import {
  fetchMyGroups,
  fetchGroupTags,
  fetchGroupThresholdStates,
  type GroupRow,
  type GroupTagRow,
} from '@/lib/supabase';

// ── 타입 ──

type GroupCard = {
  group: GroupRow & { myRole: string };
  tags: GroupTagRow[];
  progress: { certified: number; threshold: number; total: number };
};

// ── 헤더 액션 ──

const rightActions: HeaderAction[] = [
  {
    accessibilityLabel: '그룹 생성 또는 참여',
    icon: 'add',
    onPress: () => router.push('/group-actions'),
  },
  {
    accessibilityLabel: '알림',
    icon: 'notifications-outline',
    onPress: () => router.push('/notifications'),
  },
  {
    accessibilityLabel: '마이페이지',
    icon: 'person-circle-outline',
    onPress: () => router.push('/profile'),
  },
];

// ── 메인 ──

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [groupCards, setGroupCards] = useState<GroupCard[]>([]);

  const today = resolveLifestyleDate(new Date());

  const loadData = useCallback(async () => {
    try {
      const groups = await fetchMyGroups();

      const cards: GroupCard[] = await Promise.all(
        groups.map(async (group) => {
          const [tags, thresholds] = await Promise.all([
            fetchGroupTags(group.id),
            fetchGroupThresholdStates(group.id, today),
          ]);

          const totalTags = tags.length;
          const certifiedCount = thresholds.filter(
            (t) => t.status === 'provisional_unlocked' || t.status === 'finalized',
          ).length;
          const avgThreshold = thresholds.length > 0
            ? Math.round(thresholds.reduce((sum, t) => sum + t.effective_threshold, 0) / thresholds.length)
            : 0;

          return {
            group,
            tags,
            progress: {
              certified: certifiedCount,
              threshold: avgThreshold,
              total: totalTags,
            },
          };
        }),
      );

      setGroupCards(cards);
    } catch (err) {
      console.error('[HomeScreen] loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [loadData]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const homeStats = useMemo(() => {
    const totalTags = groupCards.reduce((sum, card) => sum + card.progress.total, 0);
    const certifiedTags = groupCards.reduce((sum, card) => sum + card.progress.certified, 0);

    return {
      certifiedTags,
      totalGroups: groupCards.length,
      totalTags,
      completionPercent: totalTags > 0 ? Math.round((certifiedTags / totalTags) * 100) : 0,
    };
  }, [groupCards]);

  return (
    <View style={styles.screen}>
      <AppHeader rightActions={rightActions} variant="home" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            colors={[colors.brand.primary]}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            tintColor={colors.brand.primary}
          />
        }
      >
        <View style={styles.todayPanel}>
          <View style={styles.todayTopRow}>
            <View style={styles.todayCopy}>
              <Text style={styles.todayEyebrow}>Today together</Text>
              <Text style={styles.todayTitle}>오늘도 같이 한 칸 채워요</Text>
              <Text style={styles.todayDescription}>
                그룹 인증과 나만의 기록을 한곳에서 가볍게 이어갑니다.
              </Text>
            </View>
            <View style={styles.todayStamp}>
              <Text style={styles.todayStampValue}>{homeStats.completionPercent}%</Text>
              <Text style={styles.todayStampLabel}>진행</Text>
            </View>
          </View>
          <View style={styles.todayTrack}>
            <View style={[styles.todayTrackFill, { width: `${homeStats.completionPercent}%` }]} />
          </View>
          <View style={styles.todayMetricRow}>
            <View style={styles.todayMetric}>
              <Text style={styles.todayMetricValue}>{homeStats.totalGroups}</Text>
              <Text style={styles.todayMetricLabel}>그룹</Text>
            </View>
            <View style={styles.todayMetric}>
              <Text style={styles.todayMetricValue}>{homeStats.certifiedTags}</Text>
              <Text style={styles.todayMetricLabel}>완료 태그</Text>
            </View>
            <View style={styles.todayMetric}>
              <Text style={styles.todayMetricValue}>{homeStats.totalTags}</Text>
              <Text style={styles.todayMetricLabel}>오늘 태그</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          accessibilityLabel="개인공간 열기"
          accessibilityRole="button"
          activeOpacity={0.7}
          onPress={() => router.push('/personal')}
        >
          <SoftCard style={styles.personalCard} variant="personal-space">
            <View style={styles.cardTopRow}>
              <View style={styles.cardTitleRow}>
                <View style={styles.personalIcon}>
                  <Ionicons color={colors.brand.accent} name="bookmark" size={16} />
                </View>
                <Text style={styles.cardTitle}>개인공간</Text>
              </View>
              <Ionicons color={colors.text.tertiary} name="chevron-forward" size={18} />
            </View>
            <Text style={styles.cardSubtext}>그룹에 올리지 않아도 남겨두는 내 기록</Text>
            <View style={styles.personalHintRow}>
              <View style={styles.hintPill}>
                <Text style={styles.hintPillText}>나만 보기</Text>
              </View>
              <View style={[styles.hintPill, styles.hintPillWarm]}>
                <Text style={styles.hintPillText}>태그별 회고</Text>
              </View>
            </View>
          </SoftCard>
        </TouchableOpacity>

        {/* 로딩 */}
        {loading && groupCards.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.brand.primary} size="large" />
            <Text style={styles.loadingText}>그룹 불러오는 중…</Text>
          </View>
        ) : null}

        {/* 빈 상태 */}
        {!loading && groupCards.length === 0 ? (
            <SoftCard style={styles.emptyCard} variant="empty">
            <View style={styles.emptyIcon}>
              <Ionicons color={colors.brand.primary} name="people-outline" size={34} />
            </View>
            <Text style={styles.emptyTitle}>아직 참여 중인 그룹이 없어요</Text>
            <Text style={styles.emptyDesc}>
              같이 인증할 친구들을 초대하면 오늘의 진행이 여기서 바로 보입니다.
            </Text>
            <TouchableOpacity
              accessibilityLabel="그룹 만들기"
              accessibilityRole="button"
              activeOpacity={0.7}
              onPress={() => router.push('/group-actions')}
              style={styles.emptyButton}
            >
              <Text style={styles.emptyButtonText}>그룹 만들기 / 참여하기</Text>
            </TouchableOpacity>
          </SoftCard>
        ) : null}

        {/* 그룹 카드 */}
        {groupCards.map(({ group, tags, progress }, groupIndex) => (
          <TouchableOpacity
            accessibilityLabel={`${group.name} 그룹 열기`}
            accessibilityRole="button"
            activeOpacity={0.7}
            key={`${group.id}-${groupIndex}`}
            onPress={() => router.push(`/groups/${group.id}`)}
          >
            <SoftCard style={styles.groupCard} variant="group-space">
              <View style={styles.cardTopRow}>
                <View style={styles.cardTitleRow}>
                  <View style={styles.groupIcon}>
                    <Ionicons color={colors.brand.primaryDeep} name="people" size={16} />
                  </View>
                  <View>
                    <Text style={styles.cardTitle}>{group.name}</Text>
                    <Text style={styles.groupSubtitle}>
                      {progress.total > 0 ? `${progress.total}개 태그 진행 중` : '첫 태그를 기다리는 중'}
                    </Text>
                  </View>
                </View>
                <View style={styles.ruleBadge}>
                  <Text style={styles.ruleBadgeText}>
                    {group.threshold_rule === 'ALL'
                      ? '전원'
                      : group.threshold_rule === 'N_MINUS_1'
                        ? 'N-1'
                        : 'N-2'}
                  </Text>
                </View>
              </View>

              {/* 진행도 바 */}
              {progress.total > 0 ? (
                <View style={styles.progressSection}>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(100, (progress.certified / progress.total) * 100)}%`,
                          backgroundColor:
                            progress.certified >= progress.total
                              ? colors.status.success
                              : colors.brand.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {progress.certified === progress.total
                      ? '오늘 전체 태그 달성'
                      : `${progress.certified}/${progress.total} 태그 달성`}
                  </Text>
                </View>
              ) : null}

              {/* 태그 레일 */}
              {tags.length > 0 ? (
                <View style={styles.tagRail}>
                  {tags.slice(0, 5).map((tag) => (
                    <TagPill key={tag.id} label={tag.label} />
                  ))}
                  {tags.length > 5 ? (
                    <TagPill label="overflow" overflowCount={tags.length - 5} />
                  ) : null}
                </View>
              ) : (
                <Text style={styles.noTagText}>아직 태그가 없습니다</Text>
              )}

              <View style={styles.cardFooter}>
                <Text style={styles.cardMeta}>오전 5시 기준으로 하루가 정리돼요</Text>
                <Ionicons color={colors.text.tertiary} name="chevron-forward" size={17} />
              </View>
            </SoftCard>
          </TouchableOpacity>
        ))}

        {/* 하단 여백 */}
        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </View>
  );
}

// ── 스타일 ──

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.bg.canvas,
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },

  // 오늘 패널
  todayPanel: {
    backgroundColor: colors.surface.inverse,
    borderColor: colors.brand.accent,
    borderRadius: radius.sheet,
    borderWidth: 2,
    gap: spacing.md,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  todayTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  todayCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  todayEyebrow: {
    color: colors.brand.butter,
    fontSize: typography.eyebrow.fontSize,
    fontWeight: typography.eyebrow.fontWeight,
    letterSpacing: 0,
    lineHeight: typography.eyebrow.lineHeight,
    textTransform: 'uppercase',
  },
  todayTitle: {
    color: colors.text.inverse,
    fontSize: 27,
    fontWeight: '900',
    lineHeight: 33,
  },
  todayDescription: {
    color: '#E8DCEA',
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  todayStamp: {
    alignItems: 'center',
    backgroundColor: colors.brand.butterSoft,
    borderColor: colors.brand.accent,
    borderRadius: 18,
    borderWidth: 1,
    minWidth: 72,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    transform: [{ rotate: '3deg' }],
  },
  todayStampValue: {
    color: colors.text.primary,
    fontSize: 22,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    lineHeight: 27,
  },
  todayStampLabel: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: typography.label.fontWeight,
  },
  todayTrack: {
    backgroundColor: 'rgba(255, 249, 243, 0.16)',
    borderRadius: radius.pill,
    height: 10,
    overflow: 'hidden',
  },
  todayTrackFill: {
    backgroundColor: colors.brand.butter,
    borderRadius: radius.pill,
    height: '100%',
  },
  todayMetricRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  todayMetric: {
    backgroundColor: 'rgba(255, 249, 243, 0.12)',
    borderColor: 'rgba(255, 249, 243, 0.14)',
    borderRadius: radius.input,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xxs,
    padding: spacing.sm,
  },
  todayMetricValue: {
    color: colors.text.inverse,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    lineHeight: 24,
  },
  todayMetricLabel: {
    color: '#D8CADF',
    fontSize: 12,
    fontWeight: typography.label.fontWeight,
  },

  // 개인공간
  personalCard: {
    gap: spacing.sm,
  },
  cardTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    flex: 1,
  },
  cardTitle: {
    color: colors.text.primary,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    lineHeight: typography.title.lineHeight,
  },
  cardSubtext: {
    color: colors.text.secondary,
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: typography.body.lineHeight,
  },
  personalIcon: {
    alignItems: 'center',
    backgroundColor: colors.brand.accentSoft,
    borderRadius: radius.pill,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  personalHintRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  hintPill: {
    backgroundColor: colors.surface.raised,
    borderColor: colors.line.warm,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  hintPillWarm: {
    backgroundColor: colors.brand.butterSoft,
  },
  hintPillText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: typography.label.fontWeight,
  },

  // 로딩
  loadingBox: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxxl,
  },
  loadingText: {
    color: colors.text.tertiary,
    fontSize: typography.body.fontSize,
  },

  // 빈 상태
  emptyCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: colors.brand.primarySoft,
    borderRadius: radius.card,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  emptyTitle: {
    color: colors.text.primary,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
  },
  emptyDesc: {
    color: colors.text.secondary,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: colors.surface.inverse,
    borderRadius: radius.button,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  emptyButtonText: {
    color: colors.text.inverse,
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
  },

  // 그룹 카드
  groupCard: {
    gap: spacing.md,
  },
  groupIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface.raised,
    borderColor: colors.line.accent,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  groupSubtitle: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: typography.label.fontWeight,
    lineHeight: 16,
  },
  ruleBadge: {
    backgroundColor: colors.surface.raised,
    borderColor: colors.line.accent,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  ruleBadgeText: {
    color: colors.brand.primaryDeep,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 16,
  },
  progressSection: {
    gap: spacing.xs,
  },
  progressBarBg: {
    backgroundColor: colors.surface.raised,
    borderRadius: radius.pill,
    height: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    borderRadius: radius.pill,
    height: '100%',
  },
  progressText: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  tagRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  noTagText: {
    color: colors.text.tertiary,
    fontSize: typography.body.fontSize,
    fontStyle: 'italic',
  },
  cardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardMeta: {
    color: colors.text.tertiary,
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
  },
});
