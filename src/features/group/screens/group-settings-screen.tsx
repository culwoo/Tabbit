import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  PaperAvatar,
  Tape,
  paperColors,
  paperFonts,
  paperShadow,
  toneFromIndex,
  withHash,
} from '@/components/ui/paper-design';
import { resolveEffectiveThreshold } from '@/lib/domain';
import type { GroupRow, GroupTagRow } from '@/lib/supabase';
import {
  addGroupTag,
  deleteGroupTag,
  fetchGroup,
  fetchGroupMembers,
  fetchGroupTags,
  leaveGroup,
  updateGroupThresholdRule,
} from '@/lib/supabase';
import { useAppSession } from '@/providers/app-session-provider';

type GroupMember = Awaited<ReturnType<typeof fetchGroupMembers>>[number];
type ThresholdOption = GroupRow['threshold_rule'];

function getMinimumThresholdCount(memberCount: number) {
  if (memberCount <= 0) {
    return 0;
  }

  if (memberCount <= 2) {
    return memberCount;
  }

  return Math.max(1, memberCount - 2);
}

function thresholdCountToRule(memberCount: number, thresholdCount: number): ThresholdOption {
  if (memberCount <= 2 || thresholdCount >= memberCount) {
    return 'ALL';
  }

  if (thresholdCount >= memberCount - 1) {
    return 'N_MINUS_1';
  }

  return 'N_MINUS_2';
}

function readUserFromMember(member: GroupMember) {
  return member.users as unknown as {
    id: string;
    display_name: string;
    handle: string | null;
    avatar_url: string | null;
  };
}

