import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';

import {
  PaperAvatar,
  PhotoBlock,
  Polaroid,
  Stamp,
  Tape,
  colorForTone,
  paperColors,
  paperFonts,
  paperShadow,
  stripHash,
  toneFromIndex,
  withHash,
} from '@/components/ui/paper-design';
import { StoryShareModal } from '@/features/group/components/story-share-modal';
import { exportStoryShare } from '@/features/group/lib/export-story-share';
import { formatLifeDayLabel, formatTimestampLabel, isArchiveLifeDay } from '@/lib/life-day';
import { trackEvent } from '@/lib/monitoring';
import { addGroupTag } from '@/lib/supabase';
import { useAppSession } from '@/providers/app-session-provider';

import {
  useGroupDetail,
  type GroupMemberWithCert,
  type GroupTagEntry,
} from '../hooks/use-group-detail';

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

function buildCaptureRoute(tagLabel: string) {
  const query = new URLSearchParams();
  const tag = stripHash(tagLabel);

  if (tag) {
    query.set('tag', tag);
  }

  return `/capture?${query.toString()}`;
}

function getCertifiedCount(tagEntry: GroupTagEntry) {
  return tagEntry.members.filter((member) => member.isCertified).length;
}

function getRequiredCount(tagEntry: GroupTagEntry) {
  if ('effective_threshold' in tagEntry.thresholdState && tagEntry.thresholdState.effective_threshold > 0) {
    return tagEntry.thresholdState.effective_threshold;
  }

  return Math.max(1, tagEntry.members.length, getCertifiedCount(tagEntry));
}

function formatMemberTime(member: GroupMemberWithCert) {
  return member.uploadedAt ? formatTimestampLabel(member.uploadedAt) : '방금';
}

