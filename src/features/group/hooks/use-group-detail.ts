import { useCallback, useEffect, useRef, useState } from 'react';

import { useFocusEffect } from 'expo-router';

import { resolveEffectiveThreshold, resolveLifestyleDate } from '@/lib/domain';
import {
  fetchCertificationsByGroupTag,
  fetchGroup,
  fetchGroupMembers,
  fetchGroupTags,
  fetchGroupThresholdStates,
  fetchStoryCard,
  subscribeToThresholdChanges,
  type GroupMemberRow,
  type GroupRow,
  type StoryCardRow,
  type ThresholdStateRow,
} from '@/lib/supabase';

export type GroupMemberWithCert = {
  memberId: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  role: GroupMemberRow['role'];
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

function resolveRequiredCount({
  certifiedCount,
  group,
  memberCount,
  threshold,
}: {
  certifiedCount: number;
  group: GroupRow;
  memberCount: number;
  threshold?: ThresholdStateRow | null;
}) {
  if (threshold?.effective_threshold && threshold.effective_threshold > 0) {
    return threshold.effective_threshold;
  }

  const computed = resolveEffectiveThreshold(group.threshold_rule, memberCount);

  if (computed > 0) {
    return computed;
  }

  return certifiedCount > 0 ? Math.max(1, certifiedCount) : Math.max(1, memberCount);
}

function readUserFromMember(member: Awaited<ReturnType<typeof fetchGroupMembers>>[number]) {
  return member.users as unknown as {
    id: string;
    display_name: string;
    handle: string | null;
    avatar_url: string | null;
  };
}

function readCertificationFromShareTarget(
  shareTarget: Awaited<ReturnType<typeof fetchCertificationsByGroupTag>>[number],
) {
  return shareTarget.certifications as
    | {
        user_id: string;
        caption?: string;
        image_url?: string;
        uploaded_at?: string;
      }
    | null
    | undefined;
}

export function useGroupDetail(groupId: string, requestedLifeDay?: string) {
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<GroupRow | null>(null);
  const [tagEntries, setTagEntries] = useState<GroupTagEntry[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, StoryCardRow>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

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
      setLoading(!hasLoadedRef.current);
      setErrorMessage(null);

      const [groupData, groupMembers, groupTags, thresholds] = await Promise.all([
        fetchGroup(groupId),
        fetchGroupMembers(groupId),
        fetchGroupTags(groupId),
        fetchGroupThresholdStates(groupId, lifeDay),
      ]);

      setGroup(groupData);

      const entries: GroupTagEntry[] = [];
      const nextSnapshots: Record<string, StoryCardRow> = {};

      for (const tag of groupTags) {
        const threshold = thresholds.find((item) => item.group_tag_id === tag.id);
        const certs = await fetchCertificationsByGroupTag(groupId, tag.id, lifeDay);

        const membersWithCerts: GroupMemberWithCert[] = groupMembers.map((member) => {
          const user = readUserFromMember(member);
          const certItem = certs.find(
            (item) => readCertificationFromShareTarget(item)?.user_id === user.id,
          );
          const cert = certItem ? readCertificationFromShareTarget(certItem) : null;

          return {
            avatarUrl: user.avatar_url,
            caption: cert?.caption,
            displayName: user.display_name,
            handle: user.handle ?? '@user',
            imageUrl: cert?.image_url,
            isCertified: Boolean(cert),
            memberId: user.id,
            role: member.role,
            uploadedAt: cert?.uploaded_at,
          };
        });

        const certCount = membersWithCerts.filter((member) => member.isCertified).length;
        const requiredCount = resolveRequiredCount({
          certifiedCount: certCount,
          group: groupData,
          memberCount: membersWithCerts.length,
          threshold,
        });
        const thresholdStatus = threshold?.status ?? 'locked';
        const isUnlockedByServer =
          thresholdStatus === 'provisional_unlocked' || thresholdStatus === 'finalized';
        const isUnlockedByCurrentCerts =
          thresholdStatus !== 'expired' && requiredCount > 0 && certCount >= requiredCount;
        const isUnlocked = isUnlockedByServer || isUnlockedByCurrentCerts;

        const storyCard = await fetchStoryCard(groupId, tag.id, lifeDay);
        if (storyCard) {
          nextSnapshots[tag.id] = storyCard;
        }

        entries.push({
          lifeDay,
          members: membersWithCerts,
          shareEnabled: isUnlocked,
          shareProgressLabel: `인증 ${certCount}/${requiredCount}명`,
          subtitle: isUnlocked
            ? '열렸어요. 그룹 스토리를 공유해보세요.'
            : '아직 그룹 스토리가 열리지 않았습니다.',
          tagId: tag.id,
          tagLabel: tag.label,
          thresholdState: threshold ?? { status: 'locked' },
          title: tag.label,
        });
      }

      setTagEntries(entries);
      setSnapshots(nextSnapshots);
    } catch (error) {
      console.error('[useGroupDetail] Error:', error);
      setGroup(null);
      setTagEntries([]);
      setSnapshots({});
      setErrorMessage(
        error instanceof Error ? error.message : '그룹 데이터를 불러오지 못했습니다.',
      );
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
    }
  }, [groupId, lifeDay]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
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
    group,
    lifeDay,
    loading,
    refresh: loadData,
    snapshots,
    tagEntries,
  };
}
