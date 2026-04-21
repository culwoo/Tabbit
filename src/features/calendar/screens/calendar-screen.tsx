import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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
import { formatLifeDayLabel } from '@/lib/life-day';
import { useFontPreference } from '@/providers/font-preference-provider';
import {
  useCalendarSummaries,
  type CalendarDayPreview,
  type CalendarDaySummary,
} from '../hooks/use-calendar-summaries';

type MonthCell = {
  date?: string;
  day?: number;
  key: string;
};

const WEEK_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
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

function buildMonthCells(anchorDate: string) {
  const [yearText, monthText] = anchorDate.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const firstDate = new Date(year, monthIndex, 1);
  const lastDate = new Date(year, monthIndex + 1, 0);
  const leadingEmptyCount = firstDate.getDay();
  const cells: MonthCell[] = [];

  for (let index = 0; index < leadingEmptyCount; index += 1) {
    cells.push({ key: `empty-${index}` });
  }

  for (let day = 1; day <= lastDate.getDate(); day += 1) {
    const paddedDay = String(day).padStart(2, '0');
    const paddedMonth = String(monthIndex + 1).padStart(2, '0');
    cells.push({
      date: `${year}-${paddedMonth}-${paddedDay}`,
      day,
      key: `${year}-${paddedMonth}-${paddedDay}`,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ key: `tail-${cells.length}` });
  }

  return {
    cells,
    monthKey: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
    monthLabel: `${year}. ${String(monthIndex + 1).padStart(2, '0')}`,
  };
}

function shiftMonth(anchorDate: string, delta: number) {
  const [yearText, monthText] = anchorDate.split('-');
  const next = new Date(Number(yearText), Number(monthText) - 1 + delta, 1);

  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
}

function getToneForEntry(entry: CalendarDayPreview | undefined, index: number): PaperTone {
  if (!entry) {
    return 'kraft';
  }

  return TAG_TONES[stripHash(entry.tagLabel)] ?? (['sage', 'peach', 'sky', 'butter', 'lilac'] as PaperTone[])[index % 5];
}

function getSummaryCount(summary?: CalendarDaySummary) {
  if (!summary) {
    return 0;
  }

  return summary.personalCount + summary.snapshotCount + summary.unlockedCount;
}

