import { requireSupabase } from './client';
import type { GroupRow, GroupMemberRow, GroupTagRow, PersonalTagRow } from './database-types';

const db = () => requireSupabase();

function sanitizeTagBody(label: string) {
  return label.trim().replace(/^#+/, '').replace(/\s+/g, ' ');
}

function normalizeTagLabelInput(label: string) {
  return sanitizeTagBody(label).toLocaleLowerCase('ko-KR');
}

function formatStoredTagLabel(label: string) {
  const body = sanitizeTagBody(label);
  return body ? `#${body}` : '#';
}

// ── 그룹 목록 (내가 속한) ──

export async function fetchMyGroups() {
  const { data, error } = await db()
    .from('group_members')
    .select(`
      group_id,
      role,
      joined_at,
      groups:group_id (
        id, name, description, member_limit, threshold_rule,
        invite_code, created_by, created_at
      )
    `)
    .eq('status', 'active');

  if (error) throw error;

  const groupsById = new Map<string, GroupRow & { myRole: GroupMemberRow['role'] }>();

  for (const row of data ?? []) {
    const group = row.groups as unknown as GroupRow | null;

    if (!group) {
      continue;
    }

    const existing = groupsById.get(group.id);
    const role = row.role as GroupMemberRow['role'];

    if (!existing || role === 'owner') {
      groupsById.set(group.id, {
        ...group,
        myRole: role,
      });
    }
  }

  return [...groupsById.values()];
}

// ── 그룹 상세 ──

export async function fetchGroup(groupId: string) {
  const { data, error } = await db()
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single();

  if (error) throw error;
  return data as GroupRow;
}

// ── 그룹 멤버 목록 ──

export async function fetchGroupMembers(groupId: string) {
  const { data, error } = await db()
    .from('group_members')
    .select(`
      id, group_id, user_id, role, status, joined_at,
      users:user_id ( id, display_name, handle, avatar_url )
    `)
    .eq('group_id', groupId)
    .eq('status', 'active')
    .order('joined_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ── 그룹 태그 목록 ──

export async function fetchGroupTags(groupId: string) {
  const { data, error } = await db()
    .from('group_tags')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as GroupTagRow[];
}

// ── 개인 태그 목록 ──

export async function fetchPersonalTags() {
  const { data, error } = await db()
    .from('personal_tags')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as PersonalTagRow[];
}

async function upsertPersonalTagsFromGroupTags(userId: string, tags: GroupTagRow[]) {
  const uniqueTags = new Map<string, { label: string; normalized_label: string }>();

  for (const tag of tags) {
    const normalizedLabel = tag.normalized_label || normalizeTagLabelInput(tag.label);

    if (!normalizedLabel || uniqueTags.has(normalizedLabel)) {
      continue;
    }

    uniqueTags.set(normalizedLabel, {
      label: formatStoredTagLabel(tag.label),
      normalized_label: normalizedLabel,
    });
  }

  const rows = [...uniqueTags.values()].map((tag) => ({
    user_id: userId,
    label: tag.label,
    normalized_label: tag.normalized_label,
  }));

  if (rows.length === 0) {
    return;
  }

  const { error } = await db()
    .from('personal_tags')
    .upsert(rows, {
      onConflict: 'user_id,normalized_label',
      ignoreDuplicates: true,
    });

  if (error) throw error;
}

export async function syncGroupTagsToPersonalTags(userId: string) {
  const groups = await fetchMyGroups();
  const nestedTags = await Promise.all(groups.map((group) => fetchGroupTags(group.id)));

  await upsertPersonalTagsFromGroupTags(userId, nestedTags.flat());
  return fetchPersonalTags();
}

// ── 활성 그룹 멤버 수 ──

export async function fetchActiveGroupMemberCounts(groupIds: string[]) {
  if (groupIds.length === 0) {
    return new Map<string, number>();
  }

  const { data, error } = await db()
    .from('group_members')
    .select('group_id')
    .in('group_id', groupIds)
    .eq('status', 'active');

  if (error) throw error;

  const counts = new Map<string, number>();

  for (const row of data ?? []) {
    counts.set(row.group_id, (counts.get(row.group_id) ?? 0) + 1);
  }

  return counts;
}

// ── 그룹 생성 ──

export async function createGroup(params: {
  name: string;
  description?: string;
  thresholdRule: GroupRow['threshold_rule'];
  createdBy: string;
}) {
  const { data, error } = await db()
    .from('groups')
    .insert({
      name: params.name,
      description: params.description ?? null,
      threshold_rule: params.thresholdRule,
      created_by: params.createdBy,
    })
    .select()
    .single();

  if (error) throw error;

  // 생성자를 owner로 자동 참여
  const { error: memberError } = await db()
    .from('group_members')
    .insert({
      group_id: data.id,
      user_id: params.createdBy,
      role: 'owner',
    });

  if (memberError) throw memberError;

  return data as GroupRow;
}

// ── 초대 코드로 그룹 참여 ──

export async function joinGroupByInviteCode(inviteCode: string, userId: string) {
  // 1. 초대 코드로 그룹 찾기
  const { data: group, error: findError } = await db()
    .from('groups')
    .select('id, name, member_limit')
    .eq('invite_code', inviteCode)
    .single();

  if (findError || !group) throw new Error('유효하지 않은 초대 코드입니다.');

  // 2. 이미 멤버인지 확인
  const { data: existing } = await db()
    .from('group_members')
    .select('id, status')
    .eq('group_id', group.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing?.status === 'active') {
    throw new Error('이미 참여 중인 그룹입니다.');
  }

  // 3. 멤버 수 확인
  const { count } = await db()
    .from('group_members')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', group.id)
    .eq('status', 'active');

  if ((count ?? 0) >= group.member_limit) {
    throw new Error('그룹 인원이 가득 찼습니다.');
  }

  // 4. 참여 (재참여 or 신규)
  if (existing) {
    await db()
      .from('group_members')
      .update({ status: 'active', left_at: null })
      .eq('id', existing.id);
  } else {
    await db()
      .from('group_members')
      .insert({ group_id: group.id, user_id: userId, role: 'member' });
  }

  await syncGroupTagsToPersonalTags(userId);

  return { groupId: group.id, groupName: group.name };
}

// ── 그룹 태그 추가 ──

export async function addGroupTag(groupId: string, label: string, syncToPersonalUserId?: string) {
  const normalizedLabel = normalizeTagLabelInput(label);

  if (!normalizedLabel) {
    throw new Error('태그 이름을 입력해주세요.');
  }

  const { data, error } = await db()
    .from('group_tags')
    .insert({
      group_id: groupId,
      label: formatStoredTagLabel(label),
      normalized_label: normalizedLabel,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') throw new Error('이미 존재하는 태그입니다.');
    throw error;
  }

  const groupTag = data as GroupTagRow;

  if (syncToPersonalUserId) {
    await addPersonalTag(syncToPersonalUserId, groupTag.label);
  }

  return groupTag;
}

// ── 그룹 태그 삭제 ──

export async function deleteGroupTag(groupId: string, groupTagId: string) {
  const { error } = await db()
    .from('group_tags')
    .delete()
    .eq('group_id', groupId)
    .eq('id', groupTagId);

  if (error) {
    if (/foreign key|violates/i.test(error.message)) {
      throw new Error('이미 인증이나 스토리 기록에 사용된 태그는 삭제할 수 없습니다.');
    }

    throw error;
  }
}

// ── 개인 태그 추가 ──

export async function addPersonalTag(userId: string, label: string) {
  const normalizedLabel = normalizeTagLabelInput(label);

  if (!normalizedLabel) {
    throw new Error('태그 이름을 입력해주세요.');
  }

  const { data, error } = await db()
    .from('personal_tags')
    .insert({
      user_id: userId,
      label: formatStoredTagLabel(label),
      normalized_label: normalizedLabel,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: existing, error: existingError } = await db()
        .from('personal_tags')
        .select('*')
        .eq('user_id', userId)
        .eq('normalized_label', normalizedLabel)
        .single();

      if (existingError) throw existingError;
      return existing as PersonalTagRow;
    }

    throw error;
  }

  return data as PersonalTagRow;
}

// ── 그룹 탈퇴 ──

export async function leaveGroup(groupId: string, userId: string) {
  const { error } = await db()
    .from('group_members')
    .update({ status: 'left', left_at: new Date().toISOString() })
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) throw error;
}
