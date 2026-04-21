import * as ImagePicker from 'expo-image-picker';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';

import {
  formatTagLabel,
  normalizeTagLabel,
  resolveCertificationDraft,
  resolveGroupShareTargets,
  type GroupTagDirectoryEntry,
} from '@/lib/domain';
import {
  addPersonalTag,
  fetchActiveGroupMemberCounts,
  fetchGroupTags,
  fetchMyGroups,
  fetchPersonalTags,
  requireSupabase,
  syncGroupTagsToPersonalTags,
  uploadCertification,
  type PersonalTagRow,
} from '@/lib/supabase';
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

type SubmitCertificationError = Error & {
  code?: UploadErrorCode;
  details?: string;
  hint?: string;
  originalCode?: string;
  phase?: UploadProgressPhase;
  statusCode?: string;
  uploadStage?: string;
};

const failedSubmissionKeys = new Set<string>();
const PERSONAL_TAG_ID_PREFIX = 'personal:';

function createSubmissionKey(draft: CaptureDraft) {
  const sortedTags = [...draft.selectedTagIds].sort().join('|');
  const disabledGroups = [...draft.disabledGroupIds].sort().join('|');
  return `${draft.asset?.uri ?? 'no-asset'}::${draft.caption.trim()}::${sortedTags}::${disabledGroups}`;
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
    base64: asset.base64 ?? null,
  };
}

export function createPersonalCaptureTagId(personalTagId: string) {
  return `${PERSONAL_TAG_ID_PREFIX}${personalTagId}`;
}

function isPersonalCaptureTagId(tagId: string) {
  return tagId.startsWith(PERSONAL_TAG_ID_PREFIX);
}

function getPersonalTagIdFromCaptureTagId(tagId: string) {
  return isPersonalCaptureTagId(tagId) ? tagId.slice(PERSONAL_TAG_ID_PREFIX.length) : null;
}

function getSelectedGroupTagLabels(tagIds: readonly string[]) {
  return tagIds.filter((tagId) => !isPersonalCaptureTagId(tagId));
}

function resolveSelectedPersonalTags(
  tagIds: readonly string[],
  personalTags: readonly PersonalTagRow[],
) {
  const selectedGroupLabels = new Set(
    getSelectedGroupTagLabels(tagIds).map(normalizeTagLabel).filter(Boolean),
  );
  const selectedIds = new Set(
    tagIds
      .map(getPersonalTagIdFromCaptureTagId)
      .filter((tagId): tagId is string => Boolean(tagId)),
  );

  return personalTags.filter(
    (tag) => selectedIds.has(tag.id) || selectedGroupLabels.has(tag.normalized_label),
  );
}