function countMonthStats(monthSummaries: CalendarDaySummary[]) {
  const tagCounts = new Map<string, number>();
  let totalEntries = 0;

  monthSummaries.forEach((summary) => {
    const count = getSummaryCount(summary);
    totalEntries += count;

    summary.entries.forEach((entry) => {
      const tag = stripHash(entry.tagLabel) || '기록';
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    });
  });

  const rankedTags = [...tagCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'ko'))
    .map(([tag, count], index, sorted) => {
      const previous = sorted[index - 1];
      const rank = previous && previous[1] === count
        ? sorted.findIndex((item) => item[1] === count) + 1
        : index + 1;

      return {
        count,
        isTied: sorted.some((item, itemIndex) => itemIndex !== index && item[1] === count),
        rank,
        tag,
      };
    });

  return {
    topTags: rankedTags.slice(0, 3),
    totalDays: monthSummaries.filter((summary) => getSummaryCount(summary) > 0).length,
    totalEntries,
  };
}

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const { bodyTextStyle, strongTextStyle } = useFontPreference();
  const today = resolveLifestyleDate(new Date());
  const { errorMessage, loading, refresh, summaries } = useCalendarSummaries();
  const [anchorDateState, setAnchorDateState] = useState<string | null>(null);
  const [selectedDateState, setSelectedDateState] = useState<string | null>(null);
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [weekly, setWeekly] = useState(false);

  const fallbackDate = summaries[0]?.date ?? today;
  const selectedDate = selectedDateState ?? fallbackDate;
  const anchorDate = anchorDateState ?? selectedDate;
  const { cells, monthKey, monthLabel } = useMemo(() => buildMonthCells(anchorDate), [anchorDate]);
  const summaryMap = useMemo(() => new Map(summaries.map((summary) => [summary.date, summary])), [summaries]);
  const monthSummaries = useMemo(
    () => summaries.filter((summary) => summary.date.startsWith(monthKey)),
    [monthKey, summaries],
  );
  const stats = useMemo(() => countMonthStats(monthSummaries), [monthSummaries]);

  const displayCells = useMemo(() => {
    if (!weekly) {
      return cells;
    }

    const targetDate = selectedDate.startsWith(monthKey) ? selectedDate : today;
    const targetIndex = Math.max(
      0,
      cells.findIndex((cell) => cell.date === targetDate),
    );
    const rowStart = Math.floor(targetIndex / 7) * 7;
    return cells.slice(rowStart, rowStart + 7);
  }, [cells, monthKey, selectedDate, today, weekly]);

  function handleSelectDate(date: string) {
    setSelectedDateState(date);
    setSheetDate(date);
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32, paddingTop: insets.top + 4 },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerNote}>나의 기록장</Text>
          <View style={styles.calendarControlLine}>
            <Text style={styles.monthTitle}>{monthLabel}</Text>
            <Pressable
              accessibilityLabel={weekly ? '월간 보기' : '주간 보기'}
              onPress={() => setWeekly((value) => !value)}
              style={styles.weekToggle}>
              <Ionicons
                color={paperColors.ink1}
                name="chevron-down"
                size={13}
                style={{ transform: [{ rotate: weekly ? '-90deg' : '0deg' }] }}
              />
              <Text style={styles.weekToggleText}>{weekly ? '주' : '월'}</Text>
            </Pressable>
            <View style={styles.monthButtons}>
              <Pressable
                accessibilityLabel="이전 달"
                onPress={() => setAnchorDateState(shiftMonth(anchorDate, -1))}
                style={styles.monthIcon}>
                <Ionicons color={paperColors.ink1} name="chevron-back" size={18} />
              </Pressable>
              <Pressable
                accessibilityLabel="다음 달"
                onPress={() => setAnchorDateState(shiftMonth(anchorDate, 1))}
                style={styles.monthIcon}>
                <Ionicons color={paperColors.ink1} name="chevron-forward" size={18} />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.weekRow}>
          {WEEK_LABELS.map((label, index) => (
            <Text key={label} style={[styles.weekLabel, index === 0 ? styles.sundayText : undefined]}>
              {label}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {displayCells.map((cell, index) => {
            if (!cell.date || !cell.day) {
              return <View key={cell.key} style={styles.daySlot} />;
            }

            const summary = summaryMap.get(cell.date);
            const entries = summary?.entries ?? [];
            const hasEntries = getSummaryCount(summary) > 0;
            const isToday = cell.date === today;
            const isSunday = index % 7 === 0;
            const tilt = ((cell.day * 7 + 3) % 5 - 2) * 0.8;
            const firstEntry = entries[0];

            return (
              <Pressable
                accessibilityLabel={`${formatLifeDayLabel(cell.date)} 열기`}
                accessibilityRole="button"
                key={cell.key}
                onPress={() => handleSelectDate(cell.date!)}
                style={styles.daySlot}>
                {hasEntries ? (
                  <View style={[styles.miniPolaroid, { transform: [{ rotate: `${tilt}deg` }] }]}>
                    <Text
                      style={[
                        styles.dayNumberOnPhoto,
                        isSunday ? styles.sundayText : undefined,
                      ]}>
                      {cell.day}
                    </Text>
                    <PhotoBlock
                      height="100%"
                      label=""
                      style={styles.miniPhoto}
                      tone={getToneForEntry(firstEntry, index)}
                      uri={firstEntry?.imageUrl}
                      width="100%"
                    />
                    {getSummaryCount(summary) > 1 ? (
                      <Text style={styles.moreCount}>+{getSummaryCount(summary) - 1}</Text>
                    ) : null}
                    {isToday ? <View style={styles.todayOutline} /> : null}
                  </View>
                ) : (
                  <View style={[styles.emptyDay, isToday ? styles.todayEmptyDay : undefined]}>
                    <Text style={[styles.emptyDayText, isSunday ? styles.sundayMutedText : undefined]}>
                      {cell.day}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.stateNote}>
            <ActivityIndicator color={paperColors.coral} />
            <Text style={styles.stateText}>기록장을 넘겨보는 중</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Tape angle={-6} left={28} top={-10} width={66} />
            <Text selectable style={styles.errorText}>{errorMessage}</Text>
            <Pressable onPress={() => void refresh()} style={styles.darkButton}>
              <Text style={styles.darkButtonText}>다시 불러오기</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.summaryWrap}>
          <Tape angle={-6} left={30} top={6} width={70} />
          <View style={styles.summaryCard}>
            <Text style={styles.summaryIntro}>이번달,</Text>
            <Text style={styles.summaryTitle}>
              <Text style={styles.highlight}>{stats.totalEntries}</Text>번 기록했어
            </Text>
            <Text style={[styles.summarySub, bodyTextStyle]}>{stats.totalDays}일 동안 · 꾸준하네~</Text>
            <View style={styles.summaryRule} />
            <Text style={[styles.summaryIntroSmall, bodyTextStyle]}>많이 쓴 태그 TOP 3</Text>
            {stats.topTags.length > 0 ? (
              <View style={styles.topTagRow}>
                {stats.topTags.map(({ count, isTied, rank, tag }, index) => (
                  <View key={tag} style={styles.topTagItem}>
                    <Text
                      style={[
                        styles.topTagRank,
                        isTied ? styles.topTagRankTie : undefined,
                        index === 0 ? styles.topTagRankFirst : undefined,
                      ]}>
                      {isTied ? `공동 ${rank}` : rank}
                    </Text>
                    <View>
                      <Text style={[styles.topTagLabel, strongTextStyle]}>#{tag}</Text>
                      <Text style={[styles.topTagCount, bodyTextStyle]}>{count}번</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.emptySummary, bodyTextStyle]}>아직 붙일 기록이 없어</Text>
            )}
          </View>
        </View>
      </ScrollView>

      <DaySheet
        date={sheetDate}
        onClose={() => setSheetDate(null)}
        onOpenDay={(date) => {
          setSheetDate(null);
          router.push(`/calendar/${date}`);
        }}
        summary={sheetDate ? summaryMap.get(sheetDate) : undefined}
      />
    </View>
  );
}

type DaySheetProps = {
  date: string | null;
  onClose: () => void;
  onOpenDay: (date: string) => void;
  summary?: CalendarDaySummary;
};

function DaySheet({ date, onClose, onOpenDay, summary }: DaySheetProps) {
  const [renderDate, setRenderDate] = useState<string | null>(date);
  const progress = useRef(new Animated.Value(date ? 0 : 1)).current;

  useEffect(() => {
    if (!date) {
      return;
    }

    setRenderDate(date);
    progress.setValue(1);
    Animated.spring(progress, {
      damping: 22,
      mass: 0.9,
      stiffness: 180,
      toValue: 0,
      useNativeDriver: true,
    }).start();
  }, [date, progress]);

  function closeWithMotion() {
    Animated.timing(progress, {
      duration: 220,
      toValue: 1,
      useNativeDriver: true,
    }).start(() => {
      setRenderDate(null);
      onClose();
    });
  }

  if (!renderDate) {
    return null;
  }

  const entries = summary?.entries ?? [];
  const count = getSummaryCount(summary);
  const sheetTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 420],
  });
  const backdropOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  return (
    <>
      <Animated.View style={[styles.sheetBackdrop, { opacity: backdropOpacity }]}>
        <Pressable
          accessibilityLabel="날짜 상세 닫기"
          onPress={closeWithMotion}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
        <View style={styles.grabber} />
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetDate}>{renderDate.replace(/-/g, '. ')}</Text>
            <Text style={styles.sheetTitle}>{count > 0 ? `이날 ${count}개 기록` : '이날은 비워둠'}</Text>
          </View>
          <Pressable accessibilityLabel="닫기" onPress={closeWithMotion} style={styles.closeButton}>
            <Ionicons color={paperColors.ink2} name="close" size={20} />
          </Pressable>
        </View>
        <View style={styles.sheetRule} />
        {entries.length > 0 ? (
          <View style={styles.sheetList}>
            {entries.slice(0, 4).map((entry, index) => {
              const isPrivate = entry.kind === 'personal';

              return (
                <View key={entry.id} style={styles.sheetEntry}>
                  <View style={styles.sheetPhotoWrap}>
                    <Tape angle={-6} left={20} top={-6} width={32} />
                    <PhotoBlock
                      height={82}
                      label=""
                      style={styles.sheetPhoto}
                      tone={getToneForEntry(entry, index)}
                      uri={entry.imageUrl}
                      width={82}
                    />
                  </View>
                  <View style={styles.sheetEntryCopy}>
                    <View style={styles.sheetTagRow}>
                      <Text style={[styles.sheetTag, { backgroundColor: paperColors[getToneForEntry(entry, index)] }]}>
                        #{stripHash(entry.tagLabel)}
                      </Text>
                      {isPrivate ? <Text style={styles.privateTag}>나만 보기</Text> : null}
                    </View>
                    <Text numberOfLines={2} style={styles.sheetCaption}>{entry.caption}</Text>
                    <Text style={styles.sheetMeta}>
                      {isPrivate ? '개인 기록' : '그룹 기록 · 공유됨'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.sheetEmpty}>그날은 쉬었구나~</Text>
        )}
        {count > 0 ? (
          <Pressable onPress={() => onOpenDay(renderDate)} style={styles.sheetButton}>
            <Text style={styles.sheetButtonText}>이 날로 가기</Text>
            <Text style={styles.sheetButtonArrow}>→</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    padding: 4,
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
  dayNumberOnPhoto: {
    backgroundColor: 'rgba(253,251,245,0.88)',
    borderRadius: 2,
    color: paperColors.ink0,
    fontFamily: paperFonts.pen,
    fontSize: 13,
    left: 4,
    lineHeight: 15,
    paddingHorizontal: 3,
    position: 'absolute',
    top: 3,
    zIndex: 2,
  },
  daySlot: {
    aspectRatio: 0.8,
    padding: 2,
    width: `${100 / 7}%`,
  },
  emptyDay: {
    borderColor: 'transparent',
    borderRadius: 4,
    borderWidth: 1,
    flex: 1,
    padding: 4,
  },
  emptyDayText: {
    color: paperColors.ink3,
    fontFamily: paperFonts.pen,
    fontSize: 15,
    lineHeight: 18,
  },
  emptySummary: {
    color: paperColors.ink3,
    fontFamily: paperFonts.pen,
    fontSize: 18,
    lineHeight: 23,
    marginTop: 7,
  },
  errorCard: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 10,
    marginHorizontal: 18,
    marginTop: 10,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  grabber: {
    alignSelf: 'center',
    backgroundColor: paperColors.ink3,
    borderRadius: 2,
    height: 4,
    marginBottom: 10,
    width: 44,
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 4,
  },
  headerNote: {
    color: paperColors.ink2,
    fontFamily: paperFonts.pen,
    fontSize: 22,
    lineHeight: 27,
  },
  calendarControlLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    marginTop: 2,
  },
  highlight: {
    backgroundColor: paperColors.butter,
  },
  miniPhoto: {
    flex: 1,
  },
  miniPolaroid: {
    backgroundColor: paperColors.card,
    flex: 1,
    padding: 3,
    paddingBottom: 14,
    position: 'relative',
    shadowColor: '#1E190F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  monthButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  monthIcon: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  monthTitle: {
    color: paperColors.ink0,
    flex: 1,
    fontFamily: paperFonts.handBold,
    fontSize: 34,
    letterSpacing: 0,
    lineHeight: 40,
  },
  moreCount: {
    bottom: 2,
    color: paperColors.coral,
    fontFamily: paperFonts.pen,
    fontSize: 13,
    lineHeight: 15,
    position: 'absolute',
    right: 3,
  },
  privateTag: {
    borderColor: paperColors.ink2,
    borderRadius: 999,
    borderStyle: 'dashed',
    borderWidth: 1.2,
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 10,
    lineHeight: 14,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  screen: {
    backgroundColor: paperColors.paper0,
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  sheet: {
    backgroundColor: paperColors.paper0,
    borderColor: paperColors.ink0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1.5,
    bottom: 0,
    left: 0,
    maxHeight: '72%',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 22,
    position: 'absolute',
    right: 0,
    shadowColor: '#1E190F',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(30,25,15,0.35)',
  },
  sheetButton: {
    alignItems: 'center',
    backgroundColor: paperColors.ink0,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sheetButtonArrow: {
    color: paperColors.card,
    fontFamily: paperFonts.pen,
    fontSize: 18,
    lineHeight: 20,
  },
  sheetButtonText: {
    color: paperColors.card,
    fontFamily: paperFonts.handBold,
    fontSize: 13,
    lineHeight: 17,
  },
  sheetCaption: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 14,
    lineHeight: 19,
    marginTop: 6,
  },
  sheetDate: {
    color: paperColors.ink2,
    fontFamily: paperFonts.pen,
    fontSize: 22,
    lineHeight: 27,
  },
  sheetEmpty: {
    color: paperColors.ink3,
    fontFamily: paperFonts.pen,
    fontSize: 22,
    lineHeight: 28,
    paddingVertical: 24,
    textAlign: 'center',
  },
  sheetEntry: {
    flexDirection: 'row',
    gap: 12,
  },
  sheetEntryCopy: {
    flex: 1,
    minWidth: 0,
    paddingTop: 4,
  },
  sheetHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sheetList: {
    gap: 14,
  },
  sheetMeta: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
  },
  sheetPhoto: {
    borderColor: paperColors.ink0,
    borderWidth: 1.1,
  },
  sheetPhotoWrap: {
    position: 'relative',
    transform: [{ rotate: '-1.5deg' }],
  },
  sheetRule: {
    backgroundColor: paperColors.ink0,
    height: 1.5,
    marginVertical: 12,
    opacity: 0.12,
  },
  sheetTag: {
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.2,
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 11,
    lineHeight: 15,
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  sheetTagRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sheetTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 22,
    lineHeight: 27,
    marginTop: 2,
  },
  stateNote: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  stateText: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 14,
    lineHeight: 19,
  },
  summaryCard: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    transform: [{ rotate: '-0.8deg' }],
    ...paperShadow,
  },
  summaryIntro: {
    color: paperColors.ink2,
    fontFamily: paperFonts.pen,
    fontSize: 20,
    lineHeight: 25,
  },
  summaryIntroSmall: {
    color: paperColors.ink2,
    fontFamily: paperFonts.pen,
    fontSize: 16,
    lineHeight: 21,
  },
  summaryRule: {
    backgroundColor: paperColors.ink0,
    height: 1,
    marginTop: 12,
    marginBottom: 10,
    opacity: 0.12,
  },
  summarySub: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  summaryTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 26,
    lineHeight: 31,
    marginTop: 2,
  },
  summaryWrap: {
    paddingHorizontal: 18,
    paddingTop: 20,
    position: 'relative',
  },
  sundayMutedText: {
    color: 'rgba(217,135,115,0.5)',
  },
  sundayText: {
    color: paperColors.coral,
  },
  todayEmptyDay: {
    backgroundColor: paperColors.butter,
    borderColor: paperColors.ink0,
    borderWidth: 1.2,
  },
  todayOutline: {
    ...StyleSheet.absoluteFillObject,
    borderColor: paperColors.coral,
    borderWidth: 1.5,
  },
  topTagCount: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 10,
    lineHeight: 14,
  },
  topTagItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  topTagLabel: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 13,
    lineHeight: 17,
  },
  topTagRank: {
    color: paperColors.ink0,
    fontFamily: paperFonts.pen,
    fontSize: 26,
    lineHeight: 29,
  },
  topTagRankFirst: {
    color: paperColors.coral,
  },
  topTagRankTie: {
    fontSize: 15,
    lineHeight: 19,
  },
  topTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 6,
  },
  weekLabel: {
    color: paperColors.ink2,
    flex: 1,
    fontFamily: paperFonts.pen,
    fontSize: 17,
    lineHeight: 21,
    textAlign: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 4,
  },
  weekToggle: {
    alignItems: 'center',
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.3,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  weekToggleText: {
    color: paperColors.ink1,
    fontFamily: paperFonts.pen,
    fontSize: 16,
    lineHeight: 19,
  },
});
