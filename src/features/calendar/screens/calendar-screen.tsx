import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { AppHeader } from '@/components/shell/app-header';
import { AppButton } from '@/components/ui/app-button';
import { SoftCard } from '@/components/ui/soft-card';
import { colors, radius, spacing, typography } from '@/constants/tokens';
import { formatLifeDayLabel } from '@/lib/life-day';
import { resolveLifestyleDate } from '@/lib/domain';
import { useCalendarSummaries } from '../hooks/use-calendar-summaries';

function buildMonthCells(anchorDate: string) {
  const [yearText, monthText] = anchorDate.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const firstDate = new Date(year, monthIndex, 1);
  const lastDate = new Date(year, monthIndex + 1, 0);
  const leadingEmptyCount = firstDate.getDay();
  const totalDays = lastDate.getDate();

  const cells: { key: string; date?: string; dayLabel?: string }[] = [];

  for (let index = 0; index < leadingEmptyCount; index += 1) {
    cells.push({ key: `empty-${index}` });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const paddedDay = `${day}`.padStart(2, '0');
    cells.push({
      key: `${year}-${monthIndex + 1}-${paddedDay}`,
      date: `${year}-${String(monthIndex + 1).padStart(2, '0')}-${paddedDay}`,
      dayLabel: `${day}`,
    });
  }

  return {
    monthLabel: `${year}년 ${monthIndex + 1}월`,
    cells,
  };
}

const weekLabels = ['일', '월', '화', '수', '목', '금', '토'];

