import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  PhotoBlock,
  Polaroid,
  Tape,
  paperColors,
  paperFonts,
  paperShadow,
  toneFromIndex,
  withHash,
} from '@/components/ui/paper-design';
import { formatLifeDayLabel, formatTimestampLabel } from '@/lib/life-day';
import {
  addPersonalTag,
  fetchMyPersonalCertificationRecords,
  syncGroupTagsToPersonalTags,
  type PersonalCertificationRecord,
  type PersonalTagRow,
} from '@/lib/supabase';
import { useAppSession } from '@/providers/app-session-provider';
import { useFontPreference } from '@/providers/font-preference-provider';

export default function PersonalSpaceScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { userId } = useAppSession();
  const { bodyTextStyle, strongTextStyle } = useFontPreference();
  const [tags, setTags] = useState<PersonalTagRow[]>([]);
  const [records, setRecords] = useState<PersonalCertificationRecord[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newTagLabel, setNewTagLabel] = useState('');
  const [creatingTag, setCreatingTag] = useState(false);
  const [tagCreateError, setTagCreateError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!userId) {
      setTags([]);
      setRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const [syncedTags, personalRecords] = await Promise.all([
        syncGroupTagsToPersonalTags(userId),
        fetchMyPersonalCertificationRecords(userId, { limit: 80 }),
      ]);

      setTags(syncedTags);
      setRecords(personalRecords);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '개인공간 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

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

    router.replace('/');
  }

  async function handleCreateTag() {
    const label = newTagLabel.trim();

    if (!label || !userId || creatingTag) {
      return;
    }

    setCreatingTag(true);
    setTagCreateError(null);

    try {
      const tag = await addPersonalTag(userId, label);

      setTags((currentTags) => {
        const withoutDuplicate = currentTags.filter((currentTag) => currentTag.id !== tag.id);

        return [...withoutDuplicate, tag].sort((left, right) =>
          left.label.localeCompare(right.label, 'ko'),
        );
      });
      setSelectedTagId(tag.id);
      setNewTagLabel('');
    } catch (error) {
      setTagCreateError(error instanceof Error ? error.message : '개인공간 태그를 만들지 못했습니다.');
    } finally {
      setCreatingTag(false);
    }
  }

  const filteredRecords = useMemo(
    () =>
      selectedTagId
        ? records.filter((record) => record.shareTarget.personal_tag_ids.includes(selectedTagId))
        : records,
    [records, selectedTagId],
  );
  const selectedTag = selectedTagId ? tags.find((tag) => tag.id === selectedTagId) : null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: insets.bottom + 34, paddingTop: insets.top + 8 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable accessibilityLabel="뒤로가기" onPress={handleBack} style={styles.iconButton}>
            <Ionicons color={paperColors.ink0} name="chevron-back" size={24} />
          </Pressable>
          <Text style={styles.topTitle}>개인공간</Text>
          <View style={styles.iconButton} />
        </View>

        <View style={styles.heroCard}>
          <Tape angle={-6} left={30} top={-10} width={74} />
          <View style={styles.heroCopy}>
            <Text style={styles.heroNote}>나만의 기록첩</Text>
            <Text style={[styles.heroTitle, strongTextStyle]}>조용히 쌓는 인증</Text>
            <Text style={[styles.heroBody, bodyTextStyle]}>
              그룹에 올리지 않은 사진과 짧은 메모를 나만의 태그로 붙여둬요.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={paperColors.coral} />
            <Text style={[styles.stateText, bodyTextStyle]}>기록을 정리하는 중</Text>
          </View>
        ) : null}

        {!loading && errorMessage ? (
          <View style={styles.stateCard}>
            <Text selectable style={[styles.stateText, bodyTextStyle]}>{errorMessage}</Text>
            <Pressable onPress={() => void loadData()} style={styles.darkButton}>
              <Text style={[styles.darkButtonText, strongTextStyle]}>다시 불러오기</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !errorMessage ? (
          <>
            <View style={styles.sectionCard}>
              <Tape angle={6} right={28} top={-10} width={72} />
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, strongTextStyle]}>태그</Text>
              </View>
              <View style={styles.tagCreator}>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!creatingTag && Boolean(userId)}
                  maxLength={24}
                  onChangeText={setNewTagLabel}
                  onSubmitEditing={() => void handleCreateTag()}
                  placeholder="#운동"
                  placeholderTextColor={paperColors.ink3}
                  returnKeyType="done"
                  style={[styles.tagInput, strongTextStyle]}
                  value={newTagLabel}
                />
                <Pressable
                  disabled={!newTagLabel.trim() || creatingTag || !userId}
                  onPress={() => void handleCreateTag()}
                  style={[styles.smallDarkButton, (!newTagLabel.trim() || creatingTag || !userId) && styles.disabledButton]}>
                  {creatingTag ? <ActivityIndicator color={paperColors.card} /> : null}
                  <Text style={[styles.smallDarkButtonText, strongTextStyle]}>추가</Text>
                </Pressable>
              </View>
              {tagCreateError ? <Text selectable style={[styles.inlineError, bodyTextStyle]}>{tagCreateError}</Text> : null}
              <View style={styles.tagRow}>
                <Pressable
                  onPress={() => setSelectedTagId(null)}
                  style={[
                    styles.tagChip,
                    !selectedTagId ? styles.tagChipActive : undefined,
                    { backgroundColor: !selectedTagId ? paperColors.butter : paperColors.card },
                  ]}>
                  <Text style={[styles.tagLabel, strongTextStyle]}>전체</Text>
                </Pressable>
                {tags.map((tag, tagIndex) => (
                  <Pressable
                    key={`${tag.id}:${tagIndex}`}
                    onPress={() => setSelectedTagId(tag.id)}
                    style={[
                      styles.tagChip,
                      selectedTagId === tag.id ? styles.tagChipActive : undefined,
                      {
                        backgroundColor:
                          selectedTagId === tag.id ? paperColors[toneFromIndex(tagIndex)] : paperColors.card,
                      },
                    ]}>
                    <Text numberOfLines={1} style={[styles.tagLabel, strongTextStyle]}>
                      {withHash(tag.label)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.feedHeader}>
              <Text style={[styles.feedTitle, strongTextStyle]}>
                {selectedTag ? withHash(selectedTag.label) : '전체'} 기록
              </Text>
            </View>

            {filteredRecords.length === 0 ? (
              <View style={styles.emptyCard}>
                <Tape angle={-7} left={28} top={-10} width={66} />
                <Text style={[styles.emptyTitle, strongTextStyle]}>아직 붙인 사진이 없어</Text>
                <Text style={[styles.emptyText, bodyTextStyle]}>
                  카메라 탭에서 개인 태그를 선택하면 이곳에 조용히 모여요.
                </Text>
              </View>
            ) : (
              <View style={styles.polaroidFeed}>
                {filteredRecords.map((record, index) => {
                  const caption = record.certification.caption || '문구 없음';
                  const personalTags =
                    record.personalTags.map((tag) => withHash(tag.label)).join(' · ') || '개인공간';
                  const tilt = (index % 2 === 0 ? -1 : 1) * (1.2 + (index % 3) * 0.45);

                  return (
                    <View
                      key={`${record.certification.id}:${index}`}
                      style={[
                        styles.polaroidWrap,
                        {
                          marginLeft: index % 2 === 0 ? 0 : 24,
                          marginRight: index % 2 === 0 ? 24 : 0,
                          transform: [{ rotate: `${tilt}deg` }],
                        },
                      ]}>
                      <Tape angle={-tilt * 4} left={32} top={-10} width={62} />
                      <Polaroid
                        caption={formatLifeDayLabel(record.certification.lifestyle_date)}
                        tone={toneFromIndex(index)}
                        width={260}>
                        <PhotoBlock
                          height={180}
                          tone={toneFromIndex(index)}
                          uri={record.certification.image_url}
                          width="100%"
                        />
                      </Polaroid>
                      <View style={styles.photoNote}>
                        <Text numberOfLines={2} style={[styles.photoCaption, strongTextStyle]}>{caption}</Text>
                        <Text numberOfLines={1} style={[styles.photoMeta, bodyTextStyle]}>
                          {personalTags} · {formatTimestampLabel(record.certification.uploaded_at)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 15,
    paddingHorizontal: 16,
  },
  darkButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: paperColors.ink0,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  darkButtonText: {
    color: paperColors.card,
    fontFamily: paperFonts.handBold,
    fontSize: 13,
    lineHeight: 17,
  },
  disabledButton: {
    opacity: 0.45,
  },
  emptyCard: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 7,
    padding: 16,
    position: 'relative',
    ...paperShadow,
  },
  emptyText: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 20,
    lineHeight: 25,
  },
  feedHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  feedTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 21,
    lineHeight: 26,
  },
  heroBody: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  heroCard: {
    backgroundColor: paperColors.sage,
    borderColor: paperColors.ink0,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 14,
    padding: 17,
    position: 'relative',
    ...paperShadow,
  },
  heroCopy: {
    paddingRight: 18,
  },
  heroNote: {
    color: paperColors.ink2,
    fontFamily: paperFonts.pen,
    fontSize: 22,
    lineHeight: 27,
  },
  heroTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 29,
    lineHeight: 35,
  },
  iconButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  inlineError: {
    color: paperColors.coral,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 17,
  },
  photoCaption: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 14,
    lineHeight: 19,
  },
  photoMeta: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  photoNote: {
    backgroundColor: 'rgba(253,251,245,0.92)',
    borderColor: 'rgba(27,26,23,0.08)',
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 12,
    marginTop: -8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  polaroidFeed: {
    gap: 24,
    paddingTop: 4,
  },
  polaroidWrap: {
    alignSelf: 'center',
    position: 'relative',
  },
  screen: {
    backgroundColor: paperColors.paper0,
    flex: 1,
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
  stateCard: {
    alignItems: 'center',
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 10,
    padding: 18,
    ...paperShadow,
  },
  stateText: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  tagChip: {
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.2,
    maxWidth: '100%',
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  tagChipActive: {
    shadowColor: paperColors.ink0,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  tagCreator: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  tagInput: {
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
  tagLabel: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 13,
    lineHeight: 17,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 40,
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
