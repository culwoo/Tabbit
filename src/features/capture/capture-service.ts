import * as ImagePicker from 'expo-image-picker';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';

import {
  formatTagLabel,
  normalizeTagLabel,
  resolveCertificationDraft,
  resolveGroupShareTargets,
  type GroupTagDirectoryEntry,
  type ThresholdRule,
} from '@/lib/domain';
import type {
  AcquireMediaResult,
  CaptureAsset,
  CaptureDraft,
  CaptureTagOption,
  CompletedUploadSummary,
  MediaPermissionState,
  MediaSource,
  ResolvedShareTarget,
  SubmitCertificationOptions,
  UploadErrorCode,
  UploadProgressPhase,
} from '@/features/capture/types';

type CaptureGroup = {
  id: string;
  name: string;
  memberCount: number;
  thresholdRule: ThresholdRule;
  tags: string[];
};

type SubmitCertificationError = Error & {
  code?: UploadErrorCode;
};

const captureGroups: CaptureGroup[] = [
  {
    id: 'focus-club',
    name: '새벽 운동팟',
    memberCount: 4,
    thresholdRule: 'N_MINUS_1',
    tags: ['#운동', '#아침루틴', '#헬스'],
  },
  {
    id: 'study-room',
    name: '집중 공부방',
    memberCount: 5,
    thresholdRule: 'N_MINUS_1',
    tags: ['#공부', '#아침루틴', '#독서'],
  },
  {
    id: 'wallet-keepers',
    name: '무지출 지킴이',
    memberCount: 6,
    thresholdRule: 'N_MINUS_1',
    tags: ['#무지출', '#집밥', '#기록'],
  },
  {
    id: 'after-work-club',
    name: '퇴근 후 루틴',
    memberCount: 4,
    thresholdRule: 'ALL',
    tags: ['#운동', '#기록', '#스트레칭'],
  },
];

const groupTagDirectory: GroupTagDirectoryEntry[] = captureGroups.flatMap((group) =>
  group.tags.map((tagLabel) => {
    const normalizedLabel = normalizeTagLabel(tagLabel);

    return {
      groupId: group.id,
      groupName: group.name,
      groupTagId: `${group.id}:${normalizedLabel}`,
      label: formatTagLabel(tagLabel),
      normalizedLabel,
      memberCount: group.memberCount,
      thresholdRule: group.thresholdRule,
    };
  }),
);

const storedSubmissions = new Map<string, CompletedUploadSummary>();
const failedSubmissionKeys = new Set<string>();

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createSubmissionKey(draft: CaptureDraft) {
  const sortedTags = [...draft.selectedTagIds].sort().join('|');
  return `${draft.asset?.uri ?? 'no-asset'}::${draft.caption.trim()}::${sortedTags}`;
}

function toPermissionState(
  source: MediaSource,
  permission: Awaited<ReturnType<typeof ImagePicker.requestCameraPermissionsAsync>>,
): MediaPermissionState {
  return {
    source,
    granted: permission.granted,
    canAskAgain: permission.canAskAgain,
    lastCheckedAt: new Date().toISOString(),
  };
}

function normalizeAsset(asset: ImagePicker.ImagePickerAsset): CaptureAsset {
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    fileName: asset.fileName ?? null,
    fileSize: asset.fileSize ?? null,
    mimeType: asset.mimeType ?? null,
  };
}

function createError(code: UploadErrorCode, message: string): SubmitCertificationError {
  const error = new Error(message) as SubmitCertificationError;
  error.code = code;
  return error;
}

function notifyPhase(
  options: SubmitCertificationOptions | undefined,
  phase: UploadProgressPhase,
) {
  options?.onPhaseChange?.(phase);
}

