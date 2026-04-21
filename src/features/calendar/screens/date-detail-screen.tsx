import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  PhotoBlock,
  Tape,
  paperColors,
  paperFonts,
  paperShadow,
  stripHash,
  type PaperTone,
} from '@/components/ui/paper-design';
import { resolveLifestyleDate } from '@/lib/domain';
import { formatTimestampLabel } from '@/lib/life-day';
import { useDateDetail, type PersonalCalendarRecord } from '../hooks/use-date-detail';

const TAG_TONES: Record<string, PaperTone> = {
  '1만원데이': 'sky',
  공부: 'peach',
  기상: 'butter',
  독서: 'peach',
  명상: 'lilac',
  무지출: 'sky',
  미라클모닝: 'butter',
  식단: 'sage',
  음악: 'lilac',
  운동: 'sage',
  헬스: 'sage',
};

const weekdayFormatter = new Intl.DateTimeFormat('ko-KR', { weekday: 'short' });

function buildGroupRoute(groupId: string, tagId: string, lifeDay: string, shareMode?: boolean) {
  const query = new URLSearchParams({
    lifeDay,
    tagId,
  });

  if (shareMode) {
    query.set('shareMode', '1');
  }

  return `/groups/${groupId}?${query.toString()}`;
}

function getThresholdLabel(status: string) {
  if (status === 'provisional_unlocked' || status === 'finalized') {
    return '열림';
  }

  if (status === 'expired') {
    return '마감';
  }

  return '잠김';
}

function getDateMeta(date: string) {
  const [year, month, day] = date.split('-');
  const dateObject = new Date(`${date}T12:00:00+09:00`);

  return {
    dayNumber: Number(day),
    dayPadded: day,
    monthLabel: `${year}. ${month}`,
    weekday: weekdayFormatter.format(dateObject).replace('요일', ''),
  };
}

function getToneForRecord(record: PersonalCalendarRecord, index: number): PaperTone {
  const tag = stripHash(record.tagLabels[0] ?? record.title);
  return TAG_TONES[tag] ?? (['sage', 'peach', 'sky', 'butter', 'lilac'] as PaperTone[])[index % 5];
}

