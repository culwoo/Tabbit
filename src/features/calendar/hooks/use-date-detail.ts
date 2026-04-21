import { useCallback, useState } from 'react';

import { useFocusEffect } from 'expo-router';

import {
  fetchCertificationsByGroupTag,
  fetchGroupTags,
  fetchGroupThresholdStates,
  fetchMyGroups,
  fetchMyPersonalCertificationRecords,
  fetchStoryCard,
  type CertificationRow,
  type StoryCardRow,
  type ThresholdStateRow,
} from '@/lib/supabase';
import { resolveLifestyleDate } from '@/lib/domain';
import { useAppSession } from '@/providers/app-session-provider';

type CertificationWithUser = CertificationRow & {
  users?: {
    display_name?: string | null;
    id?: string | null;
  } | null;
};

export type GroupCalendarCertification = {
  id: string;
  caption: string;
  contributorName: string;
  imageUrl?: string;
  uploadedAt: string;
};

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
  records: GroupCalendarCertification[];
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

function readCertification(row: unknown) {
  const maybeRow = row as { certifications?: CertificationWithUser | null };
  return maybeRow.certifications ?? null;
}

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
          const threshold = thresholds.find((state) => state.group_tag_id === tag.id);
          if (!threshold) {
            continue;
          }

          const [storyCard, certificationRows] = await Promise.all([
            fetchStoryCard(group.id, tag.id, date),
            fetchCertificationsByGroupTag(group.id, tag.id, date),
          ]);
          const records = certificationRows
            .map(readCertification)
            .filter((certification): certification is CertificationWithUser => Boolean(certification))
            .map((certification) => ({
              caption: certification.caption || '인증',
              contributorName: certification.users?.display_name ?? '멤버',
              id: certification.id,
              imageUrl: certification.image_url,
              uploadedAt: certification.uploaded_at,
            }))
            .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));

          if (records.length === 0 && !storyCard) {
            continue;
          }

          const status = threshold?.status ?? 'locked';
          const isUnlocked = status === 'provisional_unlocked' || status === 'finalized';

          entries.push({
            groupId: group.id,
            tagId: tag.id,
            lifeDay: date,
            groupName: group.name,
            tagLabel: tag.label,
            thresholdState: threshold ?? { status: 'locked' },
            shareProgressLabel: threshold
              ? `인증 ${threshold.certified_member_count}/${threshold.effective_threshold}명`
              : `인증 0/${group.member_limit}명`,
            subtitle: isUnlocked
              ? '열렸습니다. 그룹 스토리를 다시 확인할 수 있어요.'
              : '아직 그룹 스토리가 잠겨 있습니다.',
            shareEnabled: isUnlocked,
            snapshot: storyCard ?? undefined,
            records,
          });
        }
      }

      setGroupEntries(entries.sort((left, right) => left.tagLabel.localeCompare(right.tagLabel, 'ko')));

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
      void loadData();
    }, [loadData]),
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
