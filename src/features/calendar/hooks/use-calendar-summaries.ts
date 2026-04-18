import { useCallback, useState } from 'react';

import { useFocusEffect } from 'expo-router';

import {
  fetchMyPersonalCertificationRecords,
  fetchMyGroups,
  requireSupabase,
  type ThresholdStateRow,
  type StoryCardRow,
} from '@/lib/supabase';
import { useAppSession } from '@/providers/app-session-provider';

export type CalendarDaySummary = {
  date: string;
  unlockedCount: number;
  snapshotCount: number;
  personalCount: number;
  label: string;
};

export function useCalendarSummaries() {
  const { userId } = useAppSession();
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<CalendarDaySummary[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const db = requireSupabase();
      const [groups, personalRecords] = await Promise.all([
        fetchMyGroups(),
        userId ? fetchMyPersonalCertificationRecords(userId) : Promise.resolve([]),
      ]);
      const groupIds = groups.map((group) => group.id);

      let thresholds: ThresholdStateRow[] = [];
      let storyCards: StoryCardRow[] = [];

      if (groupIds.length > 0) {
        const [{ data: thresholdData, error: thresholdError }, { data: storyCardData, error: storyCardError }] =
          await Promise.all([
            db.from('threshold_states').select('*').in('group_id', groupIds),
            db.from('story_cards').select('*').in('group_id', groupIds),
          ]);

        if (thresholdError) throw thresholdError;
        if (storyCardError) throw storyCardError;

        thresholds = (thresholdData as ThresholdStateRow[]) || [];
        storyCards = (storyCardData as StoryCardRow[]) || [];
      }

      const summaryMap = new Map<string, CalendarDaySummary>();

      function ensureSummary(date: string) {
        if (!summaryMap.has(date)) {
          summaryMap.set(date, {
            date,
            unlockedCount: 0,
            snapshotCount: 0,
            personalCount: 0,
            label: '',
          });
        }
        return summaryMap.get(date)!;
      }

      thresholds.forEach(th => {
        const sm = ensureSummary(th.lifestyle_date);
        if (['provisional_unlocked', 'finalized'].includes(th.status)) {
          sm.unlockedCount += 1;
        }
      });

      storyCards.forEach(sc => {
        if (!['provisional', 'finalized'].includes(sc.status) || !sc.last_snapshot_exported_at) {
          return;
        }

        const sm = ensureSummary(sc.lifestyle_date);
        sm.snapshotCount += 1;
      });

      personalRecords.forEach((record) => {
        const sm = ensureSummary(record.certification.lifestyle_date);
        sm.personalCount += 1;
      });

      summaryMap.forEach((summary) => {
        const pieces = [];
        if (summary.unlockedCount > 0) {
          pieces.push(`언락 ${summary.unlockedCount}`);
        }
        if (summary.snapshotCount > 0) {
          pieces.push(`스냅샷 ${summary.snapshotCount}`);
        }
        if (summary.personalCount > 0) {
          pieces.push(`개인 ${summary.personalCount}`);
        }
        summary.label = pieces.join(' · ');
      });

      const result = [...summaryMap.values()].sort((a, b) => b.date.localeCompare(a.date));
      setSummaries(result);

    } catch (err) {
      console.error('[useCalendarSummaries] error:', err);
      setSummaries([]);
      setErrorMessage(err instanceof Error ? err.message : '캘린더 기록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  return { errorMessage, loading, refresh: loadData, summaries };
}
