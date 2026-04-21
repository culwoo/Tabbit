import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  PaperAvatar,
  Tape,
  paperColors,
  paperFonts,
  paperShadow,
  toneFromIndex,
} from '@/components/ui/paper-design';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
} from '@/lib/supabase';
import { useAppSession } from '@/providers/app-session-provider';
import { useFontPreference } from '@/providers/font-preference-provider';

const ICON_MAP: Record<NotificationRow['type'], keyof typeof Ionicons.glyphMap> = {
  certification_comment: 'chatbubble-ellipses-outline',
  group_chat: 'chatbubbles-outline',
  group_invite: 'people-outline',
  new_certification: 'camera-outline',
  story_card_finalized: 'sparkles-outline',
  threshold_unlocked: 'lock-open-outline',
};

const LABEL_MAP: Record<NotificationRow['type'], string> = {
  certification_comment: '댓글',
  group_chat: '새 채팅',
  group_invite: '그룹 초대',
  new_certification: '새 인증',
  story_card_finalized: '스토리 저장',
  threshold_unlocked: '스토리 열림',
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

function getPayloadText(item: NotificationRow) {
  const payload = item.payload as Record<string, unknown>;
  const body = payload.message ?? payload.body ?? payload.title;

  return typeof body === 'string' ? body : LABEL_MAP[item.type] ?? '알림';
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { userId } = useAppSession();
  const { bodyTextStyle, strongTextStyle } = useFontPreference();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!userId) return;

    try {
      const data = await fetchNotifications(userId, 50);
      setNotifications(data);
    } catch (error) {
      console.error('[Notifications] load error:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadData();
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
      setNotifications((items) =>
        items.map((item) => (item.read_at ? item : { ...item, read_at: new Date().toISOString() })),
      );
    } catch (error) {
      console.error('[Notifications] readAll error:', error);
    }
  }, [userId]);

  const handleTap = useCallback(async (item: NotificationRow) => {
    if (!item.read_at) {
      try {
        await markNotificationRead(item.id);
        setNotifications((items) =>
          items.map((nextItem) =>
            nextItem.id === item.id ? { ...nextItem, read_at: new Date().toISOString() } : nextItem,
          ),
        );
      } catch {
        // 읽음 처리 실패가 이동을 막지는 않습니다.
      }
    }

    const payload = item.payload as Record<string, unknown>;
    const groupId = typeof payload.groupId === 'string' ? payload.groupId : null;

    if (item.type === 'group_chat' && groupId) {
      router.push(`/groups/chat/${groupId}`);
      return;
    }

    if (groupId) {
      router.push(`/groups/${groupId}`);
    }
  }, []);

  function handleBack() {
    if (navigation.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  }

  const unreadCount = notifications.filter((item) => !item.read_at).length;

  const renderItem = useCallback(
    ({ item, index }: { item: NotificationRow; index: number }) => {
      const isUnread = !item.read_at;
      const tone = toneFromIndex(index);

      return (
        <Pressable
          accessibilityLabel={`${LABEL_MAP[item.type]} 알림`}
          accessibilityRole="button"
          onPress={() => void handleTap(item)}
          style={[
            styles.notificationCard,
            {
              backgroundColor: isUnread ? paperColors[tone] : paperColors.card,
              transform: [{ rotate: `${(index % 2 === 0 ? -1 : 1) * 0.4}deg` }],
            },
          ]}>
          {index % 3 === 0 ? <Tape angle={-6} left={26} top={-10} width={58} /> : null}
          <View style={styles.notificationIcon}>
            <Ionicons color={paperColors.ink0} name={ICON_MAP[item.type]} size={18} />
          </View>
          <View style={styles.notificationCopy}>
            <View style={styles.notificationTop}>
              <Text style={[styles.notificationLabel, strongTextStyle]}>{LABEL_MAP[item.type]}</Text>
              {isUnread ? <Text style={[styles.unreadMark, strongTextStyle]}>new</Text> : null}
            </View>
            <Text numberOfLines={2} style={[styles.notificationBody, bodyTextStyle]}>
              {getPayloadText(item)}
            </Text>
            <Text style={[styles.notificationTime, bodyTextStyle]}>{timeAgo(item.created_at)}</Text>
          </View>
        </Pressable>
      );
    },
    [bodyTextStyle, handleTap, strongTextStyle],
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable accessibilityLabel="뒤로가기" onPress={handleBack} style={styles.iconButton}>
          <Ionicons color={paperColors.ink0} name="chevron-back" size={24} />
        </Pressable>
        <Text style={styles.topTitle}>알림</Text>
        {unreadCount > 0 ? (
          <Pressable accessibilityLabel="모두 읽음" onPress={() => void handleReadAll()} style={styles.iconButton}>
            <Ionicons color={paperColors.ink0} name="checkmark-done-outline" size={22} />
          </Pressable>
        ) : (
          <View style={styles.iconButton} />
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={paperColors.coral} size="large" />
          <Text style={[styles.loadingText, bodyTextStyle]}>소식을 모으는 중</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyBox}>
          <Tape angle={-7} left={42} top={-8} width={72} />
          <PaperAvatar label="쉿" size={58} tone="sage" />
          <Text style={[styles.emptyTitle, strongTextStyle]}>조용한 하루예요</Text>
          <Text style={[styles.emptyDesc, bodyTextStyle]}>인증, 채팅, 스토리 소식이 생기면 여기에 붙어요.</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 34 }]}
          data={notifications}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              colors={[paperColors.coral]}
              onRefresh={handleRefresh}
              refreshing={refreshing}
              tintColor={paperColors.coral}
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
  center: {
    alignItems: 'center',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 10,
    marginHorizontal: 24,
    marginTop: 80,
    paddingHorizontal: 22,
    paddingVertical: 24,
    position: 'relative',
    ...paperShadow,
  },
  emptyDesc: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 22,
    lineHeight: 27,
  },
  iconButton: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  list: {
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  loadingText: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 14,
    lineHeight: 19,
  },
  notificationBody: {
    color: paperColors.ink1,
    fontFamily: paperFonts.handBold,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  notificationCard: {
    alignItems: 'flex-start',
    borderColor: paperColors.ink0,
    borderRadius: 8,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 11,
    paddingHorizontal: 13,
    paddingVertical: 13,
    position: 'relative',
    ...paperShadow,
  },
  notificationCopy: {
    flex: 1,
    minWidth: 0,
  },
  notificationIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(253,251,245,0.68)',
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.2,
    height: 38,
    justifyContent: 'center',
    marginTop: 1,
    width: 38,
  },
  notificationLabel: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 13,
    lineHeight: 17,
  },
  notificationTime: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 5,
  },
  notificationTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  screen: {
    backgroundColor: paperColors.paper0,
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 6,
    paddingHorizontal: 16,
  },
  topTitle: {
    color: paperColors.ink0,
    flex: 1,
    fontFamily: paperFonts.pen,
    fontSize: 26,
    lineHeight: 32,
    textAlign: 'center',
  },
  unreadMark: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1,
    color: paperColors.coral,
    fontFamily: paperFonts.handBold,
    fontSize: 10,
    lineHeight: 13,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
});
