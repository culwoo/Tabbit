import { requireSupabase } from './client';
import type { GroupRow, GroupMemberRow, GroupTagRow } from './database-types';

const db = () => requireSupabase();

// ── 그룹 목록 (내가 속한) ──

export async function fetchMyGroups() {
  const { data, error } = await db()
    .from('group_members')
    .select(`
      group_id,
      role,
      groups:group_id (
        id, name, description, member_limit, threshold_rule,
        invite_code, created_by, created_at
      )
    `)
    .eq('status', 'active');

  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...(row.groups as unknown as GroupRow),
    myRole: row.role as GroupMemberRow['role'],
  }));
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
      users:user_id ( id, display_name, avatar_url )
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

  return { groupId: group.id, groupName: group.name };
}

// ── 그룹 태그 추가 ──

export async function addGroupTag(groupId: string, label: string) {
  const normalizedLabel = label.replace(/^#+/, '').trim().toLowerCase().replace(/\s+/g, ' ');

  const { data, error } = await db()
    .from('group_tags')
    .insert({
      group_id: groupId,
      label: label.startsWith('#') ? label : `#${label}`,
      normalized_label: normalizedLabel,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') throw new Error('이미 존재하는 태그입니다.');
    throw error;
  }

  return data as GroupTagRow;
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
