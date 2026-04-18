import { decode } from 'base64-arraybuffer';

import { requireSupabase } from './client';
import type { CertificationRow, PersonalTagRow, ShareTargetRow } from './database-types';

const db = () => requireSupabase();
const CERTIFICATION_BUCKET = 'certifications';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

type UploadCertificationOptions = {
  onStorageUploaded?: (path: string) => void;
};

export type PersonalCertificationRecord = {
  certification: CertificationRow;
  shareTarget: ShareTargetRow;
  personalTags: PersonalTagRow[];
};

type CertificationUploadStage = 'readImage' | 'storageUpload' | 'saveCertification';

type CertificationUploadError = Error & {
  uploadStage: CertificationUploadStage;
  details?: string;
  hint?: string;
  originalCode?: string;
  statusCode?: string;
  cause?: unknown;
};

function createCertificationImagePath(userId: string, lifestyleDate: string) {
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `${userId}/${lifestyleDate}/${Date.now()}-${randomSuffix}.jpg`;
}

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

function isStorageObjectNotFoundError(error: unknown) {
  const statusCode = readErrorField(error, 'statusCode') ?? readErrorField(error, 'status');
  const message = getErrorMessage(error, '');

  return statusCode === '404' || /object not found/i.test(message);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return (
    readErrorField(error, 'message') ??
    readErrorField(error, 'error_description') ??
    readErrorField(error, 'error') ??
    fallback
  );
}