export default function GroupDetailScreen() {
  const insets = useSafeAreaInsets();
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
  const requestedTagId = Array.isArray(params.tagId) ? params.tagId[0] : params.tagId;

  const { errorMessage, group, lifeDay, loading, refresh, snapshots, tagEntries } = useGroupDetail(
    normalizedGroupId,
    requestedLifeDay,
  );

  const defaultTagEntry = tagEntries.find((entry) => entry.tagId === requestedTagId) ?? tagEntries[0];

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

  const selectedTag =
    tagEntries.find((entry) => entry.tagId === selectedTagId) ?? defaultTagEntry ?? tagEntries[0];

  const selectedIndex = Math.max(
    0,
    tagEntries.findIndex((entry) => entry.tagId === selectedTag?.tagId),
  );
  const selectedTone = toneFromIndex(selectedIndex);
  const selectedColor = colorForTone(selectedTone);
  const certifiedMembers = selectedTag?.members.filter((member) => member.isCertified) ?? [];
  const selectedSnapshot = selectedTag ? snapshots[selectedTag.tagId] : undefined;

  const isArchiveView = useMemo(() => {
    if (!group || !selectedTag) {
      return false;
    }
    return isArchiveLifeDay(lifeDay, selectedTag.lifeDay);
  }, [group, selectedTag, lifeDay]);

  useEffect(() => {
    if (!selectedTag || !userId) {
      return;
    }

    const unlockKey = `${normalizedGroupId}:${selectedTag.tagId}:${selectedTag.lifeDay}`;
    if (selectedTag.thresholdState.status === 'locked' || trackedUnlockKeys.current.has(unlockKey)) {
      return;
    }

    trackedUnlockKeys.current.add(unlockKey);
    trackEvent('threshold_unlocked', {
      groupId: normalizedGroupId,
      lifeDay: selectedTag.lifeDay,
      tagId: selectedTag.tagId,
      userId,
    });
  }, [selectedTag, normalizedGroupId, userId]);

  useEffect(() => {
    if (requestedShareMode !== '1' || !selectedTag?.shareEnabled) {
      return;
    }

    setShareModeVisible(true);
  }, [requestedShareMode, selectedTag?.shareEnabled]);

  useEffect(() => {
    if (!isShareModeVisible || !selectedTag || !userId) {
      return;
    }

    trackEvent('share_mode_opened', {
      groupId: normalizedGroupId,
      lifeDay: selectedTag.lifeDay,
      tagId: selectedTag.tagId,
      userId,
    });
  }, [isShareModeVisible, selectedTag, normalizedGroupId, userId]);

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

  function goSettings() {
    router.push(`/groups/settings/${normalizedGroupId}`);
  }

  async function handleExport(shareAfterSave: boolean) {
    if (!selectedTag || !group || !viewShotRef.current || !userId) {
      return;
    }

    setExporting(true);
    setShareError(null);

    const result = await exportStoryShare({
      captureTarget: viewShotRef.current,
      exportedBy: userId,
      groupId: normalizedGroupId,
      lifeDay: selectedTag.lifeDay,
      shareAfterSave,
      tagId: selectedTag.tagId,
    });

    setExporting(false);

    if (!result.ok) {
      setShareError(result.message);
      return;
    }

    await refresh();

    Alert.alert(
      '스토리 카드 저장 완료',
      shareAfterSave
        ? '이미지를 저장하고 공유 시트를 열었습니다.'
        : '이미지를 기기 사진 보관함에 저장했습니다.',
    );

    if (!shareAfterSave) {
      setShareModeVisible(false);
    }
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

  if (loading) {
    return (
      <View style={[styles.screen, styles.centerScreen, { paddingTop: insets.top }]}>
        <ActivityIndicator color={paperColors.coral} size="large" />
        <Text style={styles.loadingText}>그룹을 불러오는 중</Text>
      </View>
    );
  }

  if (!group) {
    return (
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingBottom: insets.bottom + 36, paddingTop: insets.top + 12 },
          ]}>
          <View style={styles.topBar}>
            <Pressable accessibilityLabel="뒤로가기" onPress={handleBack} style={styles.backButton}>
              <Ionicons color={paperColors.ink0} name="chevron-back" size={24} />
            </Pressable>
            <Text style={styles.topTitle}>그룹</Text>
            <View style={styles.topSpacer} />
          </View>
          <View style={styles.fallbackCard}>
            <Tape angle={-6} left={26} top={-10} width={72} />
            <Text style={styles.fallbackTitle}>그룹 데이터를 찾지 못했어요</Text>
            <Text style={styles.fallbackDescription}>
              {errorMessage ?? `${normalizedGroupId || '선택한'} 그룹에 접근할 수 없습니다.`}
            </Text>
            <Pressable onPress={() => void refresh()} style={styles.paperButton}>
              <Text style={styles.paperButtonText}>다시 불러오기</Text>
            </Pressable>
            <Pressable onPress={goHome} style={[styles.paperButton, styles.secondaryButton]}>
              <Text style={[styles.paperButtonText, styles.secondaryButtonText]}>홈으로 이동</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (!selectedTag) {
    return (
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingBottom: insets.bottom + 36, paddingTop: insets.top + 12 },
          ]}>
          <View style={styles.topBar}>
            <Pressable accessibilityLabel="뒤로가기" onPress={handleBack} style={styles.backButton}>
              <Ionicons color={paperColors.ink0} name="chevron-back" size={24} />
            </Pressable>
            <Text numberOfLines={1} style={styles.topTitle}>
              {group.name}
            </Text>
            <Pressable accessibilityLabel="그룹 설정" onPress={goSettings} style={styles.settingsButton}>
              <Ionicons color={paperColors.ink0} name="settings-outline" size={20} />
            </Pressable>
          </View>
          <View style={styles.fallbackCard}>
            <Tape angle={-6} left={26} top={-10} width={72} />
            <Text style={styles.fallbackTitle}>첫 태그를 만들어주세요</Text>
            <Text style={styles.fallbackDescription}>
              그룹에서 함께 인증할 태그를 하나 만들면 오늘의 진행판이 바로 열립니다.
            </Text>
            <View style={styles.tagCreator}>
              <TextInput
                editable={!isCreatingTag}
                maxLength={24}
                onChangeText={setNewTagLabel}
                onSubmitEditing={() => void handleCreateGroupTag()}
                placeholder="#운동"
                placeholderTextColor={paperColors.ink3}
                style={styles.textInput}
                value={newTagLabel}
              />
              <Pressable
                disabled={!newTagLabel.trim() || isCreatingTag}
                onPress={() => void handleCreateGroupTag()}
                style={[styles.paperButton, (!newTagLabel.trim() || isCreatingTag) && styles.disabledButton]}>
                <Text style={styles.paperButtonText}>
                  {isCreatingTag ? '만드는 중...' : '태그 만들기'}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  const requiredCount = getRequiredCount(selectedTag);
  const certifiedCount = getCertifiedCount(selectedTag);
  const heroTitle = selectedTag.shareEnabled
    ? '같이 달성!'
    : `${Math.max(0, requiredCount - certifiedCount)}명 더 하면 돼`;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: insets.bottom + 42, paddingTop: insets.top + 2 },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable accessibilityLabel="뒤로가기" onPress={handleBack} style={styles.backButton}>
            <Ionicons color={paperColors.ink0} name="chevron-back" size={24} />
          </Pressable>
          <Text numberOfLines={1} style={styles.topTitle}>
            {withHash(selectedTag.tagLabel)}
          </Text>
          <View style={styles.topRightActions}>
            <View style={styles.avatarStack}>
              {selectedTag.members.slice(0, 4).map((member, index) => (
                <PaperAvatar
                  key={member.memberId}
                  label={member.displayName}
                  size={28}
                  style={{ marginLeft: index ? -8 : 0 }}
                  tone={toneFromIndex(index)}
                />
              ))}
            </View>
            <Pressable
              accessibilityLabel="그룹 채팅"
              onPress={() => router.push(`/groups/chat/${normalizedGroupId}`)}
              style={styles.settingsButton}>
              <Ionicons color={paperColors.ink0} name="chatbubble-ellipses-outline" size={19} />
            </Pressable>
            <Pressable
              accessibilityLabel="공유하기"
              disabled={!selectedTag.shareEnabled}
              onPress={() => {
                setShareError(null);
                setShareModeVisible(true);
              }}
              style={[
                styles.settingsButton,
                styles.shareTopButton,
                !selectedTag.shareEnabled ? styles.actionButtonDisabled : undefined,
              ]}>
              <Ionicons
                color={selectedTag.shareEnabled ? paperColors.ink0 : paperColors.ink3}
                name="share-social-outline"
                size={19}
              />
            </Pressable>
            <Pressable accessibilityLabel="그룹 설정" onPress={goSettings} style={styles.settingsButton}>
              <Ionicons color={paperColors.ink0} name="settings-outline" size={20} />
            </Pressable>
          </View>
        </View>

        <View style={styles.tagRailWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.tagRail}>
              {tagEntries.map((entry, entryIndex) => {
                const active = entry.tagId === selectedTag.tagId;
                const done = entry.shareEnabled;
                const tone = toneFromIndex(entryIndex);
                const toneColor = colorForTone(tone);

                return (
                  <Pressable
                    accessibilityLabel={`${entry.tagLabel} 태그 선택`}
                    accessibilityRole="button"
                    key={`${entry.tagId}-${entry.lifeDay}`}
                    onPress={() => setSelectedTagId(entry.tagId)}
                    style={[
                      styles.chapterCard,
                      {
                        backgroundColor: active ? toneColor : paperColors.card,
                        transform: [{ rotate: active ? '-1deg' : '0deg' }],
                      },
                    ]}>
                    <Text numberOfLines={1} style={styles.chapterTitle}>
                      {withHash(entry.tagLabel)}
                    </Text>
                    <View style={styles.chapterCountRow}>
                      <Text style={styles.chapterCount}>{getCertifiedCount(entry)}</Text>
                      <Text style={styles.chapterNeed}>/ {getRequiredCount(entry)}</Text>
                    </View>
                    {done ? <Stamp size={38} style={styles.chapterStamp} text="갓생" /> : null}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>

        <View style={[styles.currentHero, { backgroundColor: selectedColor }]}>
          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>오늘 {withHash(selectedTag.tagLabel)}</Text>
              <Text style={styles.heroTitle}>{heroTitle}</Text>
              <Text style={styles.heroSubtitle}>{formatLifeDayLabel(selectedTag.lifeDay)}</Text>
            </View>
            <Text style={styles.heroCounter}>
              {certifiedCount}
              <Text style={styles.heroCounterSmall}>/{requiredCount}</Text>
            </Text>
          </View>

          <View style={styles.memberDots}>
            {selectedTag.members.map((member, index) => (
              <View key={member.memberId} style={styles.memberDotCell}>
                <View
                  style={[
                    styles.memberDot,
                    {
                      backgroundColor: member.isCertified
                        ? paperColors.card
                        : 'rgba(253,251,245,0.38)',
                      opacity: member.isCertified ? 1 : 0.55,
                    },
                  ]}>
                  <Text style={styles.memberDotText}>{stripHash(member.displayName)[0] ?? '?'}</Text>
                  {member.isCertified ? <Text style={styles.memberCheck}>✓</Text> : null}
                </View>
                <Text numberOfLines={1} style={styles.memberName}>
                  {member.displayName}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.heroActions}>
            <Pressable
              accessibilityLabel={`${withHash(selectedTag.tagLabel)} 인증하기`}
              accessibilityRole="button"
              onPress={() => router.push(buildCaptureRoute(selectedTag.tagLabel))}
              style={styles.verifyButton}>
              <Ionicons color={paperColors.card} name="camera-outline" size={18} />
              <Text style={styles.verifyButtonText}>인증하기</Text>
            </Pressable>
            {selectedSnapshot?.last_snapshot_exported_at ? (
              <Text style={styles.storyInlineMeta}>
                저장됨 · {formatTimestampLabel(selectedSnapshot.last_snapshot_exported_at)}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.feedSectionTitle}>
          <Text style={styles.feedTitle}>
            {certifiedMembers.length}개의 인증 · {withHash(selectedTag.tagLabel)}
          </Text>
        </View>

        <View style={styles.polaroidFeed}>
          {certifiedMembers.length > 0 ? (
            certifiedMembers.map((member, index) => {
              const tilt = (index % 2 === 0 ? -1 : 1) * (1.5 + (index % 3) * 0.6);

              return (
                <View
                  key={`${member.memberId}-${selectedTag.tagId}`}
                  style={[
                    styles.feedPolaroidWrap,
                    {
                      marginLeft: index % 2 === 0 ? 0 : 24,
                      marginRight: index % 2 === 0 ? 24 : 0,
                      transform: [{ rotate: `${tilt}deg` }],
                    },
                  ]}>
                  <Tape angle={-tilt * 3} left={30} top={-10} width={60} />
                  <Polaroid
                    caption={`${member.displayName} · ${formatMemberTime(member)}`}
                    tone={toneFromIndex(index)}
                    width={260}>
                    <PhotoBlock
                      height={180}
                      tone={toneFromIndex(index)}
                      uri={member.imageUrl}
                      width="100%"
                    />
                  </Polaroid>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyFeed}>
              <Tape angle={-7} left={28} top={-10} width={64} />
              <Text style={styles.emptyFeedTitle}>아직 붙일 사진이 없어</Text>
              <Text style={styles.emptyFeedText}>
                멤버가 인증을 올리면 이 태그 아래에 폴라로이드처럼 모여요.
              </Text>
            </View>
          )}
        </View>

        {isArchiveView ? (
          <View style={styles.manageCard}>
            <Text style={styles.manageTitle}>아카이브 보기</Text>
            <Text style={styles.manageDescription}>
              {selectedTag.lifeDay} 생활일의 멤버 구성과 인증 상태로 고정된 화면입니다.
            </Text>
            <Pressable
              onPress={() =>
                router.replace(buildShareRoute(normalizedGroupId, tagEntries[0]?.tagId ?? selectedTag.tagId))
              }
              style={styles.paperButton}>
              <Text style={styles.paperButtonText}>현재 생활일로 돌아가기</Text>
            </Pressable>
          </View>
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
  avatarStack: {
    flexDirection: 'row',
    minWidth: 58,
  },
  backButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  actionButtonDisabled: {
    backgroundColor: 'rgba(27,26,23,0.08)',
    borderColor: 'rgba(27,26,23,0.2)',
    opacity: 0.55,
  },
  centerScreen: {
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
  },
  chapterCard: {
    borderColor: paperColors.ink0,
    borderRadius: 14,
    borderWidth: 1.5,
    minWidth: 96,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: 'relative',
  },
  chapterCount: {
    color: paperColors.ink0,
    fontFamily: paperFonts.pen,
    fontSize: 24,
    lineHeight: 28,
  },
  chapterCountRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 3,
    marginTop: 3,
  },
  chapterNeed: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 11,
    lineHeight: 15,
  },
  chapterStamp: {
    position: 'absolute',
    right: -6,
    top: -8,
  },
  chapterTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 15,
    lineHeight: 19,
  },
  container: {
    gap: 14,
    paddingHorizontal: 16,
  },
  currentHero: {
    borderColor: paperColors.ink0,
    borderRadius: 18,
    borderWidth: 1.5,
    gap: 14,
    overflow: 'hidden',
    padding: 16,
    position: 'relative',
  },
  disabledButton: {
    opacity: 0.45,
  },
  emptyFeed: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 6,
    borderWidth: 1.5,
    gap: 7,
    padding: 16,
    position: 'relative',
    ...paperShadow,
  },
  emptyFeedText: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyFeedTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 20,
    lineHeight: 25,
  },
  fallbackCard: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 6,
    borderWidth: 1.5,
    gap: 12,
    padding: 18,
    position: 'relative',
    ...paperShadow,
  },
  fallbackDescription: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 15,
    lineHeight: 22,
  },
  fallbackTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 22,
    lineHeight: 28,
  },
  feedPolaroidWrap: {
    alignSelf: 'center',
    position: 'relative',
  },
  feedSectionTitle: {
    paddingHorizontal: 2,
  },
  feedTitle: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    letterSpacing: 0.8,
    lineHeight: 17,
    textTransform: 'uppercase',
  },
  heroCopy: {
    flex: 1,
  },
  heroCounter: {
    color: paperColors.ink0,
    fontFamily: paperFonts.pen,
    fontSize: 44,
    lineHeight: 50,
  },
  heroCounterSmall: {
    fontSize: 23,
  },
  heroEyebrow: {
    color: paperColors.ink1,
    fontFamily: paperFonts.handBold,
    fontSize: 11,
    letterSpacing: 1,
    lineHeight: 15,
    textTransform: 'uppercase',
  },
  heroSubtitle: {
    color: paperColors.ink1,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  heroTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 27,
    lineHeight: 33,
    marginTop: 2,
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  heroActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  loadingText: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 15,
  },
  manageCard: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 6,
    borderWidth: 1.5,
    gap: 10,
    marginTop: 6,
    padding: 16,
    position: 'relative',
    ...paperShadow,
  },
  manageDescription: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 14,
    lineHeight: 20,
  },
  manageTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 20,
    lineHeight: 25,
  },
  memberCheck: {
    bottom: -7,
    color: paperColors.coral,
    fontFamily: paperFonts.pen,
    fontSize: 21,
    lineHeight: 24,
    position: 'absolute',
    right: -5,
    transform: [{ rotate: '-10deg' }],
  },
  memberDot: {
    alignItems: 'center',
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.5,
    height: 44,
    justifyContent: 'center',
    position: 'relative',
    width: 44,
  },
  memberDotCell: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
  },
  memberDotText: {
    color: paperColors.ink0,
    fontFamily: paperFonts.pen,
    fontSize: 21,
    lineHeight: 24,
  },
  memberDots: {
    flexDirection: 'row',
    gap: 10,
  },
  memberName: {
    color: paperColors.ink1,
    fontFamily: paperFonts.handBold,
    fontSize: 10,
    lineHeight: 14,
    maxWidth: 58,
  },
  paperButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: paperColors.ink0,
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.3,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  paperButtonText: {
    color: paperColors.card,
    fontFamily: paperFonts.handBold,
    fontSize: 13,
    lineHeight: 17,
  },
  polaroidFeed: {
    gap: 22,
    paddingTop: 6,
  },
  screen: {
    backgroundColor: paperColors.paper0,
    flex: 1,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    color: paperColors.ink0,
  },
  settingsButton: {
    alignItems: 'center',
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.3,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  shareTopButton: {
    backgroundColor: paperColors.card,
  },
  storyInlineMeta: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 11,
    lineHeight: 15,
  },
  tagCreator: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tagRail: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  tagRailWrap: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  textInput: {
    backgroundColor: paperColors.paper1,
    borderColor: paperColors.ink0,
    borderRadius: 12,
    borderWidth: 1.2,
    color: paperColors.ink0,
    flex: 1,
    fontFamily: paperFonts.handBold,
    fontSize: 15,
    minWidth: 150,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 38,
  },
  topRightActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  topSpacer: {
    width: 34,
  },
  topTitle: {
    color: paperColors.ink0,
    flex: 1,
    fontFamily: paperFonts.pen,
    fontSize: 25,
    lineHeight: 31,
  },
  verifyButton: {
    alignItems: 'center',
    backgroundColor: paperColors.ink0,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  verifyButtonText: {
    color: paperColors.card,
    fontFamily: paperFonts.handBold,
    fontSize: 13,
    lineHeight: 17,
  },
});
