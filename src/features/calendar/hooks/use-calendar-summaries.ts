import { useCallback, useState } from 'react';

import { useFocusEffect } from 'expo-router';

import {
  fetchGroupTags,
  fetchMyGroups,
  fetchMyPersonalCertificationRecords,
  requireSupabase,
  type StoryCardRow,
  type ThresholdStateRow,
} from '@/lib/supabase';
import { useAppSession } from '@/providers/app-session-provider';

export type CalendarDayPreview = {
  id: string;
  caption: string;
  imageUrl?: string | null;
  kind: 'group' | 'personal';
  tagLabel: string;
};

export type CalendarDaySummary = {
  date: string;
  unlockedCount: number;
  snapshotCount: number;
  personalCount: number;
  label: string;
  entries: CalendarDayPreview[];
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
      const groupNameById = new Map(groups.map((group) => [group.id, group.name]));
      const tagLabelById = new Map<string, string>();

      if (groupIds.length > 0) {
        await Promise.all(
          groups.map(async (group) => {
            const tags = await fetchGroupTags(group.id);
            tags.forEach((tag) => tagLabelById.set(tag.id, tag.label));
          }),
        );
      }

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
            entries: [],
          });
        }
        return summaryMap.get(date)!;
      }

      thresholds.forEach((threshold) => {
        const summary = ensureSummary(threshold.lifestyle_date);

        if (['provisional_unlocked', 'finalized'].includes(threshold.status)) {
          summary.unlockedCount += 1;
          summary.entries.push({
            id: `threshold-${threshold.id}`,
            caption: `${groupNameById.get(threshold.group_id) ?? '그룹'}에서 열렸어요`,
            kind: 'group',
            tagLabel: tagLabelById.get(threshold.group_tag_id) ?? '그룹 태그',
          });
        }
      });

      storyCards.forEach((storyCard) => {
        if (!['provisional', 'finalized'].includes(storyCard.status) || !storyCard.last_snapshot_exported_at) {
          return;
        }

        const summary = ensureSummary(storyCard.lifestyle_date);
        summary.snapshotCount += 1;
        summary.entries.push({
          id: `story-${storyCard.id}`,
          caption: `${groupNameById.get(storyCard.group_id) ?? '그룹'} 스토리`,
          imageUrl: storyCard.last_snapshot_image_uri,
          kind: 'group',
          tagLabel: tagLabelById.get(storyCard.group_tag_id) ?? '스토리',
        });
      });

      personalRecords.forEach((record) => {
        const summary = ensureSummary(record.certification.lifestyle_date);
        const tagLabel = record.personalTags[0]?.label ?? '개인 기록';

        summary.personalCount += 1;
        summary.entries.push({
          id: `personal-${record.certification.id}`,
          caption: record.certification.caption || '인증',
          imageUrl: record.certification.image_url,
          kind: 'personal',
          tagLabel,
        });
      });

      summaryMap.forEach((summary) => {
        const pieces = [];
        if (summary.unlockedCount > 0) {
          pieces.push(`언락 ${summary.unlockedCount}`);
        }
        if (summary.snapshotCount > 0) {
          pieces.push(`스토리 ${summary.snapshotCount}`);
        }
        if (summary.personalCount > 0) {
          pieces.push(`개인 ${summary.personalCount}`);
        }
        summary.label = pieces.join(' · ');
        summary.entries = summary.entries.slice(0, 6);
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
      void loadData();
    }, [loadData]),
  );

  return { errorMessage, loading, refresh: loadData, summaries };
}