const uploadErrorCodes = new Set<UploadErrorCode>([
  'AUTH_REQUIRED',
  'MISSING_ASSET',
  'NO_TAGS',
  'NO_TARGETS',
  'PERMISSION_DENIED',
  'IMAGE_PROCESSING_ERROR',
  'IMAGE_READ_ERROR',
  'STORAGE_UPLOAD_ERROR',
  'DATABASE_ERROR',
  'SUPABASE_CONFIG_ERROR',
  'NETWORK_ERROR',
  'UNKNOWN',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readErrorField(error: unknown, field: string) {
  if (!isRecord(error)) {
    return null;
  }

  const value = error[field];

  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  return null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return (
    readErrorField(error, 'message') ??
    readErrorField(error, 'error_description') ??
    readErrorField(error, 'error') ??
    '업로드를 완료하지 못했습니다.'
  );
}

function stringifyUnknownError(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function mapUploadStageToCode(uploadStage: string | null): UploadErrorCode | null {
  switch (uploadStage) {
    case 'readImage':
      return 'IMAGE_READ_ERROR';
    case 'storageUpload':
      return 'STORAGE_UPLOAD_ERROR';
    case 'saveCertification':
      return 'DATABASE_ERROR';
    default:
      return null;
  }
}

function mapUploadStageToPhase(uploadStage: string | null): UploadProgressPhase | null {
  switch (uploadStage) {
    case 'readImage':
    case 'storageUpload':
      return 'uploadMedia';
    case 'saveCertification':
      return 'saveCertification/shareTargets';
    default:
      return null;
  }
}

function inferSubmitErrorCode(error: unknown, message: string): UploadErrorCode {
  const existingCode = readErrorField(error, 'code');
  const uploadStage = readErrorField(error, 'uploadStage');
  const stageCode = mapUploadStageToCode(uploadStage);
  const statusCode = readErrorField(error, 'statusCode') ?? readErrorField(error, 'status');
  const haystack = [
    message,
    existingCode,
    statusCode,
    readErrorField(error, 'details'),
    readErrorField(error, 'hint'),
    readErrorField(error, 'name'),
    readErrorField(error, 'error'),
  ]
    .filter(Boolean)
    .join(' ');

  if (stageCode) {
    return stageCode;
  }

  if (existingCode && uploadErrorCodes.has(existingCode as UploadErrorCode)) {
    return existingCode as UploadErrorCode;
  }

  if (/Supabase 환경변수|missing Supabase|supabase.*env/i.test(haystack)) {
    return 'SUPABASE_CONFIG_ERROR';
  }

  if (/network|fetch|timeout|offline/i.test(haystack)) {
    return 'NETWORK_ERROR';
  }

  if (/storage|bucket|object|mime|upload|statusCode/i.test(haystack) || statusCode) {
    return 'STORAGE_UPLOAD_ERROR';
  }

  if (/row-level|rls|policy|violates|constraint|relation|column|PGRST|42501|235\d\d|42P01/i.test(haystack)) {
    return 'DATABASE_ERROR';
  }

  return 'UNKNOWN';
}

function createError(
  code: UploadErrorCode,
  message: string,
  details?: string,
  phase?: UploadProgressPhase,
): SubmitCertificationError {
  const error = new Error(message) as SubmitCertificationError;
  error.code = code;
  error.details = details;
  error.phase = phase;
  return error;
}

async function resolveAuthenticatedUploadUserId(expectedUserId: string) {
  const client = requireSupabase();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();

  if (sessionError) {
    throw createError(
      'AUTH_REQUIRED',
      'Supabase 세션을 확인하지 못했습니다. 다시 로그인한 뒤 인증을 공유해 주세요.',
      `expectedUserId: ${expectedUserId}\nsessionError: ${stringifyUnknownError(sessionError)}`,
      'prepareUpload',
    );
  }

  const sessionUserId = sessionData.session?.user.id ?? null;
  const { data: userData, error: userError } = await client.auth.getUser();
  const verifiedUserId = userData.user?.id ?? null;

  if (userError || !verifiedUserId) {
    throw createError(
      'AUTH_REQUIRED',
      'Supabase 인증 세션이 만료됐습니다. 로그아웃 후 다시 로그인해 주세요.',
      [
        `expectedUserId: ${expectedUserId}`,
        `sessionUserId: ${sessionUserId ?? 'null'}`,
        userError ? `userError: ${stringifyUnknownError(userError)}` : null,
      ]
        .filter((line): line is string => Boolean(line))
        .join('\n'),
      'prepareUpload',
    );
  }

  if (verifiedUserId !== expectedUserId) {
    throw createError(
      'AUTH_REQUIRED',
      '앱 세션과 Supabase 인증 세션이 서로 다릅니다. 로그아웃 후 다시 로그인해 주세요.',
      [
        `expectedUserId: ${expectedUserId}`,
        `sessionUserId: ${sessionUserId ?? 'null'}`,
        `verifiedUserId: ${verifiedUserId}`,
      ].join('\n'),
      'prepareUpload',
    );
  }

  return verifiedUserId;
}

function normalizeSubmitError(error: unknown): SubmitCertificationError {
  if (error instanceof Error && uploadErrorCodes.has(readErrorField(error, 'code') as UploadErrorCode)) {
    return error as SubmitCertificationError;
  }

  const message = getErrorMessage(error);
  const uploadStage = readErrorField(error, 'uploadStage');
  const statusCode = readErrorField(error, 'statusCode') ?? readErrorField(error, 'status');
  const originalCode = readErrorField(error, 'originalCode') ?? readErrorField(error, 'code');
  const hint = readErrorField(error, 'hint');
  const detailLines = [
    readErrorField(error, 'details'),
    hint ? `hint: ${hint}` : null,
    statusCode ? `statusCode: ${statusCode}` : null,
    originalCode ? `originalCode: ${originalCode}` : null,
    uploadStage ? `uploadStage: ${uploadStage}` : null,
    `raw: ${stringifyUnknownError(error)}`,
  ].filter((line): line is string => Boolean(line));
  const normalizedError = createError(
    inferSubmitErrorCode(error, message),
    message,
    detailLines.join('\n'),
    mapUploadStageToPhase(uploadStage) ?? undefined,
  );
  normalizedError.hint = hint ?? undefined;
  normalizedError.originalCode = originalCode ?? undefined;
  normalizedError.statusCode = statusCode ?? undefined;
  normalizedError.uploadStage = uploadStage ?? undefined;

  return normalizedError;
}

function notifyPhase(
  options: SubmitCertificationOptions | undefined,
  phase: UploadProgressPhase,
) {
  options?.onPhaseChange?.(phase);
}

export async function fetchCaptureTagDirectory(): Promise<GroupTagDirectoryEntry[]> {
  const groups = await fetchMyGroups();
  const groupIds = groups.map((group) => group.id);
  const memberCounts = await fetchActiveGroupMemberCounts(groupIds);

  const nestedEntries = await Promise.all(
    groups.map(async (group) => {
      const tags = await fetchGroupTags(group.id);
      const memberCount = memberCounts.get(group.id) ?? 0;

      return tags.map((tag): GroupTagDirectoryEntry => ({
        groupId: group.id,
        groupName: group.name,
        groupTagId: tag.id,
        label: formatTagLabel(tag.label),
        normalizedLabel: tag.normalized_label || normalizeTagLabel(tag.label),
        memberCount,
        thresholdRule: group.threshold_rule,
      }));
    }),
  );

  return nestedEntries.flat();
}

export async function fetchCapturePersonalTags(userId?: string | null) {
  if (userId) {
    return syncGroupTagsToPersonalTags(userId);
  }

  return fetchPersonalTags();
}

export async function createCapturePersonalTag(userId: string, label: string) {
  return addPersonalTag(userId, label);
}

export function getAvailableCaptureTagsFromDirectory(
  groupTagDirectory: readonly GroupTagDirectoryEntry[],
  personalTags: readonly PersonalTagRow[] = [],
): CaptureTagOption[] {
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
      kind: 'group',
      connectedGroupCount: 1,
    });
  }

  const groupOptions = [...tagMap.values()].sort((left, right) => {
    if (right.connectedGroupCount !== left.connectedGroupCount) {
      return right.connectedGroupCount - left.connectedGroupCount;
    }

    return left.label.localeCompare(right.label, 'ko');
  });

  const personalOptions = personalTags
    .map((tag): CaptureTagOption | null => {
      const normalizedLabel = tag.normalized_label || normalizeTagLabel(tag.label);
      const groupOption = tagMap.get(normalizedLabel);

      if (groupOption) {
        groupOption.personalTagId = tag.id;
        return null;
      }

      return {
        id: createPersonalCaptureTagId(tag.id),
        label: formatTagLabel(tag.label),
        kind: 'personal',
        connectedGroupCount: 0,
        personalTagId: tag.id,
      };
    })
    .filter((tag): tag is CaptureTagOption => Boolean(tag))
    .sort((left, right) => left.label.localeCompare(right.label, 'ko'));

  return [...groupOptions, ...personalOptions];
}

