import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import ViewShot from 'react-native-view-shot';

import { AppHeader } from '@/components/shell/app-header';
import { AppButton } from '@/components/ui/app-button';
import { SoftCard } from '@/components/ui/soft-card';
import { colors, radius, spacing, typography } from '@/constants/tokens';
import { StoryMemberTile } from '@/features/group/components/story-member-tile';
import { StoryShareModal } from '@/features/group/components/story-share-modal';
import { exportStoryShare } from '@/features/group/lib/export-story-share';
import { formatLifeDayLabel, formatTimestampLabel, isArchiveLifeDay } from '@/lib/life-day';
import { trackEvent } from '@/lib/monitoring';
import { addGroupTag, deleteGroupTag } from '@/lib/supabase';
import { useGroupDetail, type GroupTagEntry } from '../hooks/use-group-detail';
import { useAppSession } from '@/providers/app-session-provider';

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

function renderStatusLabel(tagEntry: GroupTagEntry) {
  if (tagEntry.thresholdState.status === 'expired') {
    return '아카이브 고정';
  }

  if (tagEntry.thresholdState.status === 'provisional_unlocked' || tagEntry.thresholdState.status === 'finalized') {
    return '공유 가능';
  }

  return '잠금 상태';
}

export default function GroupDetailScreen() {
  const navigation = useNavigation();
  const { userId } = useAppSession();
  const params = useLocalSearchParams<{
    groupId: string;
    tagId?: string;
    lifeDay?: string;
    shareMode?: string;
  }>();

  const viewShotRef = useRef<ViewShot | null>(null);
  const trackedUnlockKeys = useRef(new Set<string>());

  const normalizedGroupId = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId ?? '';
  const requestedLifeDay = Array.isArray(params.lifeDay) ? params.lifeDay[0] : params.lifeDay;
  const requestedShareMode = Array.isArray(params.shareMode) ? params.shareMode[0] : params.shareMode;

  const { errorMessage, loading, group, tagEntries, snapshots, lifeDay, refresh } = useGroupDetail(normalizedGroupId, requestedLifeDay);

  const requestedTagId = Array.isArray(params.tagId) ? params.tagId[0] : params.tagId;
  const defaultTagEntry =
    tagEntries.find((entry) => entry.tagId === requestedTagId) ??
    tagEntries[0];

  const [selectedTagId, setSelectedTagId] = useState('');
  const [newTagLabel, setNewTagLabel] = useState('');
  const [isCreatingTag, setCreatingTag] = useState(false);
  const [isShareModeVisible, setShareModeVisible] = useState(false);
  const [isExporting, setExporting] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultTagEntry?.tagId && !selectedTagId) {
      setSelectedTagId(defaultTagEntry.tagId);
    }
  }, [defaultTagEntry?.tagId, selectedTagId]);

  const selectedTag = tagEntries.find((entry) => entry.tagId === selectedTagId) ?? defaultTagEntry ?? tagEntries[0];

  const snapshot = selectedTag ? snapshots[selectedTag.tagId] : undefined;
  const snapshotSavedAt = snapshot?.last_snapshot_exported_at ?? null;

  const isArchiveView = useMemo(() => {
    if (!group || !selectedTag) {
      return false;
    }
    return isArchiveLifeDay(lifeDay, selectedTag.lifeDay); // using lifeDay hook result
  }, [group, selectedTag, lifeDay]);

  useEffect(() => {
    if (!selectedTag) {
      return;
    }

    const unlockKey = `${normalizedGroupId}:${selectedTag.tagId}:${selectedTag.lifeDay}`;
    if (selectedTag.thresholdState.status === 'locked' || trackedUnlockKeys.current.has(unlockKey)) {
      return;
    }

    trackedUnlockKeys.current.add(unlockKey);
    trackEvent('threshold_unlocked', {
      groupId: normalizedGroupId,
      tagId: selectedTag.tagId,
      lifeDay: selectedTag.lifeDay,
      userId: userId!,
    });
  }, [selectedTag, normalizedGroupId, userId]);

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
      userId: userId!,
      groupId: normalizedGroupId,
      tagId: selectedTag.tagId,
      lifeDay: selectedTag.lifeDay,
    });
  }, [isShareModeVisible, selectedTag, normalizedGroupId, userId]);

  async function handleExport(shareAfterSave: boolean) {
    if (!selectedTag || !group || !viewShotRef.current) {
      return;
    }

    setExporting(true);
    setShareError(null);

    const result = await exportStoryShare({
      captureTarget: viewShotRef.current,
      groupId: normalizedGroupId,
      tagId: selectedTag.tagId,
      lifeDay: selectedTag.lifeDay,
      exportedBy: userId!,
      shareAfterSave,
    });

    setExporting(false);

    if (!result.ok) {
      setShareError(result.message);
      return;
    }

    await refresh();

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

  function goHome() {
    router.replace('/');
  }

  function handleBack() {
    if (navigation.canGoBack()) {
      router.back();
      return;
    }

    goHome();
  }

  async function handleCreateGroupTag() {
    const label = newTagLabel.trim();

    if (!label || isCreatingTag) {
      return;
    }

    setCreatingTag(true);

    try {
      const tag = await addGroupTag(normalizedGroupId, label, userId ?? undefined);
      setNewTagLabel('');
      setSelectedTagId(tag.id);
      await refresh();
    } catch (error) {
      Alert.alert(
        '태그 생성 실패',
        error instanceof Error ? error.message : '그룹 태그를 만들지 못했습니다.',
      );
    } finally {
      setCreatingTag(false);
    }
  }

  function handleDeleteSelectedTag() {
    if (!selectedTag) {
      return;
    }

    Alert.alert(
      '태그를 삭제할까요?',
      `${selectedTag.tagLabel} 태그를 이 그룹에서 삭제합니다. 이미 인증에 사용된 태그는 삭제되지 않을 수 있습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGroupTag(normalizedGroupId, selectedTag.tagId);
              const nextTag = tagEntries.find((entry) => entry.tagId !== selectedTag.tagId);
              setSelectedTagId(nextTag?.tagId ?? '');
              await refresh();
            } catch (error) {
              Alert.alert(
                '태그 삭제 실패',
                error instanceof Error ? error.message : '태그를 삭제하지 못했습니다.',
              );
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.screen}>
        <AppHeader onBack={handleBack} title="그룹" variant="detail" />
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
          <Text style={{ marginTop: spacing.sm, color: colors.text.secondary }}>데이터를 불러오는 중입니다...</Text>
        </View>
      </View>
    );
  }

  if (!group) {
    return (
      <View style={styles.screen}>
        <AppHeader onBack={handleBack} title="그룹" variant="detail" />
        <ScrollView contentContainerStyle={styles.container}>
          <SoftCard style={styles.fallbackCard} variant="empty">
            <Text style={styles.fallbackTitle}>그룹 데이터를 찾지 못했습니다.</Text>
            <Text style={styles.fallbackDescription}>
              {errorMessage ?? `현재 ${normalizedGroupId || '선택한'} 그룹에 접근할 수 없습니다.`}
            </Text>
            <AppButton label="다시 불러오기" onPress={() => void refresh()} variant="secondary" />
            <AppButton label="홈으로 이동" onPress={goHome} />
          </SoftCard>
        </ScrollView>
      </View>
    );
  }

  if (!selectedTag) {
    return (
      <View style={styles.screen}>
        <AppHeader onBack={handleBack} title={group.name} variant="detail" />
        <ScrollView
          contentContainerStyle={styles.container}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}>
          <SoftCard style={styles.fallbackCard} variant="empty">
            <Text style={styles.fallbackTitle}>첫 태그를 만들어주세요.</Text>
            <Text style={styles.fallbackDescription}>
              그룹은 만들어졌고 접근도 가능합니다. 이제 인증에 사용할 태그를 하나 만들면 그룹 화면을 바로 사용할 수 있습니다.
            </Text>
            <View style={styles.tagCreator}>
              <Text style={styles.inputLabel}>그룹 태그</Text>
              <TextInput
                value={newTagLabel}
                onChangeText={setNewTagLabel}
                editable={!isCreatingTag}
                placeholder="예: #운동"
                placeholderTextColor={colors.text.tertiary}
                style={styles.textInput}
                maxLength={24}
                onSubmitEditing={() => void handleCreateGroupTag()}
              />
              <AppButton
                label={isCreatingTag ? '태그 생성 중...' : '태그 만들기'}
                onPress={() => void handleCreateGroupTag()}
                disabled={!newTagLabel.trim() || isCreatingTag}
              />
            </View>
            <AppButton label="홈으로 이동" onPress={goHome} variant="secondary" />
          </SoftCard>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader onBack={handleBack} title={group.name} variant="detail" />
      <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <SoftCard style={styles.heroCard} variant="group-space">
          <View style={styles.heroTopRow}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>{isArchiveView ? 'Saved day' : 'Team room'}</Text>
              <Text style={styles.heroTitle}>
                {group.name}
              </Text>
              {group.description && <Text style={styles.heroDescription}>{group.description}</Text>}
            </View>
            <View style={styles.heroActions}>
              <Pressable
                accessibilityLabel="홈으로 이동"
                onPress={goHome}
                style={styles.iconButton}>
                <Ionicons color={colors.text.inverse} name="home-outline" size={18} />
              </Pressable>
              <Pressable
                accessibilityLabel="그룹 채팅 열기"
                onPress={() => router.push(`/groups/chat/${normalizedGroupId}`)}
                style={styles.iconButton}>
                <Ionicons color={colors.text.inverse} name="chatbubble-ellipses-outline" size={18} />
              </Pressable>
            </View>
          </View>

          <View style={styles.lifeDayRow}>
            <View style={styles.lifeDayPill}>
              <Text style={styles.lifeDayPillText}>{formatLifeDayLabel(selectedTag.lifeDay)}</Text>
            </View>
            <View style={styles.lifeDayPill}>
              <Text style={styles.lifeDayPillText}>
                {isArchiveView ? '마감 후 저장된 하루' : '오전 5시 전까지 반영'}
              </Text>
            </View>
          </View>
        </SoftCard>

        <SoftCard style={styles.shareCard} variant="empty">
          <View style={styles.shareCardHeader}>
            <View style={styles.shareCardCopy}>
              <Text style={styles.shareCardTitle}>{selectedTag.tagLabel} 오늘의 공유</Text>
              <Text style={styles.shareCardDescription}>{selectedTag.subtitle}</Text>
            </View>
            <View
              style={[
                styles.statusChip,
                selectedTag.thresholdState.status === 'locked'
                  ? styles.statusChipLocked
                  : selectedTag.thresholdState.status === 'expired'
                    ? styles.statusChipArchive
                    : styles.statusChipReady,
              ]}>
              <Text style={styles.statusChipText}>{renderStatusLabel(selectedTag)}</Text>
            </View>
          </View>

          <View style={styles.shareMetricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>함께한 인원</Text>
              <Text style={styles.metricValue}>{selectedTag.shareProgressLabel}</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>스토리 상태</Text>
              <Text style={styles.metricValue}>
                {'unlocked_at' in selectedTag.thresholdState && selectedTag.thresholdState.unlocked_at ? '언락됨' : '진행 대기'}
              </Text>
            </View>
          </View>

          {snapshotSavedAt ? (
            <View style={styles.snapshotBanner}>
                <Ionicons color={colors.brand.primary} name="images-outline" size={18} />
              <View style={styles.snapshotCopy}>
                <Text style={styles.snapshotTitle}>스토리 카드가 저장됐어요</Text>
                <Text style={styles.snapshotDescription}>
                  {formatTimestampLabel(snapshotSavedAt)}에 승인됨
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

        <SoftCard style={styles.tagManageCard} variant="empty">
          <Text style={styles.feedTitle}>그룹 태그 관리</Text>
          <Text style={styles.feedDescription}>
            함께 인증할 루틴을 태그로 나눠두면 홈과 캘린더에서도 같은 흐름으로 정리됩니다.
          </Text>
          <View style={styles.tagCreator}>
            <Text style={styles.inputLabel}>새 그룹 태그</Text>
            <TextInput
              value={newTagLabel}
              onChangeText={setNewTagLabel}
              editable={!isCreatingTag}
              placeholder="예: #운동"
              placeholderTextColor={colors.text.tertiary}
              style={styles.textInput}
              maxLength={24}
              onSubmitEditing={() => void handleCreateGroupTag()}
            />
            <AppButton
              label={isCreatingTag ? '태그 생성 중...' : '태그 추가'}
              onPress={() => void handleCreateGroupTag()}
              disabled={!newTagLabel.trim() || isCreatingTag}
            />
          </View>
          <AppButton
            label={`${selectedTag.tagLabel} 삭제`}
            onPress={handleDeleteSelectedTag}
            variant="secondary"
            disabled={tagEntries.length === 0}
          />
        </SoftCard>

        <View style={styles.tagPicker}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.tagPillRow}>
              {tagEntries.map((entry, entryIndex) => {
                const isSelected = entry.tagId === selectedTag.tagId;

                return (
                  <Pressable
                    key={`${entry.tagId}-${entry.lifeDay}-${entryIndex}`}
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
            멤버가 올린 인증이 이 태그 아래에 모이고, 조건을 채우면 바로 스토리 카드로 저장할 수 있어요.
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
          {selectedTag.members.map((member, memberIndex) => (
            <View key={`${member.memberId}-${selectedTag.tagId}-${memberIndex}`} style={styles.memberGridItem}>
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
                  buildShareRoute(normalizedGroupId, tagEntries[0]?.tagId ?? selectedTag.tagId),
                )
              }
              variant="secondary"
            />
          </SoftCard>
        ) : null}
      </ScrollView>

      {isShareModeVisible ? (
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
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  tagCreator: {
    gap: spacing.sm,
  },
  inputLabel: {
    color: colors.text.secondary,
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
  },
  textInput: {
    backgroundColor: colors.surface.tertiary,
    borderColor: colors.line.soft,
    borderRadius: radius.input,
    borderWidth: 1,
    color: colors.text.primary,
    fontSize: typography.body.fontSize,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  heroCard: {
    backgroundColor: colors.surface.inverse,
    borderColor: colors.brand.accent,
    borderWidth: 2,
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
    color: colors.brand.butter,
    fontSize: 12,
    fontWeight: typography.eyebrow.fontWeight,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.text.inverse,
    fontSize: typography.hero.fontSize,
    fontWeight: typography.hero.fontWeight,
    lineHeight: typography.hero.lineHeight,
  },
  heroDescription: {
    color: '#E8DCEA',
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  heroActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 249, 243, 0.12)',
    borderColor: 'rgba(255, 249, 243, 0.22)',
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
    backgroundColor: colors.brand.butterSoft,
    borderColor: colors.brand.accent,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  lifeDayPillText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: typography.label.fontWeight,
  },
  shareCard: {
    backgroundColor: colors.bg.warm,
    borderColor: colors.line.warm,
    gap: spacing.md,
  },
  tagManageCard: {
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
    backgroundColor: colors.surface.raised,
    borderColor: colors.line.warm,
    borderRadius: radius.input,
    borderWidth: 1,
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
    backgroundColor: colors.brand.butterSoft,
    borderColor: colors.line.warm,
    borderWidth: 1,
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
