import { requireSupabase } from './client';
import type { ThresholdStateRow, StoryCardRow } from './database-types';

const db = () => requireSupabase();

// ── 그룹+태그+생활일 기준 임계값 상태 조회 ──

export async function fetchThresholdState(
  groupId: string,
  groupTagId: string,
  lifestyleDate: string,
) {
  const { data, error } = await db()
    .from('threshold_states')
    .select('*')
    .eq('group_id', groupId)
    .eq('group_tag_id', groupTagId)
    .eq('lifestyle_date', lifestyleDate)
    .maybeSingle();

  if (error) throw error;
  return data as ThresholdStateRow | null;
}

// ── 그룹의 오늘 임계값 상태 전체 조회 ──

export async function fetchGroupThresholdStates(groupId: string, lifestyleDate: string) {
  const { data, error } = await db()
    .from('threshold_states')
    .select(`
      *,
      group_tags:group_tag_id ( id, label, normalized_label )
    `)
    .eq('group_id', groupId)
    .eq('lifestyle_date', lifestyleDate);

  if (error) throw error;
  return data ?? [];
}

// ── 스토리 카드 조회 ──

export async function fetchStoryCard(
  groupId: string,
  groupTagId: string,
  lifestyleDate: string,
) {
  const { data, error } = await db()
    .from('story_cards')
    .select('*')
    .eq('group_id', groupId)
    .eq('group_tag_id', groupTagId)
    .eq('lifestyle_date', lifestyleDate)
    .maybeSingle();

  if (error) throw error;
  return data as StoryCardRow | null;
}

// ── 그룹의 스토리 카드 목록 (최근) ──

export async function fetchGroupStoryCards(groupId: string, limit = 20) {
  const { data, error } = await db()
    .from('story_cards')
    .select(`
      *,
      group_tags:group_tag_id ( id, label )
    `)
    .eq('group_id', groupId)
    .in('status', ['provisional', 'finalized'])
    .order('lifestyle_date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

// ── 임계값 변경 실시간 구독 ──

export function subscribeToThresholdChanges(
  groupId: string,
  onUpdate: (state: ThresholdStateRow) => void,
) {
  const channel = db()
    .channel(`thresholds:${groupId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'threshold_states',
        filter: `group_id=eq.${groupId}`,
      },
      (payload) => {
        if (payload.new) {
          onUpdate(payload.new as ThresholdStateRow);
        }
      },
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}
