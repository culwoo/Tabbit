import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppHeader, type HeaderAction } from '@/components/shell/app-header';
import { AppButton } from '@/components/ui/app-button';
import { colors, radius, spacing, typography } from '@/constants/tokens';
import { useAppSession } from '@/providers/app-session-provider';
import {
  addPersonalTag,
  fetchMyPersonalCertificationRecords,
  syncGroupTagsToPersonalTags,
  type PersonalTagRow,
  type PersonalCertificationRecord,
} from '@/lib/supabase';
import { formatLifeDayLabel, formatTimestampLabel, resolveLifestyleDate } from '@/lib/life-day';

export default function PersonalSpaceScreen() {
  const navigation = useNavigation();
  const { userId } = useAppSession();
  const [tags, setTags] = useState<PersonalTagRow[]>([]);
  const [records, setRecords] = useState<PersonalCertificationRecord[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newTagLabel, setNewTagLabel] = useState('');
  const [creatingTag, setCreatingTag] = useState(false);
  const [tagCreateError, setTagCreateError] = useState<string | null>(null);

  const lifeDay = resolveLifestyleDate(new Date());

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

  const rightActions: HeaderAction[] = [
    {
      accessibilityLabel: '새로고침',
      icon: 'refresh',
      onPress: () => void loadData(),
    },
  ];
  const filteredRecords = useMemo(
    () =>
      selectedTagId
        ? records.filter((record) => record.shareTarget.personal_tag_ids.includes(selectedTagId))
        : records,
    [records, selectedTagId],
  );
  const todayRecordCount = useMemo(
    () => records.filter((record) => record.certification.lifestyle_date === lifeDay).length,
    [lifeDay, records],
  );

  return (
    <View style={styles.screen}>
      <AppHeader
        onBack={handleBack}
        rightActions={rightActions}
        title="개인공간"
        variant="detail"
      />
      <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroHeader}>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>Private memo</Text>
              <Text style={styles.title}>나만의 기록첩</Text>
              <Text style={styles.heroDescription}>그룹에 올리지 않은 인증도 태그별로 조용히 쌓입니다.</Text>
            </View>
            <View style={styles.heroMark}>
              <Ionicons color={colors.brand.accent} name="bookmark" size={24} />
            </View>
          </View>
          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricValue}>{tags.length}</Text>
              <Text style={styles.metricLabel}>태그</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricValue}>{todayRecordCount}</Text>
              <Text style={styles.metricLabel}>오늘 인증</Text>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerCard}>
            <ActivityIndicator color={colors.brand.primary} />
            <Text style={styles.mutedText}>불러오는 중입니다...</Text>
          </View>
        ) : null}

        {!loading && errorMessage ? (
          <View style={styles.centerCard}>
            <Ionicons color={colors.status.danger} name="alert-circle-outline" size={24} />
            <Text selectable style={styles.mutedText}>{errorMessage}</Text>
            <AppButton label="다시 불러오기" onPress={() => void loadData()} variant="secondary" />
          </View>
        ) : null}

        {!loading && !errorMessage ? (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleGroup}>
                  <Text style={styles.sectionTitle}>태그</Text>
                  <Text style={styles.sectionDescription}>
                    자주 남기는 루틴을 미리 만들어두면 업로드할 때 바로 고를 수 있어요.
                  </Text>
                </View>
              </View>
              <View style={styles.tagCreator}>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!creatingTag && Boolean(userId)}
                  maxLength={24}
                  onChangeText={setNewTagLabel}
                  onSubmitEditing={() => void handleCreateTag()}
                  placeholder="예: #운동"
                  placeholderTextColor={colors.text.tertiary}
                  returnKeyType="done"
                  style={styles.tagInput}
                  value={newTagLabel}
                />
                <View style={styles.tagCreateButton}>
                  <AppButton
                    disabled={!newTagLabel.trim() || creatingTag || !userId}
                    label={creatingTag ? '추가 중...' : '태그 추가'}
                    onPress={() => void handleCreateTag()}
                    variant="secondary"
                  />
                </View>
              </View>
              {tagCreateError ? (
                <View style={styles.inlineError}>
                  <Ionicons color={colors.status.danger} name="alert-circle-outline" size={16} />
                  <Text selectable style={styles.inlineErrorText}>{tagCreateError}</Text>
                </View>
              ) : null}
              {tags.length === 0 ? (
                <Text style={styles.emptyText}>아직 개인공간 태그가 없습니다.</Text>
              ) : (
                <View style={styles.tagRow}>
                  <Pressable
                    onPress={() => setSelectedTagId(null)}
                    style={[styles.tagChip, !selectedTagId ? styles.tagChipSelected : styles.tagChipIdle]}>
                    <Text style={[styles.tagLabel, !selectedTagId && styles.tagLabelSelected]}>전체</Text>
                  </Pressable>
                  {tags.map((tag, tagIndex) => (
                    <Pressable
                      key={`${tag.id}:${tagIndex}`}
                      onPress={() => setSelectedTagId(tag.id)}
                      style={[
                        styles.tagChip,
                        selectedTagId === tag.id ? styles.tagChipSelected : styles.tagChipIdle,
                      ]}>
                      <Text style={[styles.tagLabel, selectedTagId === tag.id && styles.tagLabelSelected]}>
                        {tag.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>인증 기록</Text>
              {filteredRecords.length === 0 ? (
                <Text style={styles.emptyText}>
                  {selectedTagId ? '이 태그로 저장된 개인공간 인증이 아직 없습니다.' : '아직 개인공간에 저장된 인증이 없습니다.'}
                </Text>
              ) : (
                <View style={styles.certificationList}>
                  {filteredRecords.map((record, recordIndex) => (
                    <View key={`${record.certification.id}:${recordIndex}`} style={styles.certificationItem}>
                      {record.certification.image_url ? (
                        <Image source={{ uri: record.certification.image_url }} style={styles.certificationImage} />
                      ) : null}
                      <View style={styles.certificationCopy}>
                        <Text style={styles.certificationCaption} numberOfLines={2}>
                          {record.certification.caption || '문구 없음'}
                        </Text>
                        <Text style={styles.certificationMeta}>
                          {formatLifeDayLabel(record.certification.lifestyle_date)} · {formatTimestampLabel(record.certification.uploaded_at)}
                        </Text>
                        <Text style={styles.certificationTags} numberOfLines={1}>
                          {record.personalTags.map((tag) => tag.label).join(' · ') || '개인공간'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.bg.canvas,
    flex: 1,
  },
  container: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  hero: {
    backgroundColor: colors.bg.warm,
    borderColor: colors.line.warm,
    borderRadius: radius.sheet,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  heroMark: {
    alignItems: 'center',
    backgroundColor: colors.surface.raised,
    borderColor: colors.line.warm,
    borderRadius: 18,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    transform: [{ rotate: '4deg' }],
    width: 54,
  },
  eyebrow: {
    color: colors.brand.primary,
    fontSize: 12,
    fontWeight: typography.eyebrow.fontWeight,
    textTransform: 'uppercase',
  },
  title: {
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
  metricsRow: {
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
  metricValue: {
    color: colors.text.primary,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
  },
  metricLabel: {
    color: colors.text.secondary,
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
  },
  centerCard: {
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    borderColor: colors.line.soft,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  mutedText: {
    color: colors.text.secondary,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    textAlign: 'center',
  },
  section: {
    backgroundColor: colors.surface.primary,
    borderColor: colors.line.soft,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    lineHeight: typography.title.lineHeight,
  },
  sectionHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sectionTitleGroup: {
    flex: 1,
    gap: spacing.xxs,
  },
  sectionDescription: {
    color: colors.text.secondary,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  emptyText: {
    color: colors.text.secondary,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  tagCreator: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tagInput: {
    backgroundColor: colors.surface.raised,
    borderColor: colors.line.soft,
    borderRadius: radius.input,
    borderWidth: 1,
    color: colors.text.primary,
    flex: 1,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    minWidth: 150,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tagCreateButton: {
    minWidth: 112,
  },
  inlineError: {
    alignItems: 'center',
    backgroundColor: colors.surface.secondary,
    borderColor: colors.line.soft,
    borderRadius: radius.input,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  inlineErrorText: {
    color: colors.status.danger,
    flex: 1,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tagChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tagChipIdle: {
    backgroundColor: colors.surface.raised,
    borderColor: colors.line.soft,
  },
  tagChipSelected: {
    backgroundColor: colors.brand.butterSoft,
    borderColor: colors.brand.accent,
  },
  tagLabel: {
    color: colors.text.secondary,
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
  },
  tagLabelSelected: {
    color: colors.text.primary,
  },
  certificationList: {
    gap: spacing.sm,
  },
  certificationItem: {
    alignItems: 'center',
    backgroundColor: colors.surface.raised,
    borderColor: colors.line.soft,
    borderWidth: 1,
    borderRadius: radius.input,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  certificationImage: {
    backgroundColor: colors.surface.tertiary,
    borderRadius: radius.input,
    height: 64,
    width: 64,
  },
  certificationCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  certificationCaption: {
    color: colors.text.primary,
    fontSize: typography.body.fontSize,
    fontWeight: typography.bodyStrong.fontWeight,
    lineHeight: typography.body.lineHeight,
  },
  certificationMeta: {
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 16,
  },
  certificationTags: {
    color: colors.brand.primary,
    fontSize: 12,
    fontWeight: typography.label.fontWeight,
    lineHeight: 16,
  },
});
