import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { AppHeader } from '@/components/shell/app-header';
import { colors, radius, spacing, typography } from '@/constants/tokens';
import { useAppSession } from '@/providers/app-session-provider';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationRow,
} from '@/lib/supabase';

const ICON_MAP: Record<NotificationRow['type'], { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  new_certification: { name: 'camera', color: colors.brand.primary },
  certification_comment: { name: 'chatbubble', color: colors.brand.accent },
  group_invite: { name: 'people', color: colors.brand.secondary },
  group_chat: { name: 'chatbubbles', color: colors.status.info },
  threshold_unlocked: { name: 'lock-open', color: colors.status.success },
  story_card_finalized: { name: 'sparkles', color: colors.brand.accent },
};

const LABEL_MAP: Record<NotificationRow['type'], string> = {
  new_certification: '새 인증',
  certification_comment: '댓글',
  group_invite: '그룹 초대',
  group_chat: '새 채팅',
  threshold_unlocked: '언락!',
  story_card_finalized: '스토리 확정',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const { userId } = useAppSession();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await fetchNotifications(userId, 50);
      setNotifications(data);
    } catch (err) {
      console.error('[Notifications] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [loadData]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleReadAll = useCallback(async () => {
    if (!userId) return;
    try {
      await markAllNotificationsRead(userId);
      setNotifications((prev) =>
        prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })),
      );
    } catch (err) {
      console.error('[Notifications] readAll error:', err);
    }
  }, [userId]);

  const handleTap = useCallback(async (item: NotificationRow) => {
    if (!item.read_at) {
      try {
        await markNotificationRead(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n)),
        );
      } catch {}
    }

    // 딥링크 라우팅
    const payload = item.payload as Record<string, any>;
    if (item.type === 'group_invite' && payload.groupId) {
      router.push(`/groups/${payload.groupId}`);
    } else if (item.type === 'group_chat' && payload.groupId) {
      router.push(`/groups/chat/${payload.groupId}`);
    } else if (payload.groupId) {
      router.push(`/groups/${payload.groupId}`);
    }
  }, []);

  function handleBack() {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/index');
    }
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const renderItem = useCallback(
    ({ item }: { item: NotificationRow }) => {
      const iconConfig = ICON_MAP[item.type] ?? { name: 'ellipse', color: colors.text.tertiary };
      const isUnread = !item.read_at;
      const payload = item.payload as Record<string, any>;
      const body = payload.message ?? payload.body ?? LABEL_MAP[item.type] ?? '알림';

      return (
        <TouchableOpacity
          accessibilityLabel={`${LABEL_MAP[item.type]} 알림`}
          activeOpacity={0.7}
          onPress={() => handleTap(item)}
          style={[styles.notifRow, isUnread && styles.notifRowUnread]}
        >
          <View style={[styles.iconCircle, { backgroundColor: `${iconConfig.color}18` }]}>
            <Ionicons color={iconConfig.color} name={iconConfig.name as any} size={18} />
          </View>
          <View style={styles.notifContent}>
            <View style={styles.notifTopRow}>
              <Text style={styles.notifType}>{LABEL_MAP[item.type]}</Text>
              {isUnread ? <View style={styles.unreadDot} /> : null}
            </View>
            <Text numberOfLines={2} style={styles.notifBody}>{body as string}</Text>
            <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
          </View>
        </TouchableOpacity>
      );
    },
    [handleTap],
  );

  return (
    <View style={styles.screen}>
      <AppHeader
        onBack={handleBack}
        rightActions={
          unreadCount > 0
            ? [{ accessibilityLabel: '모두 읽음', icon: 'checkmark-done', onPress: handleReadAll }]
            : []
        }
        title="알림"
        variant="detail"
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand.primary} size="large" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons color={colors.text.tertiary} name="notifications-off-outline" size={48} />
          <Text style={styles.emptyTitle}>알림이 없어요</Text>
          <Text style={styles.emptyDesc}>
            그룹에 참여하면 인증, 채팅, 스토리 알림이{'\n'}여기에 나타나요
          </Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={notifications}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              colors={[colors.brand.primary]}
              onRefresh={handleRefresh}
              refreshing={refreshing}
              tintColor={colors.brand.primary}
            />
          }
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.bg.canvas,
    flex: 1,
  },
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },

  // 빈 상태
  emptyBox: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyTitle: {
    color: colors.text.primary,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
  },
  emptyDesc: {
    color: colors.text.secondary,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    textAlign: 'center',
  },

  // 리스트
  list: {
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.xs,
  },
  notifRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  notifRowUnread: {
    backgroundColor: colors.brand.primarySoft,
  },
  iconCircle: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    marginTop: 2,
    width: 36,
  },
  notifContent: {
    flex: 1,
    gap: 2,
  },
  notifTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  notifType: {
    color: colors.text.primary,
    fontSize: typography.label.fontSize,
    fontWeight: typography.bodyStrong.fontWeight,
  },
  unreadDot: {
    backgroundColor: colors.brand.primary,
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  notifBody: {
    color: colors.text.secondary,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  notifTime: {
    color: colors.text.tertiary,
    fontSize: 12,
    marginTop: 2,
  },
});
