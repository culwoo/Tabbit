import { resolveLifeDayMetadata } from './life-day';
import { formatThresholdSummary, resolveEffectiveThreshold } from './thresholds';
import type {
  CertificationDraftResolution,
  CreateCertificationCommand,
  GroupTagDirectoryEntry,
  ImageAssetInput,
  ResolvedGroupShareTarget,
} from './types';

function sanitizeTagBody(label: string) {
  return label.trim().replace(/^#+/, '').replace(/\s+/g, ' ');
}

export function normalizeTagLabel(label: string) {
  return sanitizeTagBody(label).toLocaleLowerCase('ko-KR');
}

export function formatTagLabel(label: string) {
  const body = sanitizeTagBody(label);
  return body ? `#${body}` : '#';
}

export function dedupeTagLabels(labels: readonly string[]) {
  const uniqueLabels = new Map<string, string>();

  labels.forEach((label) => {
    const normalizedLabel = normalizeTagLabel(label);

    if (!normalizedLabel || uniqueLabels.has(normalizedLabel)) {
      return;
    }

    uniqueLabels.set(normalizedLabel, formatTagLabel(label));
  });

  return [...uniqueLabels.values()];
}

export function createCertificationCommand({
  imageAsset,
  caption,
  personalTagLabels,
  groupTagLabels,
}: CreateCertificationCommand): CreateCertificationCommand {
  validateImageAsset(imageAsset);

  return {
    imageAsset,
    caption: caption.trim(),
    personalTagLabels: dedupeTagLabels(personalTagLabels),
    groupTagLabels: dedupeTagLabels(groupTagLabels),
  };
}

export function resolveGroupShareTargets(
  groupTagLabels: readonly string[],
  groupTagDirectory: readonly GroupTagDirectoryEntry[],
): ResolvedGroupShareTarget[] {
  const selectedLabels = new Set(groupTagLabels.map(normalizeTagLabel).filter(Boolean));

  if (selectedLabels.size === 0) {
    return [];
  }

  const targets = new Map<
    string,
    {
      groupId: string;
      groupName: string;
      memberCount: number;
      thresholdRule: GroupTagDirectoryEntry['thresholdRule'];
      matchedEntries: GroupTagDirectoryEntry[];
    }
  >();

  groupTagDirectory.forEach((entry) => {
    const normalizedLabel = entry.normalizedLabel || normalizeTagLabel(entry.label);

    if (!selectedLabels.has(normalizedLabel)) {
      return;
    }

    const existing = targets.get(entry.groupId);

    if (existing) {
      existing.matchedEntries.push({
        ...entry,
        normalizedLabel,
      });
      return;
    }

    targets.set(entry.groupId, {
      groupId: entry.groupId,
      groupName: entry.groupName,
      memberCount: entry.memberCount,
      thresholdRule: entry.thresholdRule,
      matchedEntries: [
        {
          ...entry,
          normalizedLabel,
        },
      ],
    });
  });

  return [...targets.values()]
    .map<ResolvedGroupShareTarget>((target) => {
      const matchedGroupTagLabels = dedupeTagLabels(target.matchedEntries.map((entry) => entry.label));
      const threshold = resolveEffectiveThreshold(target.thresholdRule, target.memberCount);

      return {
        groupId: target.groupId,
        groupName: target.groupName,
        matchedGroupTagIds: target.matchedEntries.map((entry) => entry.groupTagId),
        matchedGroupTagLabels,
        memberCount: target.memberCount,
        thresholdRule: target.thresholdRule,
        threshold,
        thresholdSummary: formatThresholdSummary(target.thresholdRule, target.memberCount),
      };
    })
    .sort((left, right) => left.groupName.localeCompare(right.groupName, 'ko'));
}

export function resolveCertificationDraft({
  command,
  createdAt = new Date().toISOString(),
  groupTagDirectory,
}: {
  command: CreateCertificationCommand;
  createdAt?: string;
  groupTagDirectory: readonly GroupTagDirectoryEntry[];
}): CertificationDraftResolution {
  const normalizedCommand = createCertificationCommand(command);

  return {
    command: normalizedCommand,
    lifeDay: resolveLifeDayMetadata(createdAt),
    resolvedGroupTargets: resolveGroupShareTargets(normalizedCommand.groupTagLabels, groupTagDirectory),
  };
}

function validateImageAsset(imageAsset: ImageAssetInput) {
  if (!imageAsset.uri) {
    throw new Error('imageAsset.uri가 비어 있습니다.');
  }

  if (imageAsset.width <= 0 || imageAsset.height <= 0) {
    throw new Error('imageAsset의 width/height는 0보다 커야 합니다.');
  }
}
