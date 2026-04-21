import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Bunny,
  PaperTag,
  PhotoBlock,
  Polaroid,
  Scribble,
  Tape,
  paperColors,
  paperFonts,
  paperShadow,
  stripHash,
  toneFromIndex,
  withHash,
} from '@/components/ui/paper-design';
import { spacing } from '@/constants/tokens';
import { resolveLifestyleDate } from '@/lib/domain';
import { formatLifeDayLabel } from '@/lib/life-day';
import {
  fetchGroupTags,
  fetchGroupThresholdStates,
  fetchMyGroups,
  fetchUnreadNotificationCount,
  type GroupRow,
  type GroupTagRow,
} from '@/lib/supabase';
import { useAppSession } from '@/providers/app-session-provider';
import { useFontPreference } from '@/providers/font-preference-provider';

type GroupCard = {
  group: GroupRow & { myRole: string };
  tags: GroupTagRow[];
  progress: { certified: number; threshold: number; total: number };
};

function formatNumericDate(lifeDay: string) {
  return lifeDay.replace(/-/g, '. ');
}

function getGroupTilt(index: number) {
  return [-1.4, 1.8, -1, 1.3][index % 4];
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { userId } = useAppSession();
  const { bodyTextStyle, strongTextStyle } = useFontPreference();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const [groupCards, setGroupCards] = useState<GroupCard[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const today = resolveLifestyleDate(new Date());

  const loadData = useCallback(async () => {
    try {
      const [groups, unreadCount] = await Promise.all([
        fetchMyGroups(),
        userId ? fetchUnreadNotificationCount(userId) : Promise.resolve(0),
      ]);

      const cards: GroupCard[] = await Promise.all(
        groups.map(async (group) => {
          const [tags, thresholds] = await Promise.all([
            fetchGroupTags(group.id),
            fetchGroupThresholdStates(group.id, today),
          ]);

          const certifiedCount = thresholds.filter(
            (threshold) =>
              threshold.status === 'provisional_unlocked' || threshold.status === 'finalized',
          ).length;
          const avgThreshold =
            thresholds.length > 0
              ? Math.round(
                  thresholds.reduce((sum, threshold) => sum + threshold.effective_threshold, 0) /
                    thresholds.length,
                )
              : 0;

          return {
            group,
            progress: {
              certified: certifiedCount,
              threshold: avgThreshold,
              total: tags.length,
            },
            tags,
          };
        }),
      );

      setGroupCards(cards);
      setUnreadNotificationCount(unreadCount);
    } catch (error) {
      console.error('[HomeScreen] loadData error:', error);
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }, [today, userId]);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedRef.current) {
        setLoading(true);
      }
      void loadData();
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
    };
  }, [groupCards]);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: insets.bottom + 124,
            paddingTop: insets.top + 4,
          },
        ]}
        refreshControl={
          <RefreshControl
            colors={[paperColors.coral]}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            tintColor={paperColors.coral}
          />
        }
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Bunny size={30} />
            <Text style={styles.logo}>tabbit</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityLabel="그룹 만들기 또는 참여하기"
              accessibilityRole="button"
              onPress={() => router.push('/group-actions')}
              style={styles.iconButton}>
              <Ionicons color={paperColors.ink0} name="add" size={20} />
            </Pressable>
            <Pressable
              accessibilityLabel="알림"
              accessibilityRole="button"
              onPress={() => router.push('/notifications')}
              style={styles.iconButton}>
              <Ionicons color={paperColors.ink0} name="notifications-outline" size={18} />
              {unreadNotificationCount > 0 ? <View style={styles.notificationDot} /> : null}
            </Pressable>
          </View>
        </View>

        <View style={styles.greeting}>
          <View style={styles.dateRow}>
            <Text style={[styles.dateText, strongTextStyle]}>{formatNumericDate(today)}</Text>
            <Text style={[styles.dateMuted, strongTextStyle]}>· {formatLifeDayLabel(today)}</Text>
          </View>
          <Text style={styles.greetingTitle}>
            오늘도 찰칵,{'\n'}
            <Text>함께 가보자</Text>
          </Text>
          <Scribble width={158} style={styles.greetingScribble} />
        </View>

        <View style={styles.personalSection}>
          <Pressable
            accessibilityLabel="나의 공간 열기"
            accessibilityRole="button"
            onPress={() => router.push('/personal')}
            style={styles.personalPhotoWrap}>
            <Tape angle={-10} left={24} top={-8} width={46} />
            <Polaroid caption="나의 공간" tilt={-2.5} tone="peach" width={118}>
              <PhotoBlock height={104} tone="peach">
                <Bunny size={72} />
              </PhotoBlock>
              <View style={styles.personalMiniBadge}>
                <Text style={styles.personalMiniBadgeText}>{homeStats.certifiedTags}컷</Text>
              </View>
            </Polaroid>
          </Pressable>
          <View style={styles.personalCopy}>
            <Text style={[styles.sectionEyebrow, strongTextStyle]}>나의 공간</Text>
            <Text style={[styles.personalTitle, strongTextStyle]}>지금의 기록장</Text>
            <Text style={[styles.personalMeta, bodyTextStyle]}>
              이번 주 <Text style={styles.strong}>{homeStats.totalTags}</Text>개 태그를 따라가고 있어
            </Text>
          </View>
        </View>

        <View style={styles.groupSectionBreak} />
        <View style={styles.groupHeader}>
          <Text style={[styles.groupTitle, strongTextStyle]}>우리 그룹들</Text>
          <Text style={[styles.groupMore, bodyTextStyle]}>{groupCards.length}개 보기</Text>
        </View>

        {loading && groupCards.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={paperColors.coral} size="large" />
            <Text style={[styles.loadingText, bodyTextStyle]}>그룹을 불러오는 중</Text>
          </View>
        ) : null}

        {!loading && groupCards.length === 0 ? (
          <View style={styles.emptyCard}>
            <Tape angle={-5} left={28} top={-10} width={72} />
            <Text style={[styles.emptyTitle, strongTextStyle]}>아직 함께하는 그룹이 없어</Text>
            <Text style={[styles.emptyDescription, bodyTextStyle]}>
              친구들과 같은 태그를 정하면 오늘의 인증이 이 종이 위에 차곡차곡 모여요.
            </Text>
            <Pressable
              accessibilityLabel="그룹 만들기"
              accessibilityRole="button"
              onPress={() => router.push('/group-actions')}
              style={styles.emptyButton}>
              <Text style={[styles.emptyButtonText, strongTextStyle]}>그룹 만들기 / 참여하기</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.groupList}>
          {groupCards.map(({ group, progress, tags }, groupIndex) => {
            const tilt = getGroupTilt(groupIndex);
            const doneLabel = progress.total > 0 ? `${progress.certified}/${progress.total}` : '0/0';
            const memberCopy = group.member_limit ? `${group.member_limit}명이서` : '함께';

            return (
              <Pressable
                accessibilityLabel={`${group.name} 그룹 열기`}
                accessibilityRole="button"
                key={`${group.id}-${groupIndex}`}
                onPress={() => router.push(`/groups/${group.id}`)}
                style={styles.groupPressable}>
                <Tape
                  angle={tilt * 4}
                  color={
                    groupIndex % 3 === 0
                      ? 'rgba(185,211,194,0.7)'
                      : groupIndex % 3 === 1
                        ? 'rgba(241,201,179,0.7)'
                        : 'rgba(191,210,222,0.7)'
                  }
                  left={30}
                  top={0}
                  width={70}
                />
                <View style={[styles.scrapGroupCard, { transform: [{ rotate: `${tilt}deg` }] }]}>
                  <View style={styles.groupCardTop}>
                    <View style={styles.groupCardCopy}>
                      <Text numberOfLines={1} style={[styles.groupName, strongTextStyle]}>
                        {group.name}
                      </Text>
                      <Text style={[styles.groupSub, bodyTextStyle]}>{memberCopy}</Text>
                    </View>
                    {progress.certified > 0 ? <Text style={styles.newMark}>new!</Text> : null}
                  </View>

                  <View style={styles.photoStrip}>
                    {tags.slice(0, 3).map((tag, tagIndex) => (
                      <View
                        key={tag.id}
                        style={{
                          transform: [
                            {
                              rotate: `${(tagIndex % 2 === 0 ? -1 : 1) * (1.2 + tagIndex * 0.3)}deg`,
                            },
                          ],
                        }}>
                        <Polaroid
                          label={stripHash(tag.label)}
                          photoHeight={74}
                          tone={toneFromIndex(groupIndex + tagIndex)}
                          width={74}
                        />
                      </View>
                    ))}
                    {tags.length === 0 ? (
                      <Polaroid label="tag" photoHeight={74} tone="kraft" width={74} />
                    ) : null}
                    <Text style={styles.photoPlus}>+</Text>
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.tagRail}>
                      {tags.slice(0, 3).map((tag) => (
                        <PaperTag key={tag.id}>{withHash(tag.label)}</PaperTag>
                      ))}
                      {tags.length > 3 ? <PaperTag>+{tags.length - 3}</PaperTag> : null}
                    </View>
                    <View style={styles.todayBadge}>
                      <Text style={styles.todayBadgeText}>오늘 {doneLabel}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  cardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    marginTop: 12,
  },
  dateMuted: {
    color: paperColors.ink3,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 16,
  },
  dateRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 8,
  },
  dateText: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 14,
    lineHeight: 19,
  },
  emptyButton: {
    alignSelf: 'flex-start',
    backgroundColor: paperColors.ink0,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  emptyButtonText: {
    color: paperColors.card,
    fontFamily: paperFonts.handBold,
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 6,
    borderWidth: 1.5,
    gap: 8,
    marginHorizontal: 18,
    marginTop: 4,
    padding: 16,
    position: 'relative',
    ...paperShadow,
  },
  emptyDescription: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 15,
    lineHeight: 22,
  },
  emptyTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 21,
    lineHeight: 26,
  },
  greeting: {
    paddingHorizontal: 22,
    paddingTop: 6,
    position: 'relative',
  },
  greetingScribble: {
    left: 22,
    position: 'absolute',
    top: 103,
  },
  greetingTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 28,
    lineHeight: 34,
    marginTop: 4,
  },
  groupCardCopy: {
    flex: 1,
    minWidth: 0,
  },
  groupCardTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  groupHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 0,
  },
  groupList: {
    gap: 22,
    paddingHorizontal: 18,
  },
  groupMore: {
    color: paperColors.coral,
    fontFamily: paperFonts.pen,
    fontSize: 17,
    lineHeight: 22,
  },
  groupName: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 18,
    lineHeight: 23,
  },
  groupPressable: {
    paddingTop: 8,
    position: 'relative',
  },
  groupSub: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  groupTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 15,
    lineHeight: 20,
  },
  groupSectionBreak: {
    alignSelf: 'center',
    backgroundColor: 'rgba(27,26,23,0.12)',
    height: 1,
    marginTop: 10,
    width: '82%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.5,
    height: 38,
    justifyContent: 'center',
    position: 'relative',
    width: 38,
  },
  loadingBox: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 44,
  },
  loadingText: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 15,
  },
  logo: {
    color: paperColors.ink0,
    fontFamily: paperFonts.pen,
    fontSize: 31,
    lineHeight: 37,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  newMark: {
    color: paperColors.coral,
    fontFamily: paperFonts.pen,
    fontSize: 17,
    lineHeight: 22,
    transform: [{ rotate: '6deg' }],
  },
  notificationDot: {
    backgroundColor: paperColors.coral,
    borderColor: paperColors.paper0,
    borderRadius: 999,
    borderWidth: 1.5,
    height: 9,
    position: 'absolute',
    right: 0,
    top: 0,
    width: 9,
  },
  personalCopy: {
    flex: 1,
    paddingTop: 14,
  },
  personalMeta: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  personalMiniBadge: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.2,
    paddingHorizontal: 7,
    paddingVertical: 1,
    position: 'absolute',
    right: 14,
    top: 16,
  },
  personalMiniBadgeText: {
    color: paperColors.ink0,
    fontFamily: paperFonts.pen,
    fontSize: 15,
    lineHeight: 18,
  },
  personalPhotoWrap: {
    position: 'relative',
  },
  personalSection: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 22,
    paddingTop: 4,
  },
  personalTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 20,
    lineHeight: 25,
    marginTop: 4,
  },
  photoPlus: {
    alignSelf: 'center',
    color: paperColors.ink1,
    fontFamily: paperFonts.pen,
    fontSize: 19,
    lineHeight: 24,
    marginLeft: 'auto',
  },
  photoStrip: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    overflow: 'hidden',
  },
  scrapGroupCard: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 6,
    borderWidth: 1.5,
    padding: 14,
    ...paperShadow,
  },
  screen: {
    backgroundColor: paperColors.paper0,
    flex: 1,
  },
  scrollContent: {
    gap: spacing.md,
  },
  sectionEyebrow: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    letterSpacing: 0.8,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  strong: {
    color: paperColors.ink0,
  },
  tagRail: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  todayBadge: {
    backgroundColor: paperColors.butter,
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.2,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  todayBadgeText: {
    color: paperColors.ink0,
    fontFamily: paperFonts.pen,
    fontSize: 18,
    lineHeight: 22,
  },
});