export function getAvailableCaptureTags(): CaptureTagOption[] {
  const tagMap = new Map<string, CaptureTagOption>();

  for (const tag of groupTagDirectory) {
    const existing = tagMap.get(tag.normalizedLabel);

    if (existing) {
      existing.connectedGroupCount += 1;
      continue;
    }

    tagMap.set(tag.normalizedLabel, {
      id: tag.normalizedLabel,
      label: tag.label,
      connectedGroupCount: 1,
    });
  }

  return [...tagMap.values()].sort((left, right) => {
    if (right.connectedGroupCount !== left.connectedGroupCount) {
      return right.connectedGroupCount - left.connectedGroupCount;
    }

    return left.label.localeCompare(right.label, 'ko');
  });
}

export function resolveShareTargets(tagIds: string[]): ResolvedShareTarget[] {
  return resolveGroupShareTargets(tagIds, groupTagDirectory);
}

export async function requestPermission(source: MediaSource): Promise<MediaPermissionState> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  return toPermissionState(source, permission);
}

export async function acquireMedia(source: MediaSource): Promise<AcquireMediaResult> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
  };

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || !result.assets?.length) {
    return { status: 'cancelled' };
  }

  return {
    status: 'success',
    asset: normalizeAsset(result.assets[0]),
  };
}

export async function submitCertification(
  draft: CaptureDraft,
  options?: SubmitCertificationOptions,
): Promise<CompletedUploadSummary> {
  if (!draft.asset) {
    throw createError('MISSING_ASSET', '공유할 사진이 없습니다.');
  }

  if (draft.selectedTagIds.length === 0) {
    throw createError('NO_TAGS', '최소 1개 태그를 선택해야 합니다.');
  }

  if (draft.resolvedTargets.length === 0) {
    throw createError('NO_TARGETS', '선택한 태그와 연결된 그룹이 없습니다.');
  }

  const submissionKey = createSubmissionKey(draft);
  const existing = storedSubmissions.get(submissionKey);

  if (existing) {
    return existing;
  }

  notifyPhase(options, 'prepareUpload');
  await wait(300);

  const resizeWidth = draft.asset.width > 1600 ? 1600 : draft.asset.width;
  const normalizedImage = await manipulateAsync(
    draft.asset.uri,
    resizeWidth !== draft.asset.width ? [{ resize: { width: resizeWidth } }] : [],
    {
      compress: 0.78,
      format: SaveFormat.JPEG,
    },
  );

  notifyPhase(options, 'uploadMedia');
  await wait(550);

  if (options?.simulateFailureOnce && !failedSubmissionKeys.has(submissionKey)) {
    failedSubmissionKeys.add(submissionKey);
    throw createError('NETWORK_ERROR', '네트워크가 불안정해서 업로드를 완료하지 못했습니다.');
  }

  notifyPhase(options, 'saveCertification/shareTargets');
  await wait(350);

  const createdAt = new Date().toISOString();
  const draftResolution = resolveCertificationDraft({
    command: {
      imageAsset: draft.asset,
      caption: draft.caption,
      personalTagLabels: [],
      groupTagLabels: draft.selectedTagIds,
    },
    createdAt,
    groupTagDirectory,
  });

  if (draftResolution.resolvedGroupTargets.length === 0) {
    throw createError('NO_TARGETS', '선택한 태그와 연결된 그룹이 없습니다.');
  }

  const completedUpload: CompletedUploadSummary = {
    certificationId: `cert-${Date.now()}`,
    imageUri: normalizedImage.uri,
    caption: draftResolution.command.caption,
    selectedTagIds: [...draft.selectedTagIds],
    personalTagLabels: draftResolution.command.personalTagLabels,
    groupTagLabels: draftResolution.command.groupTagLabels,
    lifestyleDate: draftResolution.lifeDay.lifestyleDate,
    editableUntil: draftResolution.lifeDay.editableUntil,
    completedGroupCount: draftResolution.resolvedGroupTargets.length,
    targets: draftResolution.resolvedGroupTargets,
    createdAt,
    command: draftResolution.command,
  };

  storedSubmissions.set(submissionKey, completedUpload);

  return completedUpload;
}