export function resolveShareTargets(
  tagIds: string[],
  groupTagDirectory: readonly GroupTagDirectoryEntry[],
): ResolvedShareTarget[] {
  return resolveGroupShareTargets(getSelectedGroupTagLabels(tagIds), groupTagDirectory);
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
  userId: string | null,
  draft: CaptureDraft,
  groupTagDirectory: readonly GroupTagDirectoryEntry[],
  personalTags: readonly PersonalTagRow[],
  options?: SubmitCertificationOptions,
): Promise<CompletedUploadSummary> {
  if (!userId) {
    throw createError('AUTH_REQUIRED', '로그인이 필요합니다. 다시 로그인한 뒤 인증을 공유해 주세요.');
  }

  const authenticatedUserId = await resolveAuthenticatedUploadUserId(userId);

  if (!draft.asset) {
    throw createError('MISSING_ASSET', '공유할 사진이 없습니다.');
  }

  if (draft.selectedTagIds.length === 0) {
    throw createError('NO_TAGS', '최소 1개 태그를 선택해야 합니다.');
  }

  const submissionKey = createSubmissionKey(draft);
  const selectedGroupTagLabels = getSelectedGroupTagLabels(draft.selectedTagIds);
  const selectedPersonalTags = resolveSelectedPersonalTags(draft.selectedTagIds, personalTags);

  if (selectedGroupTagLabels.length === 0 && selectedPersonalTags.length === 0) {
    throw createError('NO_TARGETS', '개인공간에 저장할 태그 또는 그룹에 연결된 태그가 필요합니다.');
  }

  notifyPhase(options, 'prepareUpload');

  const resizeWidth = draft.asset.width > 1600 ? 1600 : draft.asset.width;
  const normalizedImage = await manipulateAsync(
    draft.asset.uri,
    resizeWidth !== draft.asset.width ? [{ resize: { width: resizeWidth } }] : [],
    {
      base64: true,
      compress: 0.78,
      format: SaveFormat.JPEG,
    },
  ).catch((error) => {
    throw createError(
      'IMAGE_PROCESSING_ERROR',
      '이미지를 업로드용 JPEG로 변환하지 못했습니다.',
      `raw: ${stringifyUnknownError(error)}`,
      'prepareUpload',
    );
  });
  const uploadAsset: CaptureAsset = {
    ...draft.asset,
    uri: normalizedImage.uri,
    width: normalizedImage.width,
    height: normalizedImage.height,
    mimeType: 'image/jpeg',
    base64: normalizedImage.base64 ?? null,
  };

  notifyPhase(options, 'uploadMedia');

  if (options?.simulateFailureOnce && !failedSubmissionKeys.has(submissionKey)) {
    failedSubmissionKeys.add(submissionKey);
    throw createError('NETWORK_ERROR', '네트워크가 불안정해서 업로드를 완료하지 못했습니다.');
  }

  const createdAt = new Date().toISOString();
  const draftResolution = resolveCertificationDraft({
    command: {
      imageAsset: uploadAsset,
      caption: draft.caption,
      personalTagLabels: selectedPersonalTags.map((tag) => tag.label),
      groupTagLabels: selectedGroupTagLabels,
    },
    createdAt,
    groupTagDirectory,
  });

  if (draftResolution.resolvedGroupTargets.length === 0 && selectedPersonalTags.length === 0) {
    throw createError('NO_TARGETS', '선택한 태그와 연결된 그룹이 없습니다.');
  }

  const disabledGroupIds = new Set(draft.disabledGroupIds);
  const activeGroupTargets = draftResolution.resolvedGroupTargets.filter(
    (target) => !disabledGroupIds.has(target.groupId),
  );

  if (activeGroupTargets.length === 0 && selectedPersonalTags.length === 0) {
    throw createError('NO_TARGETS', '선택한 태그를 저장할 개인공간이나 공유할 그룹이 없습니다.');
  }

  const groupShareTargets = activeGroupTargets.flatMap((target) =>
    target.matchedGroupTagIds.map((groupTagId) => ({
      groupId: target.groupId,
      groupTagId,
    })),
  );

  const cert = await uploadCertification(
    {
      userId: authenticatedUserId,
      imageUri: uploadAsset.uri,
      imageBase64: uploadAsset.base64,
      imageWidth: uploadAsset.width,
      imageHeight: uploadAsset.height,
      caption: draftResolution.command.caption,
      lifestyleDate: draftResolution.lifeDay.lifestyleDate,
      editableUntil: draftResolution.lifeDay.editableUntil,
      personalTagIds: selectedPersonalTags.map((tag) => tag.id),
      groupShareTargets,
    },
    {
      onStorageUploaded: () => {
        notifyPhase(options, 'saveCertification/shareTargets');
      },
    },
  ).catch((error) => {
    throw normalizeSubmitError(error);
  });

  const completedUpload: CompletedUploadSummary = {
    certificationId: cert.id,
    imageUri: uploadAsset.uri,
    caption: draftResolution.command.caption,
    selectedTagIds: [...draft.selectedTagIds],
    personalTagLabels: draftResolution.command.personalTagLabels,
    groupTagLabels: draftResolution.command.groupTagLabels,
    lifestyleDate: cert.lifestyle_date,
    editableUntil: cert.editable_until,
    completedGroupCount: activeGroupTargets.length,
    targets: activeGroupTargets,
    createdAt: cert.uploaded_at,
    command: draftResolution.command,
  };

  return completedUpload;
}