function stringifyError(error: unknown) {
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

function createCertificationUploadError(
  stage: CertificationUploadStage,
  message: string,
  cause: unknown,
  context: Record<string, string | number | null | undefined> = {},
): CertificationUploadError {
  const causeMessage = getErrorMessage(cause, message);
  const error = new Error(`${message} ${causeMessage}`) as CertificationUploadError;
  const contextLines = Object.entries(context)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key}: ${value}`);
  const originalDetails = readErrorField(cause, 'details');
  const originalHint = readErrorField(cause, 'hint');
  const originalCode = readErrorField(cause, 'code') ?? readErrorField(cause, 'error');
  const statusCode = readErrorField(cause, 'statusCode') ?? readErrorField(cause, 'status');

  error.name = 'CertificationUploadError';
  error.uploadStage = stage;
  error.cause = cause;
  error.originalCode = originalCode ?? undefined;
  error.statusCode = statusCode ?? undefined;
  error.hint = originalHint ?? undefined;
  error.details = [
    `stage: ${stage}`,
    ...contextLines,
    statusCode ? `statusCode: ${statusCode}` : null,
    originalCode ? `originalCode: ${originalCode}` : null,
    originalDetails ? `details: ${originalDetails}` : null,
    originalHint ? `hint: ${originalHint}` : null,
    `raw: ${stringifyError(cause)}`,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');

  return error;
}

function isRemoteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function normalizeStoredImagePath(certification: Pick<CertificationRow, 'image_path' | 'image_url'>) {
  if (certification.image_path) {
    return certification.image_path;
  }

  if (!certification.image_url || isRemoteUrl(certification.image_url)) {
    return null;
  }

  return certification.image_url.replace(/^certifications\//, '');
}

function normalizeCertificationRpcData(data: unknown) {
  const certification = Array.isArray(data) ? data[0] : data;

  if (!isRecord(certification) || typeof certification.id !== 'string') {
    throw new Error('create_certification_with_targets RPC가 인증 레코드를 반환하지 않았습니다.');
  }

  return certification as CertificationRow;
}

async function cleanupUploadedCertificationAsset(path: string) {
  try {
    await db().storage.from(CERTIFICATION_BUCKET).remove([path]);
  } catch {
    // Preserve the original upload/DB error; cleanup can be retried manually from Storage.
  }
}

function readLocalFileAsArrayBuffer(uri: string) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.onload = () => {
      resolve(xhr.response as ArrayBuffer);
    };
    xhr.onerror = () => {
      reject(new Error('이미지 파일을 읽지 못했습니다.'));
    };
    xhr.responseType = 'arraybuffer';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

async function readImageUploadBody(uri: string, base64?: string | null) {
  if (base64) {
    return decode(base64);
  }

  if (isRemoteUrl(uri)) {
    const response = await fetch(uri);

    if (!response.ok) {
      throw new Error('이미지 파일을 내려받지 못했습니다.');
    }

    return response.arrayBuffer();
  }

  return readLocalFileAsArrayBuffer(uri);
}

export async function createCertificationImageSignedUrl(
  certification: Pick<CertificationRow, 'image_path' | 'image_url'>,
) {
  const imagePath = normalizeStoredImagePath(certification);

  if (!imagePath) {
    return certification.image_url;
  }

  const { data, error } = await db()
    .storage
    .from(CERTIFICATION_BUCKET)
    .createSignedUrl(imagePath, SIGNED_URL_TTL_SECONDS);

  if (error) {
    if (isStorageObjectNotFoundError(error)) {
      return certification.image_url;
    }

    throw error;
  }

  return data.signedUrl;
}

// ── 인증 생성 (이미지 업로드 + DB 레코드) ──

export async function uploadCertification(params: {
  userId: string;
  imageUri: string;
  imageBase64?: string | null;
  imageWidth: number;
  imageHeight: number;
  caption: string;
  lifestyleDate: string;
  editableUntil: string;
  personalTagIds: string[];
  groupShareTargets: {
    groupId: string;
    groupTagId: string;
  }[];
}, options?: UploadCertificationOptions) {
  const client = db();

  // 1. 이미지 Storage 업로드
  const fileName = createCertificationImagePath(params.userId, params.lifestyleDate);
  const imageBody = await readImageUploadBody(params.imageUri, params.imageBase64).catch((error) => {
    throw createCertificationUploadError('readImage', '이미지 파일을 업로드용으로 준비하지 못했습니다.', error, {
      uriScheme: params.imageUri.split(':')[0],
    });
  });

  const { error: uploadError } = await client.storage
    .from(CERTIFICATION_BUCKET)
    .upload(fileName, imageBody, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    throw createCertificationUploadError('storageUpload', 'Supabase Storage 이미지 업로드에 실패했습니다.', uploadError, {
      bucket: CERTIFICATION_BUCKET,
      path: fileName,
      contentType: 'image/jpeg',
    });
  }

  options?.onStorageUploaded?.(fileName);

  // 2. certifications + share_targets를 DB RPC에서 한 트랜잭션으로 저장
  const { data: cert, error: certError } = await client.rpc('create_certification_with_targets', {
    p_image_bucket: CERTIFICATION_BUCKET,
    p_image_path: fileName,
    p_image_width: params.imageWidth,
    p_image_height: params.imageHeight,
    p_caption: params.caption,
    p_lifestyle_date: params.lifestyleDate,
    p_personal_tag_ids: params.personalTagIds,
    p_group_share_targets: params.groupShareTargets.map((target) => ({
      group_id: target.groupId,
      group_tag_id: target.groupTagId,
    })),
  });

  if (certError) {
    await cleanupUploadedCertificationAsset(fileName);
    throw createCertificationUploadError('saveCertification', '인증과 공유 대상 저장에 실패했습니다.', certError, {
      rpc: 'create_certification_with_targets',
      bucket: CERTIFICATION_BUCKET,
      path: fileName,
      personalTagCount: params.personalTagIds.length,
      groupTargetCount: params.groupShareTargets.length,
    });
  }

  try {
    return normalizeCertificationRpcData(cert);
  } catch (error) {
    await cleanupUploadedCertificationAsset(fileName);
    throw createCertificationUploadError('saveCertification', '인증 저장 결과를 해석하지 못했습니다.', error, {
      rpc: 'create_certification_with_targets',
      path: fileName,
    });
  }
}

// ── 생활일 기준 인증 조회 (그룹 태그별) ──

export async function fetchCertificationsByGroupTag(
  groupId: string,
  groupTagId: string,
  lifestyleDate: string,
) {
  const { data, error } = await db()
    .from('share_targets')
    .select(`
      id,
      certification_id,
      certifications:certification_id (
        id, user_id, image_bucket, image_path, image_url, image_width, image_height,
        caption, uploaded_at, lifestyle_date, editable_until, status,
        users:user_id ( id, display_name, avatar_url )
      )
    `)
    .eq('kind', 'group_tag')
    .eq('group_id', groupId)
    .eq('group_tag_id', groupTagId)
    .eq('lifestyle_date', lifestyleDate);

  if (error) throw error;

  return Promise.all(
    (data ?? []).map(async (row) => {
      const certification = row.certifications as unknown as CertificationRow | null;

      if (!certification) {
        return row;
      }

      return {
        ...row,
        certifications: {
          ...certification,
          image_url: await createCertificationImageSignedUrl(certification),
        },
      };
    }),
  );
}

// ── 내 인증 내역 (생활일 기준) ──

export async function fetchMyCertifications(userId: string, lifestyleDate: string) {
  const { data, error } = await db()
    .from('certifications')
    .select('*')
    .eq('user_id', userId)
    .eq('lifestyle_date', lifestyleDate)
    .eq('status', 'active')
    .order('uploaded_at', { ascending: false });

  if (error) throw error;
  return Promise.all(
    ((data ?? []) as CertificationRow[]).map(async (certification) => ({
      ...certification,
      image_url: await createCertificationImageSignedUrl(certification),
    })),
  );
}

export async function fetchMyPersonalCertificationRecords(
  userId: string,
  options: {
    lifestyleDate?: string;
    limit?: number;
  } = {},
): Promise<PersonalCertificationRecord[]> {
  let certificationQuery = db()
    .from('certifications')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('uploaded_at', { ascending: false });

  if (options.lifestyleDate) {
    certificationQuery = certificationQuery.eq('lifestyle_date', options.lifestyleDate);
  }

  if (options.limit) {
    certificationQuery = certificationQuery.limit(options.limit);
  }

  const { data: certificationData, error: certificationError } = await certificationQuery;

  if (certificationError) throw certificationError;

  const certifications = (certificationData ?? []) as CertificationRow[];
  if (certifications.length === 0) {
    return [];
  }

  const certificationIds = certifications.map((certification) => certification.id);
  let shareTargetQuery = db()
    .from('share_targets')
    .select('*')
    .eq('kind', 'personal')
    .in('certification_id', certificationIds);

  if (options.lifestyleDate) {
    shareTargetQuery = shareTargetQuery.eq('lifestyle_date', options.lifestyleDate);
  }

  const { data: shareTargetData, error: shareTargetError } = await shareTargetQuery;

  if (shareTargetError) throw shareTargetError;

  const shareTargets = (shareTargetData ?? []) as ShareTargetRow[];
  if (shareTargets.length === 0) {
    return [];
  }

  const personalTagIds = [
    ...new Set(shareTargets.flatMap((target) => target.personal_tag_ids ?? [])),
  ];
  const tagsById = new Map<string, PersonalTagRow>();

  if (personalTagIds.length > 0) {
    const { data: tagData, error: tagError } = await db()
      .from('personal_tags')
      .select('*')
      .in('id', personalTagIds);

    if (tagError) throw tagError;

    for (const tag of (tagData ?? []) as PersonalTagRow[]) {
      tagsById.set(tag.id, tag);
    }
  }

  const certificationsById = new Map(
    await Promise.all(
      certifications.map(async (certification) => [
        certification.id,
        {
          ...certification,
          image_url: await createCertificationImageSignedUrl(certification),
        },
      ] as const),
    ),
  );

  return shareTargets
    .map((shareTarget) => {
      const certification = certificationsById.get(shareTarget.certification_id);

      if (!certification) {
        return null;
      }

      return {
        certification,
        shareTarget,
        personalTags: (shareTarget.personal_tag_ids ?? [])
          .map((tagId) => tagsById.get(tagId))
          .filter((tag): tag is PersonalTagRow => Boolean(tag)),
      };
    })
    .filter((record): record is PersonalCertificationRecord => Boolean(record))
    .sort((left, right) =>
      right.certification.uploaded_at.localeCompare(left.certification.uploaded_at),
    );
}

// ── 인증 삭제 (soft delete) ──

export async function deleteCertification(certificationId: string) {
  const { error } = await db()
    .from('certifications')
    .update({ status: 'deleted' })
    .eq('id', certificationId);

  if (error) throw error;
}

// ── 인증에 달린 share_targets 조회 ──

export async function fetchShareTargets(certificationId: string) {
  const { data, error } = await db()
    .from('share_targets')
    .select('*')
    .eq('certification_id', certificationId);

  if (error) throw error;
  return (data ?? []) as ShareTargetRow[];
}
