import { useCallback, useEffect, useState } from 'react';

import { useFocusEffect } from 'expo-router';

import { resolveLifestyleDate } from '@/lib/domain';
import {
  fetchGroup,
  fetchGroupMembers,
  fetchGroupTags,
  fetchGroupThresholdStates,
  fetchCertificationsByGroupTag,
  fetchStoryCard,
  subscribeToThresholdChanges,
  type GroupRow,
  type GroupMemberRow,
  type ThresholdStateRow,
  type StoryCardRow,
} from '@/lib/supabase';

export type GroupMemberWithCert = {
  memberId: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  role: GroupMemberRow['role'];
  // Certification
  isCertified: boolean;
  caption?: string;
  imageUrl?: string;
  uploadedAt?: string;
};

export type GroupTagEntry = {
  tagId: string;
  tagLabel: string;
  lifeDay: string;
  title: string;
  subtitle: string;

  thresholdState: ThresholdStateRow | { status: 'locked' };

  shareEnabled: boolean;
  shareProgressLabel: string;

  members: GroupMemberWithCert[];
};

export function useGroupDetail(groupId: string, requestedLifeDay?: string) {
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<GroupRow | null>(null);
  const [tagEntries, setTagEntries] = useState<GroupTagEntry[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, StoryCardRow>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const lifeDay = requestedLifeDay ?? resolveLifestyleDate(new Date());

  const loadData = useCallback(async () => {
    if (!groupId) {
      setGroup(null);
      setTagEntries([]);
      setSnapshots({});
      setErrorMessage('그룹 경로가 올바르지 않습니다.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);

      const [groupData, groupMembers, groupTags, thresholds] = await Promise.all([
        fetchGroup(groupId),
        fetchGroupMembers(groupId),
        fetchGroupTags(groupId),
        fetchGroupThresholdStates(groupId, lifeDay),
      ]);

      setGroup(groupData);

      const entries: GroupTagEntry[] = [];
      const snaps: Record<string, StoryCardRow> = {};

      for (const tag of groupTags) {
        // Fetch matching threshold
        const threshold = thresholds.find(t => t.group_tag_id === tag.id);

        // Fetch certifications for this tag on this date
        const certs = await fetchCertificationsByGroupTag(groupId, tag.id, lifeDay);

        // Map members + certs
        const membersWithCerts: GroupMemberWithCert[] = groupMembers.map(m => {
          const user = (m.users as any);
          const certItem = certs.find(c => (c.certifications as any).user_id === user.id);
          const cert = certItem?.certifications as any;

          return {
            memberId: user.id,
            displayName: user.display_name,
            handle: user.handle ?? '@user',
            avatarUrl: user.avatar_url,
            role: m.role,
            isCertified: !!cert,
            caption: cert?.caption,
            imageUrl: cert?.image_url,
            uploadedAt: cert?.uploaded_at,
          };
        });

        const thStatus = threshold?.status ?? 'locked';
        const isUnlocked = thStatus === 'provisional_unlocked' || thStatus === 'finalized';

        const certCount = membersWithCerts.filter(m => m.isCertified).length;
        const requiredCount = threshold?.effective_threshold ?? groupData.member_limit;

        // Fetch Snapshot (StoryCard)
        const storyCard = await fetchStoryCard(groupId, tag.id, lifeDay);
        if (storyCard) {
          snaps[tag.id] = storyCard;
        }

        entries.push({
          tagId: tag.id,
          tagLabel: tag.label,
          lifeDay,
          title: tag.label,
          subtitle: isUnlocked ? '언락되었습니다. 그룹 스토리를 공유해보세요.' : '아직 그룹 스토리가 잠겨있습니다.',
          thresholdState: threshold ?? { status: 'locked' },
          shareEnabled: isUnlocked,
          shareProgressLabel: `인증 ${certCount}/${requiredCount}명`,
          members: membersWithCerts,
        });
      }

      setTagEntries(entries);
      setSnapshots(snaps);

    } catch (err) {
      console.error('[useGroupDetail] Error:', err);
      setGroup(null);
      setTagEntries([]);
      setSnapshots({});
      setErrorMessage(err instanceof Error ? err.message : '그룹 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [groupId, lifeDay]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    if (!groupId) {
      return undefined;
    }

    return subscribeToThresholdChanges(groupId, (state) => {
      if (state.lifestyle_date === lifeDay) {
        void loadData();
      }
    });
  }, [groupId, lifeDay, loadData]);

  return {
    errorMessage,
    loading,
    group,
    tagEntries,
    snapshots,
    lifeDay,
    refresh: loadData,
  };
}
