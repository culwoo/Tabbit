import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { colors, spacing, typography, shadow, radius } from '@/constants/tokens';
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
        {/* 개인공간 카드 */}
        <TouchableOpacity
          accessibilityLabel="개인공간 열기"
          accessibilityRole="button"
          activeOpacity={0.7}
          onPress={() => router.push('/personal')}
        >
          <SoftCard style={styles.personalCard} variant="personal-space">
            <View style={styles.cardTopRow}>
              <View style={styles.cardTitleRow}>
                <Ionicons color={colors.brand.accent} name="bookmark" size={18} />
                <Text style={styles.cardTitle}>개인공간</Text>
              </View>
              <Ionicons color={colors.text.tertiary} name="chevron-forward" size={18} />
            </View>
            <Text style={styles.cardSubtext}>나만의 기록과 회고</Text>
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
            <Ionicons color={colors.text.tertiary} name="people-outline" size={48} />
            <Text style={styles.emptyTitle}>아직 참여 중인 그룹이 없어요</Text>
            <Text style={styles.emptyDesc}>
              오른쪽 상단 + 버튼으로{'\n'}그룹을 만들거나 초대 코드로 참여해보세요
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
        {groupCards.map(({ group, tags, progress }) => (
          <TouchableOpacity
            accessibilityLabel={`${group.name} 그룹 열기`}
            accessibilityRole="button"
            activeOpacity={0.7}
            key={group.id}
            onPress={() => router.push(`/groups/${group.id}`)}
          >
            <SoftCard style={styles.groupCard} variant="group-space">
              <View style={styles.cardTopRow}>
                <View style={styles.cardTitleRow}>
                  <Ionicons color={colors.brand.primary} name="people" size={18} />
                  <Text style={styles.cardTitle}>{group.name}</Text>
                </View>
                <Ionicons color={colors.text.tertiary} name="chevron-forward" size={18} />
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
                      ? '🎉 오늘 전체 태그 달성!'
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

              {/* 하단 메타 */}
              <Text style={styles.cardMeta}>
                {group.threshold_rule === 'ALL'
                  ? '전원 인증'
                  : group.threshold_rule === 'N_MINUS_1'
                    ? 'N-1명 인증'
                    : 'N-2명 인증'}
              </Text>
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
    gap: spacing.sm,
    padding: spacing.lg,
  },

  // 개인공간
  personalCard: {
    gap: spacing.xs,
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
  },
  cardTitle: {
    color: colors.text.primary,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
  },
  cardSubtext: {
    color: colors.text.secondary,
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
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
    gap: spacing.md,
    paddingVertical: spacing.xxl,
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
    gap: spacing.sm,
  },
  progressSection: {
    gap: spacing.xs,
  },
  progressBarBg: {
    backgroundColor: colors.bg.sunken,
    borderRadius: 6,
    height: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    borderRadius: 6,
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
  cardMeta: {
    color: colors.text.tertiary,
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
  },
});
