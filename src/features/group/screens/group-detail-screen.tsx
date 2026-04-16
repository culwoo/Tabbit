import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import ViewShot from 'react-native-view-shot';

import { AppButton } from '@/components/ui/app-button';
import { SoftCard } from '@/components/ui/soft-card';
import { colors, radius, spacing, typography } from '@/constants/tokens';
import { StoryMemberTile } from '@/features/group/components/story-member-tile';
import { StoryShareModal } from '@/features/group/components/story-share-modal';
import { exportStoryShare } from '@/features/group/lib/export-story-share';
import type { GroupTagReadModel } from '@/features/group/model/story-share';
import { formatLifeDayLabel, formatTimestampLabel, isArchiveLifeDay } from '@/lib/life-day';
import { trackEvent } from '@/lib/monitoring';
import {
  getCurrentUserId,
  selectGroupById,
  selectSnapshot,
  selectTagEntriesForGroup,
  useStoryShareStore,
} from '@/store/story-share-store';

function buildShareRoute(groupId: string, tagId: string, lifeDay?: string, shareMode?: boolean) {
  const query = new URLSearchParams();
  query.set('tagId', tagId);
  if (lifeDay) {
    query.set('lifeDay', lifeDay);
  }
  if (shareMode) {
    query.set('shareMode', '1');
  }

  return `/groups/${groupId}?${query.toString()}`;
}

function renderStatusLabel(tagEntry: GroupTagReadModel) {
  if (tagEntry.thresholdState.status === 'archived') {
    return '아카이브 고정';
  }

  if (tagEntry.thresholdState.status === 'unlocked') {
    return '공유 가능';
  }

  return '잠금 상태';
}

