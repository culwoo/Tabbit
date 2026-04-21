import type {
  StoryCardStatus,
  ThresholdComputation,
  ThresholdRule,
  ThresholdStateStatus,
} from './types';

export function resolveEffectiveThreshold(rule: ThresholdRule, eligibleMemberCount: number) {
  if (eligibleMemberCount <= 0) {
    return 0;
  }

  if (eligibleMemberCount <= 2) {
    return eligibleMemberCount;
  }

  switch (rule) {
    case 'ALL':
      return eligibleMemberCount;
    case 'N_MINUS_1':
      return Math.max(1, eligibleMemberCount - 1);
    case 'N_MINUS_2':
      return Math.max(1, eligibleMemberCount - 2);
    default:
      return eligibleMemberCount;
  }
}

export function formatThresholdSummary(rule: ThresholdRule, eligibleMemberCount: number) {
  if (eligibleMemberCount <= 0) {
    return '대상 없음';
  }

  const threshold = resolveEffectiveThreshold(rule, eligibleMemberCount);

  if (threshold === eligibleMemberCount) {
    return '모두 인증';
  }

  return `${threshold}/${eligibleMemberCount}명 인증`;
}

export function countDistinctCertifiedMembers(memberIds: readonly string[]) {
  return new Set(memberIds.filter(Boolean)).size;
}

function resolveThresholdStateStatus(finalized: boolean, meetsThreshold: boolean): ThresholdStateStatus {
  if (finalized) {
    return meetsThreshold ? 'finalized' : 'expired';
  }

  return meetsThreshold ? 'provisional_unlocked' : 'locked';
}

function resolveStoryCardStatus(
  finalized: boolean,
  meetsThreshold: boolean,
  previouslyUnlocked: boolean,
): StoryCardStatus {
  if (finalized) {
    return meetsThreshold ? 'finalized' : 'locked';
  }

  if (meetsThreshold) {
    return 'provisional';
  }

  return previouslyUnlocked ? 'revoked' : 'locked';
}

export function computeThresholdComputation({
  eligibleMemberIds,
  certifiedMemberIds,
  thresholdRule,
  finalized = false,
  previouslyUnlocked = false,
}: {
  eligibleMemberIds: readonly string[];
  certifiedMemberIds: readonly string[];
  thresholdRule: ThresholdRule;
  finalized?: boolean;
  previouslyUnlocked?: boolean;
}): ThresholdComputation {
  const eligibleMemberCount = new Set(eligibleMemberIds.filter(Boolean)).size;
  const certifiedMemberCount = countDistinctCertifiedMembers(certifiedMemberIds);
  const effectiveThreshold = resolveEffectiveThreshold(thresholdRule, eligibleMemberCount);
  const meetsThreshold =
    effectiveThreshold === 0 ? false : certifiedMemberCount >= effectiveThreshold;

  return {
    eligibleMemberCount,
    effectiveThreshold,
    certifiedMemberCount,
    meetsThreshold,
    thresholdStateStatus: resolveThresholdStateStatus(finalized, meetsThreshold),
    storyCardStatus: resolveStoryCardStatus(finalized, meetsThreshold, previouslyUnlocked),
  };
}