export default function CalendarScreen() {
  const { errorMessage, loading, refresh, summaries } = useCalendarSummaries();
  const [selectedDateState, setSelectedDateState] = useState<string | null>(null);

  const selectedDate = selectedDateState ?? summaries[0]?.date ?? resolveLifestyleDate(new Date());

  const summaryMap = useMemo(() => new Map(summaries.map((summary) => [summary.date, summary])), [summaries]);
  const selectedSummary = summaryMap.get(selectedDate);
  const { monthLabel, cells } = useMemo(() => buildMonthCells(selectedDate), [selectedDate]);

  return (
    <View style={styles.screen}>
      <AppHeader
        title="캘린더"
        variant="calendar-tab"
        rightActions={[
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
        ]}
      />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <SoftCard style={styles.heroCard} variant="empty">
          <Text style={styles.heroEyebrow}>Memory calendar</Text>
          <Text style={styles.heroTitle}>같이 채운 날들을 모아보기</Text>
          <Text style={styles.heroDescription}>
            그룹 언락, 저장된 스토리, 개인공간 기록을 날짜별로 차분히 꺼내볼 수 있어요.
          </Text>
        </SoftCard>

        {loading ? (
          <SoftCard style={styles.stateCard} variant="empty">
            <ActivityIndicator color={colors.brand.primary} />
            <Text style={styles.stateCopy}>캘린더 기록을 불러오는 중입니다.</Text>
          </SoftCard>
        ) : null}

        {!loading && errorMessage ? (
          <SoftCard style={styles.stateCard} variant="empty">
            <Ionicons color={colors.status.danger} name="alert-circle-outline" size={22} />
            <Text selectable style={styles.stateCopy}>{errorMessage}</Text>
            <AppButton label="다시 불러오기" onPress={() => void refresh()} variant="secondary" />
          </SoftCard>
        ) : null}

        <SoftCard style={styles.calendarCard} variant="empty">
          <View style={styles.calendarHeader}>
            <Text style={styles.calendarMonth}>{monthLabel}</Text>
            <Text style={styles.calendarLegend}>초록 점은 언락, 보라 점은 저장된 스토리</Text>
          </View>

          <View style={styles.weekRow}>
            {weekLabels.map((label) => (
              <Text key={label} style={styles.weekLabel}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((cell) => {
              if (!cell.date) {
                return <View key={cell.key} style={styles.emptyCell} />;
              }

              const summary = summaryMap.get(cell.date);
              const isSelected = cell.date === selectedDate;

              return (
                <Pressable
                  key={cell.key}
                  onPress={() => setSelectedDateState(cell.date!)}
                  style={[
                    styles.dayCell,
                    isSelected ? styles.dayCellSelected : styles.dayCellIdle,
                  ]}>
                  <Text style={[styles.dayLabel, isSelected && styles.dayLabelSelected]}>{cell.dayLabel}</Text>
                  <View style={styles.dotRow}>
                    {summary?.unlockedCount ? <View style={styles.unlockDot} /> : null}
                    {summary?.snapshotCount ? <View style={styles.snapshotDot} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </SoftCard>

        <SoftCard style={styles.selectedCard} variant="group-space">
          <Text style={styles.selectedEyebrow}>선택 날짜</Text>
          <Text style={styles.selectedTitle}>{formatLifeDayLabel(selectedDate)}</Text>
          <Text style={styles.selectedDescription}>
            {selectedSummary?.label ?? '저장된 인증이나 언락 기록이 아직 없습니다.'}
          </Text>
          <View style={styles.selectedMetrics}>
            <View style={styles.selectedMetric}>
              <Text style={styles.metricLabel}>언락</Text>
              <Text style={styles.metricValue}>{selectedSummary?.unlockedCount ?? 0}</Text>
            </View>
            <View style={styles.selectedMetric}>
              <Text style={styles.metricLabel}>스냅샷</Text>
              <Text style={styles.metricValue}>{selectedSummary?.snapshotCount ?? 0}</Text>
            </View>
            <View style={styles.selectedMetric}>
              <Text style={styles.metricLabel}>개인 기록</Text>
              <Text style={styles.metricValue}>{selectedSummary?.personalCount ?? 0}</Text>
            </View>
          </View>
          <AppButton label="날짜 상세 열기" onPress={() => router.push(`/calendar/${selectedDate}`)} />
        </SoftCard>

        <SoftCard style={styles.listCard} variant="empty">
          <Text style={styles.listTitle}>최근 하이라이트</Text>
          {summaries.length === 0 ? (
            <Text style={styles.emptyCopy}>아직 캘린더에 표시할 인증이나 스토리 기록이 없습니다.</Text>
          ) : (
            <View style={styles.highlightList}>
              {summaries.slice(0, 4).map((summary) => (
                <Pressable
                  key={summary.date}
                  onPress={() => setSelectedDateState(summary.date)}
                  style={styles.highlightRow}>
                  <View>
                    <Text style={styles.highlightDate}>{formatLifeDayLabel(summary.date)}</Text>
                    <Text style={styles.highlightMeta}>{summary.label || '기록 없음'}</Text>
                  </View>
                  <Ionicons color={colors.text.tertiary} name="chevron-forward" size={18} />
                </Pressable>
              ))}
            </View>
          )}
        </SoftCard>
      </ScrollView>
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
  heroCard: {
    backgroundColor: colors.bg.warm,
    borderColor: colors.line.warm,
    gap: spacing.sm,
  },
  heroEyebrow: {
    color: colors.brand.accent,
    fontSize: 12,
    fontWeight: typography.eyebrow.fontWeight,
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
  calendarCard: {
    backgroundColor: colors.surface.raised,
    borderColor: colors.line.soft,
    gap: spacing.md,
  },
  stateCard: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  stateCopy: {
    color: colors.text.secondary,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    textAlign: 'center',
  },
  calendarHeader: {
    gap: spacing.xs,
  },
  calendarMonth: {
    color: colors.text.primary,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    lineHeight: typography.title.lineHeight,
  },
  calendarLegend: {
    color: colors.text.secondary,
    fontSize: typography.label.fontSize,
    lineHeight: 18,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekLabel: {
    color: colors.text.tertiary,
    flex: 1,
    fontSize: 12,
    fontWeight: typography.label.fontWeight,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  emptyCell: {
    width: '13%',
  },
  dayCell: {
    alignItems: 'center',
    borderRadius: radius.input,
    gap: spacing.xs,
    minHeight: 64,
    paddingVertical: spacing.sm,
    width: '13%',
  },
  dayCellIdle: {
    backgroundColor: colors.surface.secondary,
    borderColor: colors.line.soft,
    borderWidth: 1,
  },
  dayCellSelected: {
    backgroundColor: colors.brand.butterSoft,
    borderColor: colors.brand.accent,
    borderWidth: 2,
  },
  dayLabel: {
    color: colors.text.primary,
    fontSize: typography.label.fontSize,
    fontWeight: typography.bodyStrong.fontWeight,
  },
  dayLabelSelected: {
    color: colors.brand.primary,
  },
  dotRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xxs,
    minHeight: 8,
  },
  unlockDot: {
    backgroundColor: colors.status.success,
    borderRadius: radius.pill,
    height: 8,
    width: 8,
  },
  snapshotDot: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.pill,
    height: 8,
    width: 8,
  },
  selectedCard: {
    backgroundColor: colors.surface.inverse,
    borderColor: colors.brand.accent,
    borderWidth: 2,
    gap: spacing.sm,
  },
  selectedEyebrow: {
    color: colors.brand.butter,
    fontSize: 12,
    fontWeight: typography.eyebrow.fontWeight,
    textTransform: 'uppercase',
  },
  selectedTitle: {
    color: colors.text.inverse,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    lineHeight: typography.title.lineHeight,
  },
  selectedDescription: {
    color: '#E8DCEA',
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  selectedMetrics: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  selectedMetric: {
    backgroundColor: 'rgba(255, 249, 243, 0.12)',
    borderColor: 'rgba(255, 249, 243, 0.16)',
    borderRadius: radius.input,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xxs,
    padding: spacing.md,
  },
  metricLabel: {
    color: '#D8CADF',
    fontSize: 12,
    fontWeight: typography.label.fontWeight,
  },
  metricValue: {
    color: colors.text.inverse,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
  },
  listCard: {
    gap: spacing.sm,
  },
  listTitle: {
    color: colors.text.primary,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    lineHeight: typography.title.lineHeight,
  },
  emptyCopy: {
    color: colors.text.secondary,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  highlightList: {
    gap: spacing.sm,
  },
  highlightRow: {
    alignItems: 'center',
    backgroundColor: colors.surface.secondary,
    borderRadius: radius.input,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  highlightDate: {
    color: colors.text.primary,
    fontSize: typography.body.fontSize,
    fontWeight: typography.bodyStrong.fontWeight,
    lineHeight: typography.body.lineHeight,
  },
  highlightMeta: {
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 16,
  },
});