export default function GroupSettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { userId } = useAppSession();
  const params = useLocalSearchParams<{ groupId: string }>();
  const groupId = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId ?? '';

  const [group, setGroup] = useState<GroupRow | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [tags, setTags] = useState<GroupTagRow[]>([]);
  const [newTagLabel, setNewTagLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const memberCount = members.length;
  const smallGroup = memberCount <= 2;
  const currentMember = useMemo(
    () => members.find((member) => readUserFromMember(member).id === userId),
    [members, userId],
  );
  const isOwner = group?.created_by === userId || currentMember?.role === 'owner';
  const minThresholdCount = getMinimumThresholdCount(memberCount);
  const maxThresholdCount = Math.max(0, memberCount);
  const rawThresholdCount = group ? resolveEffectiveThreshold(group.threshold_rule, memberCount) : maxThresholdCount;
  const currentThresholdCount = Math.min(
    maxThresholdCount,
    Math.max(minThresholdCount, rawThresholdCount || maxThresholdCount),
  );
  const canDecreaseThreshold =
    Boolean(group) && isOwner && !busyKey && !smallGroup && currentThresholdCount > minThresholdCount;
  const canIncreaseThreshold =
    Boolean(group) && isOwner && !busyKey && !smallGroup && currentThresholdCount < maxThresholdCount;

  const loadData = useCallback(async () => {
    if (!groupId) {
      setErrorMessage('그룹 경로가 올바르지 않습니다.');
      setLoading(false);
      return;
    }

    try {
      setLoading(!hasLoadedRef.current);
      setErrorMessage(null);
      const [groupData, memberData, tagData] = await Promise.all([
        fetchGroup(groupId),
        fetchGroupMembers(groupId),
        fetchGroupTags(groupId),
      ]);

      setGroup(groupData);
      setMembers(memberData);
      setTags(tagData);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '그룹 설정을 불러오지 못했습니다.');
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
    }
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  function handleBack() {
    if (navigation.canGoBack()) {
      router.back();
      return;
    }

    router.replace(groupId ? `/groups/${groupId}` : '/');
  }

  async function handleThresholdCountChange(nextCount: number) {
    if (!group || busyKey || !isOwner) {
      return;
    }

    if (smallGroup) {
      Alert.alert('지금은 모두 인증만 가능해요', '1-2명 그룹은 모두 인증이 기준입니다.');
      return;
    }

    const clampedCount = Math.min(maxThresholdCount, Math.max(minThresholdCount, nextCount));
    const nextRule = thresholdCountToRule(memberCount, clampedCount);

    if (nextRule === group.threshold_rule) {
      return;
    }

    setBusyKey(`threshold-${nextRule}`);

    try {
      const updatedGroup = await updateGroupThresholdRule(group.id, nextRule);
      setGroup(updatedGroup);
    } catch (error) {
      Alert.alert(
        '기준을 바꾸지 못했어요',
        error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.',
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function handleAddTag() {
    const label = newTagLabel.trim();

    if (!group || !label || busyKey) {
      return;
    }

    Keyboard.dismiss();
    setBusyKey('add-tag');

    try {
      const tag = await addGroupTag(group.id, label, userId ?? undefined);
      setTags((items) => [...items, tag]);
      setNewTagLabel('');
    } catch (error) {
      Alert.alert(
        '태그를 만들지 못했어요',
        error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.',
      );
    } finally {
      setBusyKey(null);
    }
  }

  function handleDeleteTag(tag: GroupTagRow) {
    if (!group || busyKey) {
      return;
    }

    Alert.alert(`${withHash(tag.label)} 태그를 지울까요?`, '이미 인증에 쓰인 기록은 그대로 남습니다.', [
      { style: 'cancel', text: '취소' },
      {
        onPress: async () => {
          setBusyKey(`tag-${tag.id}`);

          try {
            await deleteGroupTag(group.id, tag.id);
            setTags((items) => items.filter((item) => item.id !== tag.id));
          } catch (error) {
            Alert.alert(
              '태그를 지우지 못했어요',
              error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.',
            );
          } finally {
            setBusyKey(null);
          }
        },
        style: 'destructive',
        text: '삭제',
      },
    ]);
  }

  async function handleShareInvite() {
    if (!group?.invite_code) {
      return;
    }

    await Share.share({
      message: `Tabbit 초대 코드: ${group.invite_code}`,
    });
  }

  function handleLeaveGroup() {
    if (!group || !userId || busyKey) {
      return;
    }

    Alert.alert('그룹을 나갈까요?', '나가도 내가 올린 인증 기록은 보관됩니다.', [
      { style: 'cancel', text: '취소' },
      {
        onPress: async () => {
          setBusyKey('leave-group');

          try {
            await leaveGroup(group.id, userId);
            router.replace('/');
          } catch (error) {
            Alert.alert(
              '그룹을 나가지 못했어요',
              error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.',
            );
            setBusyKey(null);
          }
        },
        style: 'destructive',
        text: '나가기',
      },
    ]);
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.centerScreen, { paddingTop: insets.top }]}>
        <ActivityIndicator color={paperColors.coral} size="large" />
        <Text style={styles.loadingText}>설정을 꺼내는 중</Text>
      </View>
    );
  }

  if (!group) {
    return (
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingBottom: insets.bottom + 34, paddingTop: insets.top + 12 },
          ]}>
          <View style={styles.topBar}>
            <Pressable accessibilityLabel="뒤로가기" onPress={handleBack} style={styles.iconButton}>
              <Ionicons color={paperColors.ink0} name="chevron-back" size={24} />
            </Pressable>
            <Text style={styles.topTitle}>그룹 설정</Text>
            <View style={styles.topSpacer} />
          </View>
          <View style={styles.noticeCard}>
            <Tape angle={-6} left={28} top={-10} width={74} />
            <Text style={styles.cardTitle}>설정을 찾지 못했어요</Text>
            <Text style={styles.bodyText}>{errorMessage ?? '그룹 정보를 다시 불러와야 합니다.'}</Text>
            <Pressable onPress={() => void loadData()} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>다시 불러오기</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: insets.bottom + 40, paddingTop: insets.top + 8 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable accessibilityLabel="뒤로가기" onPress={handleBack} style={styles.iconButton}>
            <Ionicons color={paperColors.ink0} name="chevron-back" size={24} />
          </Pressable>
          <Text numberOfLines={1} style={styles.topTitle}>
            그룹 설정
          </Text>
          <View style={styles.topSpacer} />
        </View>

        <View style={styles.heroCard}>
          <Tape angle={5} right={34} top={-9} width={78} />
          <Text numberOfLines={1} style={styles.heroTitle}>
            {group.name}
          </Text>
          {group.description ? <Text style={styles.bodyText}>{group.description}</Text> : null}
          <View style={styles.codeRow}>
            <View>
              <Text style={styles.metaLabel}>초대 코드</Text>
              <Text selectable style={styles.inviteCode}>
                {group.invite_code}
              </Text>
            </View>
            <Pressable onPress={() => void handleShareInvite()} style={styles.lightButton}>
              <Ionicons color={paperColors.ink0} name="share-outline" size={17} />
              <Text style={styles.lightButtonText}>공유</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>인증 기준</Text>
          {smallGroup ? (
            <Text style={styles.sectionHint}>1-2명 그룹은 모두 인증이 기준이에요.</Text>
          ) : null}
          {!isOwner ? <Text style={styles.sectionHint}>그룹장만 기준을 바꿀 수 있어요.</Text> : null}
          <View style={styles.thresholdStepper}>
            <Pressable
              accessibilityLabel="인증 기준 낮추기"
              disabled={!canDecreaseThreshold}
              onPress={() => void handleThresholdCountChange(currentThresholdCount - 1)}
              style={[styles.stepperButton, !canDecreaseThreshold ? styles.stepperButtonDisabled : undefined]}>
              <Ionicons
                color={canDecreaseThreshold ? paperColors.ink0 : paperColors.ink3}
                name="chevron-back"
                size={24}
              />
            </Pressable>
            <View style={styles.thresholdReadout}>
              <Text style={styles.thresholdValue}>({currentThresholdCount})명</Text>
              <Text style={styles.thresholdCaption}>
                {memberCount > 0 ? `${memberCount}명 중 ${currentThresholdCount}명 인증` : '멤버가 아직 없어요'}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="인증 기준 높이기"
              disabled={!canIncreaseThreshold}
              onPress={() => void handleThresholdCountChange(currentThresholdCount + 1)}
              style={[styles.stepperButton, !canIncreaseThreshold ? styles.stepperButtonDisabled : undefined]}>
              <Ionicons
                color={canIncreaseThreshold ? paperColors.ink0 : paperColors.ink3}
                name="chevron-forward"
                size={24}
              />
            </Pressable>
            {busyKey?.startsWith('threshold-') ? (
              <ActivityIndicator color={paperColors.ink0} style={styles.thresholdBusy} />
            ) : null}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Tape angle={-6} left={24} top={-10} width={70} />
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>태그 관리</Text>
            <Text style={styles.metaLabel}>{tags.length}개</Text>
          </View>
          <View style={styles.tagInputRow}>
            <TextInput
              editable={!busyKey}
              maxLength={24}
              onChangeText={setNewTagLabel}
              onSubmitEditing={() => void handleAddTag()}
              placeholder="#무지출"
              placeholderTextColor={paperColors.ink3}
              style={styles.textInput}
              value={newTagLabel}
            />
            <Pressable
              disabled={!newTagLabel.trim() || Boolean(busyKey)}
              onPress={() => void handleAddTag()}
              style={[styles.smallDarkButton, (!newTagLabel.trim() || Boolean(busyKey)) && styles.disabledButton]}>
              {busyKey === 'add-tag' ? <ActivityIndicator color={paperColors.card} /> : null}
              <Text style={styles.smallDarkButtonText}>추가</Text>
            </Pressable>
          </View>
          <View style={styles.tagList}>
            {tags.length > 0 ? (
              tags.map((tag, index) => (
                <View
                  key={tag.id}
                  style={[styles.tagPill, { backgroundColor: paperColors[toneFromIndex(index)] }]}>
                  <Text numberOfLines={1} style={styles.tagText}>
                    {withHash(tag.label)}
                  </Text>
                  <Pressable
                    accessibilityLabel={`${withHash(tag.label)} 삭제`}
                    disabled={Boolean(busyKey)}
                    onPress={() => handleDeleteTag(tag)}
                    style={styles.tagDeleteButton}>
                    {busyKey === `tag-${tag.id}` ? (
                      <ActivityIndicator color={paperColors.ink0} size="small" />
                    ) : (
                      <Ionicons color={paperColors.ink1} name="close" size={16} />
                    )}
                  </Pressable>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>아직 태그가 없어요.</Text>
            )}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Tape angle={7} right={28} top={-10} width={70} />
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>멤버</Text>
            <Text style={styles.metaLabel}>{memberCount}명</Text>
          </View>
          <View style={styles.memberList}>
            {members.map((member, index) => {
              const user = readUserFromMember(member);

              return (
                <View key={member.id} style={styles.memberRow}>
                  <PaperAvatar label={user.display_name} size={38} tone={toneFromIndex(index)} />
                  <View style={styles.memberCopy}>
                    <Text numberOfLines={1} style={styles.memberName}>
                      {user.display_name}
                    </Text>
                    <Text style={styles.memberHandle}>{user.handle ?? '@user'}</Text>
                  </View>
                  {member.role === 'owner' ? <Text style={styles.ownerBadge}>그룹장</Text> : null}
                </View>
              );
            })}
          </View>
          <Pressable onPress={() => void handleShareInvite()} style={styles.inviteButton}>
            <Ionicons color={paperColors.ink0} name="person-add-outline" size={18} />
            <Text style={styles.inviteButtonText}>초대 코드 공유</Text>
          </Pressable>
        </View>

        <View style={styles.dangerZone}>
          <View style={styles.dangerCopy}>
            <Ionicons color={paperColors.coral} name="warning-outline" size={19} />
            <View style={styles.dangerTextBlock}>
              <Text style={styles.dangerTitle}>그룹 나가기</Text>
              <Text style={styles.dangerText}>나가면 이 그룹의 새 인증에는 참여하지 않게 됩니다.</Text>
            </View>
          </View>
          <Pressable
            disabled={busyKey === 'leave-group'}
            onPress={handleLeaveGroup}
            style={[styles.leaveButton, busyKey === 'leave-group' && styles.disabledButton]}>
            {busyKey === 'leave-group' ? <ActivityIndicator color={paperColors.coral} /> : null}
            <Text style={styles.leaveButtonText}>나가기</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bodyText: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 14,
    lineHeight: 20,
  },
  cardTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 20,
    lineHeight: 25,
  },
  centerScreen: {
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
  },
  codeRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(253,251,245,0.7)',
    borderColor: paperColors.ink0,
    borderRadius: 14,
    borderWidth: 1.3,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 14,
    padding: 12,
  },
  container: {
    gap: 15,
    paddingHorizontal: 16,
  },
  dangerCard: {
    backgroundColor: paperColors.peach,
    borderColor: paperColors.ink0,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 9,
    padding: 16,
  },
  dangerCopy: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 9,
  },
  dangerText: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 13,
    lineHeight: 19,
  },
  dangerTextBlock: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  dangerTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 16,
    lineHeight: 21,
  },
  dangerZone: {
    backgroundColor: paperColors.peach,
    borderColor: paperColors.ink0,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 13,
    padding: 16,
    ...paperShadow,
  },
  disabledButton: {
    opacity: 0.45,
  },
  disabledCard: {
    opacity: 0.48,
  },
  emptyText: {
    color: paperColors.ink3,
    fontFamily: paperFonts.pen,
    fontSize: 20,
    lineHeight: 25,
  },
  heroCard: {
    backgroundColor: paperColors.sage,
    borderColor: paperColors.ink0,
    borderRadius: 8,
    borderWidth: 1.5,
    padding: 17,
    position: 'relative',
    ...paperShadow,
  },
  heroTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 26,
    lineHeight: 32,
  },
  iconButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  inviteButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.3,
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  inviteButtonText: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 13,
    lineHeight: 17,
  },
  inviteCode: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 17,
    lineHeight: 22,
    marginTop: 2,
  },
  leaveButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: paperColors.ink0,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  leaveButtonText: {
    color: paperColors.card,
    fontFamily: paperFonts.handBold,
    fontSize: 13,
    lineHeight: 17,
  },
  lightButton: {
    alignItems: 'center',
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.2,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  lightButtonText: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 16,
  },
  loadingText: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 15,
    lineHeight: 20,
  },
  memberCopy: {
    flex: 1,
    minWidth: 0,
  },
  memberHandle: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 1,
  },
  memberList: {
    gap: 10,
  },
  memberName: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 15,
    lineHeight: 20,
  },
  memberRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  metaLabel: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 11,
    lineHeight: 15,
  },
  noticeCard: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 10,
    padding: 16,
    position: 'relative',
    ...paperShadow,
  },
  ownerBadge: {
    backgroundColor: paperColors.butter,
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.1,
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 11,
    lineHeight: 15,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: paperColors.ink0,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  primaryButtonText: {
    color: paperColors.card,
    fontFamily: paperFonts.handBold,
    fontSize: 13,
    lineHeight: 17,
  },
  screen: {
    backgroundColor: paperColors.paper0,
    flex: 1,
  },
  section: {
    gap: 8,
  },
  sectionCard: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 12,
    padding: 16,
    position: 'relative',
    ...paperShadow,
  },
  sectionHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionHint: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 17,
  },
  sectionTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 20,
    lineHeight: 25,
  },
  smallDarkButton: {
    alignItems: 'center',
    backgroundColor: paperColors.ink0,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    minHeight: 42,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  smallDarkButtonText: {
    color: paperColors.card,
    fontFamily: paperFonts.handBold,
    fontSize: 13,
    lineHeight: 17,
  },
  tagDeleteButton: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  tagInputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPill: {
    alignItems: 'center',
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.2,
    flexDirection: 'row',
    gap: 4,
    paddingLeft: 11,
    paddingRight: 4,
    paddingVertical: 4,
  },
  tagText: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 13,
    lineHeight: 17,
    maxWidth: 150,
  },
  textInput: {
    backgroundColor: paperColors.paper1,
    borderColor: paperColors.ink0,
    borderRadius: 13,
    borderWidth: 1.3,
    color: paperColors.ink0,
    flex: 1,
    fontFamily: paperFonts.handBold,
    fontSize: 15,
    lineHeight: 20,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  stepperButton: {
    alignItems: 'center',
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.4,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  stepperButtonDisabled: {
    backgroundColor: 'rgba(27,26,23,0.05)',
    borderColor: 'rgba(27,26,23,0.14)',
  },
  thresholdBusy: {
    marginLeft: 4,
  },
  thresholdCaption: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 17,
  },
  thresholdReadout: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  thresholdStepper: {
    alignItems: 'center',
    backgroundColor: paperColors.butter,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  thresholdValue: {
    color: paperColors.ink0,
    fontFamily: paperFonts.pen,
    fontSize: 34,
    lineHeight: 38,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 40,
  },
  topSpacer: {
    width: 36,
  },
  topTitle: {
    color: paperColors.ink0,
    flex: 1,
    fontFamily: paperFonts.pen,
    fontSize: 25,
    lineHeight: 31,
    textAlign: 'center',
  },
});