export default function DateDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { date } = useLocalSearchParams<{ date: string }>();
  const selectedDate = Array.isArray(date) ? date[0] : date ?? resolveLifestyleDate(new Date());
  const { dayNumber, dayPadded, monthLabel, weekday } = getDateMeta(selectedDate);
  const today = resolveLifestyleDate(new Date());
  const isToday = selectedDate === today;

  const { errorMessage, loading, groupEntries, personalRecords, refresh } = useDateDetail(selectedDate);

  function handleBack() {
    if (navigation.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/calendar');
  }

  function getSharedGroups(recordId: string) {
    return groupEntries
      .filter((entry) => entry.records.some((record) => record.id === recordId))
      .map((entry) => entry.groupName);
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.centerScreen, { paddingTop: insets.top }]}>
        <ActivityIndicator color={paperColors.coral} size="large" />
        <Text style={styles.loadingText}>하루 기록을 펼치는 중</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: insets.bottom + 44, paddingTop: insets.top + 4 },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable accessibilityLabel="뒤로가기" onPress={handleBack} style={styles.backButton}>
            <Ionicons color={paperColors.ink0} name="chevron-back" size={21} />
          </Pressable>
          <View style={styles.topCopy}>
            <Text style={styles.topEyebrow}>회고 · 기록장</Text>
            <Text style={styles.topDate}>
              {monthLabel}. {dayPadded} ({weekday})
            </Text>
          </View>
          {isToday ? <Text style={styles.todaySticker}>오늘</Text> : <View style={styles.topSpacer} />}
        </View>

        <View style={styles.dateHero}>
          <Text style={styles.bigDay}>{dayNumber}</Text>
          <View style={styles.dateHeroCopy}>
            <Text style={styles.dateHeroTitle}>
              {personalRecords.length > 0 ? (
                <>
                  오늘 <Text style={styles.highlight}>{personalRecords.length}개</Text> 인증
                </>
              ) : (
                '이 날은 쉬었네'
              )}
            </Text>
            <Text numberOfLines={2} style={styles.dateHeroMeta}>
              {personalRecords.length > 0
                ? personalRecords.flatMap((record) => record.tagLabels).map((tag) => `#${stripHash(tag)}`).join(' · ')
                : '적당히 쉬는 것도 갓생~'}
            </Text>
          </View>
        </View>

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Tape angle={-6} left={28} top={-10} width={70} />
            <Text selectable style={styles.errorText}>{errorMessage}</Text>
            <Pressable onPress={() => void refresh()} style={styles.darkButton}>
              <Text style={styles.darkButtonText}>다시 불러오기</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.entryList}>
          {personalRecords.map((record, index) => {
            const sharedGroups = getSharedGroups(record.id);
            const isPrivate = sharedGroups.length === 0;
            const tone = getToneForRecord(record, index);
            const tilt = index % 2 === 0 ? -0.8 : 0.8;

            return (
              <View key={record.id} style={[styles.entryWrap, { transform: [{ rotate: `${tilt}deg` }] }]}>
                <Tape angle={-8} left={120} top={-8} width={70} />
                <View style={styles.polaroidCard}>
                  <PhotoBlock
                    height={240}
                    label={record.tagLabels[0] ? `#${stripHash(record.tagLabels[0])}` : 'photo'}
                    tone={tone}
                    uri={record.imageUrl}
                    width="100%"
                  />
                  <View style={styles.polaroidCaptionRow}>
                    <Text numberOfLines={2} style={styles.handCaption}>
                      {record.summary}
                    </Text>
                    <Text style={[styles.recordTag, { backgroundColor: paperColors[tone] }]}>
                      #{stripHash(record.tagLabels[0] ?? record.title)}
                    </Text>
                  </View>
                </View>
                <View style={[styles.sharedMeta, { transform: [{ rotate: `${-tilt}deg` }] }]}>
                  {isPrivate ? (
                    <>
                      <Ionicons color={paperColors.ink2} name="lock-closed-outline" size={12} />
                      <Text style={styles.sharedMetaText}>
                        <Text style={styles.sharedMetaStrong}>나만 보는 기록</Text> · 가입한 그룹에 연결되지 않았어요
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.sharedArrow}>↗</Text>
                      <Text style={styles.sharedMetaText}>
                        <Text style={styles.sharedMetaStrong}>공유됨</Text> · {sharedGroups.join(' · ')}
                      </Text>
                    </>
                  )}
                </View>
              </View>
            );
          })}

          {personalRecords.length === 0 ? (
            <Text style={styles.emptyDay}>쉬는 날도 있는 거야~</Text>
          ) : null}
        </View>

        {groupEntries.length > 0 ? (
          <View style={styles.groupSection}>
            <Text style={styles.sectionFlag}>오늘 그룹별로 집계된 태그</Text>
            <View style={styles.groupList}>
              {groupEntries.map((entry, index) => {
                const tone = (['sage', 'peach', 'sky', 'butter', 'lilac'] as PaperTone[])[index % 5];

                return (
                  <View
                    key={`${entry.groupId}:${entry.tagId}:${entry.lifeDay}`}
                    style={[styles.groupCard, { transform: [{ rotate: `${index % 2 === 0 ? -0.3 : 0.3}deg` }] }]}>
                    <View style={styles.groupCardTop}>
                      <View style={styles.groupCopy}>
                        <Text numberOfLines={1} style={styles.groupName}>
                          {entry.groupName}
                        </Text>
                        <Text style={styles.groupMeta}>
                          {entry.shareProgressLabel} · {getThresholdLabel(entry.thresholdState.status)}
                        </Text>
                        <Text style={styles.groupSubtitle}>{entry.subtitle}</Text>
                      </View>
                      <Text style={[styles.groupTag, { backgroundColor: paperColors[tone] }]}>
                        #{stripHash(entry.tagLabel)}
                      </Text>
                    </View>
                    <View style={styles.contributorRow}>
                      {entry.records.slice(0, 4).map((record, recordIndex) => (
                        <View key={`${record.id}-${recordIndex}`} style={styles.contributorPhoto}>
                          <PhotoBlock
                            height={44}
                            label={record.contributorName}
                            tone={tone}
                            uri={record.imageUrl}
                            width={44}
                          />
                        </View>
                      ))}
                      <Text style={styles.contributorText}>
                        내 태그 {entry.records.length}개 집계
                      </Text>
                    </View>
                    <View style={styles.groupActions}>
                      <Pressable
                        onPress={() => router.push(buildGroupRoute(entry.groupId, entry.tagId, entry.lifeDay))}
                        style={[styles.smallButton, styles.smallButtonSecondary]}>
                        <Text style={[styles.smallButtonText, styles.smallButtonTextDark]}>그룹 열기</Text>
                      </Pressable>
                      <Pressable
                        disabled={!entry.shareEnabled}
                        onPress={() => router.push(buildGroupRoute(entry.groupId, entry.tagId, entry.lifeDay, true))}
                        style={[styles.smallButton, !entry.shareEnabled ? styles.disabledButton : undefined]}>
                        <Text style={styles.smallButtonText}>스토리 카드</Text>
                      </Pressable>
                    </View>
                    {entry.snapshot?.last_snapshot_exported_at ? (
                      <Text style={styles.snapshotMeta}>
                        저장됨 · {formatTimestampLabel(entry.snapshot.last_snapshot_exported_at)}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {isToday ? '— 오늘도 수고했어 —' : `— ${monthLabel}. ${dayPadded} —`}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.5,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  bigDay: {
    color: paperColors.ink0,
    fontFamily: paperFonts.pen,
    fontSize: 110,
    letterSpacing: 0,
    lineHeight: 94,
  },
  centerScreen: {
    alignItems: 'center',
    backgroundColor: paperColors.paper0,
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  container: {
    paddingHorizontal: 16,
  },
  contributorPhoto: {
    borderColor: paperColors.ink0,
    borderWidth: 1,
  },
  contributorRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 10,
  },
  contributorText: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 11,
    lineHeight: 15,
  },
  darkButton: {
    alignSelf: 'flex-start',
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
  dateHero: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 6,
    paddingTop: 14,
    paddingBottom: 8,
  },
  dateHeroCopy: {
    flex: 1,
    paddingBottom: 12,
  },
  dateHeroMeta: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  dateHeroTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 18,
    lineHeight: 23,
  },
  disabledButton: {
    opacity: 0.4,
  },
  emptyDay: {
    color: paperColors.ink3,
    fontFamily: paperFonts.pen,
    fontSize: 26,
    lineHeight: 32,
    paddingVertical: 40,
    textAlign: 'center',
  },
  entryList: {
    gap: 18,
    paddingTop: 8,
  },
  entryWrap: {
    position: 'relative',
  },
  errorCard: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 10,
    marginBottom: 16,
    marginTop: 4,
    padding: 16,
    position: 'relative',
    ...paperShadow,
  },
  errorText: {
    color: paperColors.ink1,
    fontFamily: paperFonts.handBold,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    paddingTop: 28,
  },
  footerText: {
    color: paperColors.ink3,
    fontFamily: paperFonts.pen,
    fontSize: 20,
    lineHeight: 25,
    textAlign: 'center',
  },
  groupActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  groupCard: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderWidth: 1.5,
    padding: 12,
    ...paperShadow,
  },
  groupCardTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  groupCopy: {
    flex: 1,
    minWidth: 0,
  },
  groupList: {
    gap: 10,
    marginTop: 10,
  },
  groupMeta: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  groupName: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 13,
    lineHeight: 17,
  },
  groupSection: {
    paddingTop: 26,
  },
  groupSubtitle: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
  },
  groupTag: {
    borderColor: paperColors.ink0,
    borderWidth: 1,
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 10,
    lineHeight: 14,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  handCaption: {
    color: paperColors.ink0,
    flex: 1,
    fontFamily: paperFonts.pen,
    fontSize: 22,
    lineHeight: 26,
  },
  highlight: {
    backgroundColor: paperColors.butter,
  },
  loadingText: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 15,
  },
  polaroidCaptionRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginTop: 10,
  },
  polaroidCard: {
    backgroundColor: paperColors.card,
    padding: 10,
    paddingBottom: 40,
    ...paperShadow,
  },
  recordTag: {
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.3,
    color: paperColors.ink0,
    flexShrink: 0,
    fontFamily: paperFonts.handBold,
    fontSize: 11,
    lineHeight: 15,
    overflow: 'hidden',
    paddingHorizontal: 11,
    paddingVertical: 3,
  },
  screen: {
    backgroundColor: paperColors.paper0,
    flex: 1,
  },
  sectionFlag: {
    alignSelf: 'flex-start',
    backgroundColor: paperColors.ink0,
    color: paperColors.paper2,
    fontFamily: paperFonts.handBold,
    fontSize: 10,
    letterSpacing: 1.5,
    lineHeight: 14,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
    textTransform: 'uppercase',
  },
  sharedArrow: {
    color: paperColors.ink2,
    fontFamily: paperFonts.pen,
    fontSize: 16,
    lineHeight: 16,
    paddingTop: 1,
  },
  sharedMeta: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  sharedMetaStrong: {
    color: paperColors.ink0,
  },
  sharedMetaText: {
    color: paperColors.ink2,
    flex: 1,
    fontFamily: paperFonts.handBold,
    fontSize: 11,
    lineHeight: 16,
  },
  smallButton: {
    alignItems: 'center',
    backgroundColor: paperColors.ink0,
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.2,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  smallButtonSecondary: {
    backgroundColor: 'transparent',
  },
  smallButtonText: {
    color: paperColors.card,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 16,
  },
  smallButtonTextDark: {
    color: paperColors.ink0,
  },
  snapshotMeta: {
    color: paperColors.ink3,
    fontFamily: paperFonts.handBold,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 8,
  },
  todaySticker: {
    backgroundColor: paperColors.coral,
    borderRadius: 999,
    color: paperColors.card,
    fontFamily: paperFonts.pen,
    fontSize: 18,
    lineHeight: 22,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 2,
    transform: [{ rotate: '-4deg' }],
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 40,
  },
  topCopy: {
    flex: 1,
    minWidth: 0,
  },
  topDate: {
    color: paperColors.ink2,
    fontFamily: paperFonts.pen,
    fontSize: 18,
    lineHeight: 22,
  },
  topEyebrow: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 11,
    letterSpacing: 1,
    lineHeight: 15,
  },
  topSpacer: {
    width: 46,
  },
});
