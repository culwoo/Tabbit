import { requireSupabase } from './client';
import type { CertificationRow, ShareTargetRow } from './database-types';

const db = () => requireSupabase();

// ── 인증 생성 (이미지 업로드 + DB 레코드) ──

export async function uploadCertification(params: {
  userId: string;
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  caption: string;
  lifestyleDate: string;
  editableUntil: string;
  personalTagIds: string[];
  groupShareTargets: Array<{
    groupId: string;
    groupTagId: string;
  }>;
}) {
  const client = db();

  // 1. 이미지 Storage 업로드
  const fileName = `${params.userId}/${params.lifestyleDate}/${Date.now()}.jpg`;
  const response = await fetch(params.imageUri);
  const blob = await response.blob();

  const { error: uploadError } = await client.storage
    .from('certifications')
    .upload(fileName, blob, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  // 2. signed URL 생성 (7일)
  const { data: urlData } = await client.storage
    .from('certifications')
    .createSignedUrl(fileName, 60 * 60 * 24 * 7);

  const imageUrl = urlData?.signedUrl ?? fileName;

  // 3. certifications 레코드 생성
  const { data: cert, error: certError } = await client
    .from('certifications')
    .insert({
      user_id: params.userId,
      image_url: imageUrl,
      image_width: params.imageWidth,
      image_height: params.imageHeight,
      caption: params.caption,
      lifestyle_date: params.lifestyleDate,
      editable_until: params.editableUntil,
    })
    .select()
    .single();

  if (certError) throw certError;

  // 4. share_targets fan-out
  const shareTargets = [];

  // 개인 태그 공유
  if (params.personalTagIds.length > 0) {
    shareTargets.push({
      certification_id: cert.id,
      kind: 'personal' as const,
      lifestyle_date: params.lifestyleDate,
      personal_tag_ids: params.personalTagIds,
    });
  }

  // 그룹 태그 공유
  for (const target of params.groupShareTargets) {
    shareTargets.push({
      certification_id: cert.id,
      kind: 'group_tag' as const,
      lifestyle_date: params.lifestyleDate,
      group_id: target.groupId,
      group_tag_id: target.groupTagId,
    });
  }

  if (shareTargets.length > 0) {
    const { error: shareError } = await client
      .from('share_targets')
      .insert(shareTargets);

    if (shareError) throw shareError;
  }

  return cert as CertificationRow;
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
        id, user_id, image_url, image_width, image_height,
        caption, uploaded_at, lifestyle_date, status,
        users:user_id ( id, display_name, avatar_url )
      )
    `)
    .eq('kind', 'group_tag')
    .eq('group_id', groupId)
    .eq('group_tag_id', groupTagId)
    .eq('lifestyle_date', lifestyleDate);

  if (error) throw error;
  return data ?? [];
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
  return (data ?? []) as CertificationRow[];
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
