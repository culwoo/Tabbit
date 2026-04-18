import { useCallback, useState } from 'react';

import { useFocusEffect } from 'expo-router';

import {
  fetchCertificationsByGroupTag,
  fetchMyGroups,
  fetchGroupTags,
  fetchGroupThresholdStates,
  fetchMyPersonalCertificationRecords,
  fetchStoryCard,
  type ThresholdStateRow,
  type StoryCardRow,
} from '@/lib/supabase';
import { resolveLifestyleDate } from '@/lib/domain';
import { useAppSession } from '@/providers/app-session-provider';

export type DateDetailGroupEntry = {
  groupId: string;
  tagId: string;
  lifeDay: string;

  groupName: string;
  tagLabel: string;

  thresholdState: ThresholdStateRow | { status: 'locked'; unlockedAt?: string };
  shareProgressLabel: string;

  subtitle: string;
  shareEnabled: boolean;
  snapshot?: StoryCardRow;
};

export type PersonalCalendarRecord = {
  id: string;
  date: string;
  title: string;
  summary: string;
  imageUrl?: string;
  uploadedAt: string;
  tagLabels: string[];
};

export function useDateDetail(date: string) {
  const { userId } = useAppSession();
  const [loading, setLoading] = useState(true);

  const [groupEntries, setGroupEntries] = useState<DateDetailGroupEntry[]>([]);
  const [personalRecords, setPersonalRecords] = useState<PersonalCalendarRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const [groups, personalRecordRows] = await Promise.all([
        fetchMyGroups(),
        userId
          ? fetchMyPersonalCertificationRecords(userId, { lifestyleDate: date })
          : Promise.resolve([]),
      ]);

      const entries: DateDetailGroupEntry[] = [];

      for (const group of groups) {
        const [tags, thresholds] = await Promise.all([
          fetchGroupTags(group.id),
          fetchGroupThresholdStates(group.id, date),
        ]);

        for (const tag of tags) {
          const threshold = thresholds.find(t => t.group_tag_id === tag.id);
          if (!threshold) {
            continue;
          }

          const [storyCard, certifications] = await Promise.all([
            fetchStoryCard(group.id, tag.id, date),
            fetchCertificationsByGroupTag(group.id, tag.id, date),
          ]);

          if (certifications.length === 0 && !storyCard) {
            continue;
          }

          const thStatus = threshold?.status ?? 'locked';
          const isUnlocked = thStatus === 'provisional_unlocked' || thStatus === 'finalized';

          entries.push({
            groupId: group.id,
            tagId: tag.id,
            lifeDay: date,
            groupName: group.name,
            tagLabel: tag.label,
            thresholdState: threshold ?? { status: 'locked' },
            shareProgressLabel: threshold ? `인증 ${threshold.certified_member_count}/${threshold.effective_threshold}명` : `인증 0/${group.member_limit}명`,
            subtitle: isUnlocked ? '언락되었습니다. 그룹 스토리를 공유해보세요.' : '아직 그룹 스토리가 잠겨있습니다.',
            shareEnabled: isUnlocked,
            snapshot: storyCard ?? undefined,
          });
        }
      }

      setGroupEntries(entries.sort((a, b) => a.tagLabel.localeCompare(b.tagLabel)));

      setPersonalRecords(
        personalRecordRows.map((record) => {
          const tagLabels = record.personalTags.map((tag) => tag.label);

          return {
            id: record.certification.id,
            date: record.certification.lifestyle_date,
            title: tagLabels.length > 0 ? tagLabels.join(' · ') : '개인공간 기록',
            summary: record.certification.caption || '문구 없이 남긴 인증입니다.',
            imageUrl: record.certification.image_url,
            uploadedAt: record.certification.uploaded_at,
            tagLabels,
          };
        }),
      );

    } catch (err) {
      console.error('[useDateDetail] error:', err);
      setGroupEntries([]);
      setPersonalRecords([]);
      setErrorMessage(err instanceof Error ? err.message : '날짜 상세 기록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [date, userId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  return {
    errorMessage,
    groupEntries,
    loading,
    personalRecords,
    refresh: loadData,
    selectedDate: date || resolveLifestyleDate(new Date()),
  };
}
