import { requireSupabase } from './client';
import type { ChatMessageRow, NotificationRow } from './database-types';

const db = () => requireSupabase();

// ═══════════════════════════════════════
// 채팅
// ═══════════════════════════════════════

export async function fetchChatMessages(groupId: string, limit = 50) {
  const { data, error } = await db()
    .from('chat_messages')
    .select(`
      id, group_id, author_id, body, created_at,
      users:author_id ( id, display_name, avatar_url )
    `)
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).reverse(); // 시간순 정렬
}

export async function sendChatMessage(groupId: string, authorId: string, body: string) {
  const { data, error } = await db()
    .from('chat_messages')
    .insert({ group_id: groupId, author_id: authorId, body: body.trim() })
    .select()
    .single();

  if (error) throw error;
  return data as ChatMessageRow;
}

export function subscribeToChatMessages(
  groupId: string,
  onNewMessage: (message: ChatMessageRow) => void,
) {
  const channel = db()
    .channel(`chat:${groupId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `group_id=eq.${groupId}`,
      },
      (payload) => {
        onNewMessage(payload.new as ChatMessageRow);
      },
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}

// ═══════════════════════════════════════
// 알림
// ═══════════════════════════════════════

export async function fetchNotifications(userId: string, limit = 30) {
  const { data, error } = await db()
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

export async function markNotificationRead(notificationId: string) {
  const { error } = await db()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId);

  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await db()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw error;
}

export async function fetchUnreadNotificationCount(userId: string) {
  const { count, error } = await db()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw error;
  return count ?? 0;
}