export default function GroupDetailScreen() {
  const params = useLocalSearchParams<{
    groupId: string;
    tagId?: string;
    lifeDay?: string;
    shareMode?: string;
  }>();
  const state = useStoryShareStore();
  const viewShotRef = useRef<ViewShot | null>(null);
  const trackedUnlockKeys = useRef(new Set<string>());

  const normalizedGroupId = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId ?? 'focus-club';
  const requestedLifeDay = Array.isArray(params.lifeDay) ? params.lifeDay[0] : params.lifeDay;
  const requestedShareMode = Array.isArray(params.shareMode) ? params.shareMode[0] : params.shareMode;
  const group = selectGroupById(state, normalizedGroupId);
  const tagEntries = selectTagEntriesForGroup(state, normalizedGroupId, requestedLifeDay);

  const requestedTagId = Array.isArray(params.tagId) ? params.tagId[0] : params.tagId;
  const defaultTagEntry =
    tagEntries.find((entry) => entry.tagId === requestedTagId) ??
    tagEntries[0] ??
    group?.currentTags[0];

  const [selectedTagId, setSelectedTagId] = useState(defaultTagEntry?.tagId ?? '');
  const [isShareModeVisible, setShareModeVisible] = useState(false);
  const [isExporting, setExporting] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const defaultTagId = defaultTagEntry?.tagId ?? '';

  useEffect(() => {
    if (defaultTagId) {
      setSelectedTagId(defaultTagId);
    }
  }, [defaultTagId]);

  const selectedTag =
    tagEntries.find((entry) => entry.tagId === selectedTagId) ?? defaultTagEntry ?? tagEntries[0];

  const snapshot = selectedTag
    ? selectSnapshot(state, normalizedGroupId, selectedTag.tagId, selectedTag.lifeDay)
    : undefined;

  const isArchiveView = useMemo(() => {
    if (!group || !selectedTag) {
      return false;
    }

    return isArchiveLifeDay(group.currentLifeDay, selectedTag.lifeDay);
  }, [group, selectedTag]);

  useEffect(() => {
    if (!selectedTag) {
      return;
    }

    const unlockKey = `${selectedTag.groupId}:${selectedTag.tagId}:${selectedTag.lifeDay}`;
    if (selectedTag.thresholdState.status === 'locked' || trackedUnlockKeys.current.has(unlockKey)) {
      return;
    }

    trackedUnlockKeys.current.add(unlockKey);
    trackEvent('threshold_unlocked', {
      groupId: selectedTag.groupId,
      tagId: selectedTag.tagId,
      lifeDay: selectedTag.lifeDay,
      userId: getCurrentUserId(),
    });
  }, [selectedTag]);

  useEffect(() => {
    if (requestedShareMode !== '1' || !selectedTag?.shareEnabled) {
      return;
    }

    setShareModeVisible(true);
  }, [requestedShareMode, selectedTag?.shareEnabled]);

  useEffect(() => {
    if (!isShareModeVisible || !selectedTag) {
      return;
    }

    trackEvent('share_mode_opened', {
      userId: getCurrentUserId(),
      groupId: selectedTag.groupId,
      tagId: selectedTag.tagId,
      lifeDay: selectedTag.lifeDay,
    });
  }, [isShareModeVisible, selectedTag]);

  async function handleExport(shareAfterSave: boolean) {
    if (!selectedTag || !group || !viewShotRef.current) {
      return;
    }

    setExporting(true);
    setShareError(null);

    const result = await exportStoryShare({
      captureTarget: viewShotRef.current,
      groupId: selectedTag.groupId,
      tagId: selectedTag.tagId,
      lifeDay: selectedTag.lifeDay,
      exportedBy: getCurrentUserId(),
      shareAfterSave,
    });

    setExporting(false);

    if (!result.ok) {
      setShareError(result.message);
      return;
    }

    Alert.alert(
      '스토리 export 완료',
      shareAfterSave
        ? '이미지를 저장한 뒤 시스템 공유 시트를 열었습니다.'
        : '이미지를 기기 사진 보관함에 저장했습니다.',
    );

    if (!shareAfterSave) {
      setShareModeVisible(false);
    }
  }

  if (!group || !selectedTag) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.container}>
          <SoftCard style={styles.fallbackCard} variant="empty">
            <Text style={styles.fallbackTitle}>그룹 데이터를 찾지 못했습니다.</Text>
            <Text style={styles.fallbackDescription}>
              현재 mock 스토어에는 {normalizedGroupId} 데이터가 없습니다. 홈으로 돌아가 다시 진입해 주세요.
            </Text>
            <AppButton label="홈으로 이동" onPress={() => router.replace('/(tabs)/index')} />
          </SoftCard>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <SoftCard style={styles.heroCard} variant="group-space">
          <View style={styles.heroTopRow}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>{isArchiveView ? 'Archive replay' : 'Group detail'}</Text>
              <Text style={styles.heroTitle}>
                {group.emoji} {group.name}
              </Text>
              <Text style={styles.heroDescription}>{group.description}</Text>
            </View>
            <View style={styles.heroActions}>
              <Pressable
                accessibilityLabel="홈으로 이동"
                onPress={() => router.replace('/(tabs)/index')}
                style={styles.iconButton}>
                <Ionicons color={colors.text.primary} name="home-outline" size={18} />
              </Pressable>
              <Pressable
                accessibilityLabel="그룹 채팅 열기"
                onPress={() => router.push(`/groups/chat/${normalizedGroupId}`)}
                style={styles.iconButton}>
                <Ionicons color={colors.text.primary} name="chatbubble-ellipses-outline" size={18} />
              </Pressable>
            </View>
          </View>

          <View style={styles.lifeDayRow}>
            <View style={styles.lifeDayPill}>
              <Text style={styles.lifeDayPillText}>{formatLifeDayLabel(selectedTag.lifeDay)}</Text>
            </View>
            <View style={styles.lifeDayPill}>
              <Text style={styles.lifeDayPillText}>
                {isArchiveView ? '오전 5시 후 아카이브' : '오전 5시 전 실시간 반영'}
              </Text>
            </View>
          </View>
        </SoftCard>

        <SoftCard style={styles.shareCard} variant="empty">
          <View style={styles.shareCardHeader}>
            <View style={styles.shareCardCopy}>
              <Text style={styles.shareCardTitle}>{selectedTag.tagLabel} 공유 상태</Text>
              <Text style={styles.shareCardDescription}>{selectedTag.subtitle}</Text>
            </View>
            <View
              style={[
                styles.statusChip,
                selectedTag.thresholdState.status === 'locked'
                  ? styles.statusChipLocked
                  : selectedTag.thresholdState.status === 'archived'
                    ? styles.statusChipArchive
                    : styles.statusChipReady,
              ]}>
              <Text style={styles.statusChipText}>{renderStatusLabel(selectedTag)}</Text>
            </View>
          </View>

          <View style={styles.shareMetricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>진행 상태</Text>
              <Text style={styles.metricValue}>{selectedTag.shareProgressLabel}</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>언락/마감 시점</Text>
              <Text style={styles.metricValue}>
                {formatTimestampLabel(
                  selectedTag.thresholdState.archivedAt ?? selectedTag.thresholdState.unlockedAt,
                )}
              </Text>
            </View>
          </View>

          {snapshot ? (
            <View style={styles.snapshotBanner}>
              <Ionicons color={colors.brand.primary} name="images-outline" size={18} />
              <View style={styles.snapshotCopy}>
                <Text style={styles.snapshotTitle}>저장된 스냅샷이 있습니다</Text>
                <Text style={styles.snapshotDescription}>
                  {formatTimestampLabel(snapshot.exportedAt)}에 저장됨 · 날짜 상세에서 다시 진입 가능
                </Text>
              </View>
            </View>
          ) : null}

          <AppButton
            label="우리의 갓생 공유하기"
            onPress={() => {
              setShareError(null);
              setShareModeVisible(true);
            }}
            variant={selectedTag.shareEnabled ? 'primary' : 'muted'}
            disabled={!selectedTag.shareEnabled}
          />
        </SoftCard>

        <View style={styles.tagPicker}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.tagPillRow}>
              {tagEntries.map((entry) => {
                const isSelected = entry.tagId === selectedTag.tagId;

                return (
                  <Pressable
                    key={`${entry.tagId}-${entry.lifeDay}`}
                    onPress={() => setSelectedTagId(entry.tagId)}
                    style={[
                      styles.tagPill,
                      isSelected ? styles.tagPillSelected : styles.tagPillIdle,
                    ]}>
                    <Text style={[styles.tagPillTitle, isSelected && styles.tagPillTitleSelected]}>
                      {entry.tagLabel}
                    </Text>
                    <Text style={[styles.tagPillMeta, isSelected && styles.tagPillMetaSelected]}>
                      {entry.shareProgressLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>

        <SoftCard style={styles.feedIntroCard} variant="empty">
          <Text style={styles.feedTitle}>{selectedTag.title}</Text>
          <Text style={styles.feedDescription}>
            Share Mode는 이 태그 화면 구성을 거의 그대로 사용하되, 9:16 안전영역과 상단 카피만 추가합니다.
          </Text>
          <View style={styles.inlineActions}>
            <AppButton
              label="날짜 상세로 보기"
              onPress={() => router.push(`/calendar/${selectedTag.lifeDay}`)}
              variant="secondary"
            />
            <AppButton
              label="공유 모드 미리보기"
              onPress={() => setShareModeVisible(true)}
              variant="secondary"
              disabled={!selectedTag.shareEnabled}
            />
          </View>
        </SoftCard>

        <View style={styles.memberGrid}>
          {selectedTag.members.map((member) => (
            <View key={member.memberId} style={styles.memberGridItem}>
              <StoryMemberTile member={member} />
            </View>
          ))}
        </View>

        {isArchiveView ? (
          <SoftCard style={styles.archiveHintCard} variant="empty">
            <Text style={styles.archiveHintTitle}>아카이브 재열기</Text>
            <Text style={styles.archiveHintDescription}>
              이 화면은 {selectedTag.lifeDay} 생활일의 참여 멤버 구성을 고정한 버전입니다. 새 인증이 들어와도 이
              아카이브는 바뀌지 않습니다.
            </Text>
            <AppButton
              label="현재 생활일로 돌아가기"
              onPress={() =>
                router.replace(
                  buildShareRoute(normalizedGroupId, group.currentTags[0]?.tagId ?? selectedTag.tagId),
                )
              }
              variant="secondary"
            />
          </SoftCard>
        ) : null}
      </ScrollView>

      <StoryShareModal
        captureRef={viewShotRef}
        errorMessage={shareError}
        group={group}
        isExporting={isExporting}
        onClose={() => setShareModeVisible(false)}
        onSave={() => void handleExport(false)}
        onSaveAndShare={() => void handleExport(true)}
        tagEntry={selectedTag}
        visible={isShareModeVisible}
      />
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
  fallbackCard: {
    gap: spacing.sm,
  },
  fallbackTitle: {
    color: colors.text.primary,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    lineHeight: typography.title.lineHeight,
  },
  fallbackDescription: {
    color: colors.text.secondary,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  heroCard: {
    gap: spacing.md,
  },
  heroTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  heroCopy: {
    flex: 1,
    gap: spacing.xs,
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
  heroActions: {
    flexDirection: 'row',
    gap: spacing.xs,
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
  },
  lifeDayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  lifeDayPill: {
    backgroundColor: colors.surface.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  lifeDayPillText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: typography.label.fontWeight,
  },
  shareCard: {
    gap: spacing.md,
  },
  shareCardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  shareCardCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  shareCardTitle: {
    color: colors.text.primary,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    lineHeight: typography.title.lineHeight,
  },
  shareCardDescription: {
    color: colors.text.secondary,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  statusChip: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusChipLocked: {
    backgroundColor: colors.badge.neutral,
  },
  statusChipReady: {
    backgroundColor: colors.brand.secondarySoft,
  },
  statusChipArchive: {
    backgroundColor: colors.brand.primarySoft,
  },
  statusChipText: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: typography.label.fontWeight,
  },
  shareMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricBox: {
    backgroundColor: colors.surface.secondary,
    borderRadius: radius.input,
    flex: 1,
    gap: spacing.xxs,
    minWidth: 140,
    padding: spacing.md,
  },
  metricLabel: {
    color: colors.text.tertiary,
    fontSize: 12,
    fontWeight: typography.label.fontWeight,
  },
  metricValue: {
    color: colors.text.primary,
    fontSize: typography.body.fontSize,
    fontWeight: typography.bodyStrong.fontWeight,
    lineHeight: typography.body.lineHeight,
  },
  snapshotBanner: {
    alignItems: 'center',
    backgroundColor: colors.brand.primarySoft,
    borderRadius: radius.input,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  snapshotCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  snapshotTitle: {
    color: colors.text.primary,
    fontSize: typography.label.fontSize,
    fontWeight: typography.bodyStrong.fontWeight,
  },
  snapshotDescription: {
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 16,
  },
  tagPicker: {
    marginHorizontal: -spacing.lg,
  },
  tagPillRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  tagPill: {
    borderRadius: radius.input,
    borderWidth: 1,
    gap: spacing.xxs,
    minWidth: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tagPillIdle: {
    backgroundColor: colors.surface.primary,
    borderColor: colors.line.soft,
  },
  tagPillSelected: {
    backgroundColor: colors.brand.primarySoft,
    borderColor: colors.brand.primary,
  },
  tagPillTitle: {
    color: colors.text.primary,
    fontSize: typography.label.fontSize,
    fontWeight: typography.bodyStrong.fontWeight,
  },
  tagPillTitleSelected: {
    color: colors.brand.primary,
  },
  tagPillMeta: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: typography.label.fontWeight,
  },
  tagPillMetaSelected: {
    color: colors.text.primary,
  },
  feedIntroCard: {
    gap: spacing.sm,
  },
  feedTitle: {
    color: colors.text.primary,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    lineHeight: typography.title.lineHeight,
  },
  feedDescription: {
    color: colors.text.secondary,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  memberGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  memberGridItem: {
    minWidth: '47%',
    width: '47%',
  },
  archiveHintCard: {
    gap: spacing.sm,
  },
  archiveHintTitle: {
    color: colors.text.primary,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    lineHeight: typography.title.lineHeight,
  },
  archiveHintDescription: {
    color: colors.text.secondary,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
});
