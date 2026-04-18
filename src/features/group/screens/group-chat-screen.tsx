import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { AppHeader } from '@/components/shell/app-header';
import { colors, radius, spacing, typography } from '@/constants/tokens';
import { useAppSession } from '@/providers/app-session-provider';
import {
  fetchChatMessages,
  sendChatMessage,
  subscribeToChatMessages,
  type ChatMessageRow,
} from '@/lib/supabase';

type UserJoinResult = { id: string; display_name: string; avatar_url: string | null };

type ChatBubble = ChatMessageRow & {
  users?: UserJoinResult | UserJoinResult[] | null;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function AvatarCircle({ name }: { name: string }) {
  const initial = name.charAt(0);
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initial}</Text>
    </View>
  );
}

export default function GroupChatScreen() {
  const navigation = useNavigation();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { userId } = useAppSession();

  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const normalizedGroupId = Array.isArray(groupId) ? groupId[0] : groupId ?? '';

  // 메시지 로드
  useEffect(() => {
    if (!normalizedGroupId) return;

    (async () => {
      try {
        const data = await fetchChatMessages(normalizedGroupId, 80);
        setMessages(data as unknown as ChatBubble[]);
      } catch (err) {
        console.error('[GroupChat] fetch error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [normalizedGroupId]);

  // Realtime 구독
  useEffect(() => {
    if (!normalizedGroupId) return;

    const unsubscribe = subscribeToChatMessages(normalizedGroupId, (newMsg) => {
      setMessages((prev) => [...prev, newMsg as ChatBubble]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    return unsubscribe;
  }, [normalizedGroupId]);

  // 전송
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !userId || !normalizedGroupId || sending) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);
    Keyboard.dismiss();

    try {
      await sendChatMessage(normalizedGroupId, userId, text);
      // Realtime이 새 메시지를 자동 반영함
    } catch (err) {
      console.error('[GroupChat] send error:', err);
      setInputText(text); // 실패시 복원
    } finally {
      setSending(false);
    }
  }, [inputText, userId, normalizedGroupId, sending]);

  function handleBack() {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  const renderMessage = useCallback(
    ({ item }: { item: ChatBubble }) => {
      const isMine = item.author_id === userId;
      const userRecord = Array.isArray(item.users) ? item.users[0] : item.users;
      const displayName = userRecord?.display_name ?? '멤버';

      return (
        <View style={[styles.messageRow, isMine && styles.messageRowMine]}>
          {!isMine ? <AvatarCircle name={displayName} /> : null}
          <View style={styles.messageContent}>
            {!isMine ? <Text style={styles.senderName}>{displayName}</Text> : null}
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
              <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.body}</Text>
            </View>
            <Text style={[styles.timestamp, isMine && styles.timestampMine]}>
              {formatTime(item.created_at)}
            </Text>
          </View>
        </View>
      );
    },
    [userId],
  );

  return (
    <View style={styles.screen}>
      <AppHeader onBack={handleBack} title="그룹 채팅" variant="detail" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={styles.flex}
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.brand.primary} size="large" />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons color={colors.text.tertiary} name="chatbubbles-outline" size={48} />
            <Text style={styles.emptyTitle}>아직 남긴 말이 없어요</Text>
            <Text style={styles.emptyDesc}>오늘 인증을 기다리는 친구들에게 짧게 말을 걸어보세요.</Text>
          </View>
        ) : (
          <FlatList
            contentContainerStyle={styles.messageList}
            data={messages}
            keyExtractor={(item) => item.id}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ref={flatListRef}
            renderItem={renderMessage}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* 입력 바 */}
        <View style={styles.inputBar}>
          <TextInput
            maxLength={500}
            multiline
            onChangeText={setInputText}
            placeholder="짧은 응원을 남겨보세요"
            placeholderTextColor={colors.text.tertiary}
            style={styles.textInput}
            value={inputText}
          />
          <TouchableOpacity
            accessibilityLabel="전송"
            activeOpacity={0.7}
            disabled={!inputText.trim() || sending}
            onPress={handleSend}
            style={[
              styles.sendButton,
              (!inputText.trim() || sending) && styles.sendButtonDisabled,
            ]}
          >
            {sending ? (
              <ActivityIndicator color={colors.text.inverse} size={16} />
            ) : (
              <Ionicons color={colors.text.inverse} name="arrow-up" size={18} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.bg.canvas,
    flex: 1,
  },
  flex: {
    flex: 1,
  },

  // 로딩 & 빈 상태
  loadingBox: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
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
  },

  // 메시지 리스트
  messageList: {
    gap: spacing.xs,
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  messageRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.xs,
    maxWidth: '85%',
  },
  messageRowMine: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  messageContent: {
    gap: 2,
    flexShrink: 1,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.brand.butterSoft,
    borderColor: colors.line.warm,
    borderWidth: 1,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  avatarText: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  senderName: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
    paddingLeft: 2,
  },

  // 버블
  bubble: {
    borderRadius: 18,
    maxWidth: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleOther: {
    backgroundColor: colors.surface.raised,
    borderColor: colors.line.soft,
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  bubbleMine: {
    backgroundColor: colors.surface.inverse,
    borderColor: colors.brand.accent,
    borderWidth: 1,
    borderBottomRightRadius: 4,
  },
  bubbleText: {
    color: colors.text.primary,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  bubbleTextMine: {
    color: colors.text.inverse,
  },
  timestamp: {
    color: colors.text.tertiary,
    fontSize: 11,
    paddingLeft: 4,
  },
  timestampMine: {
    paddingLeft: 0,
    paddingRight: 4,
    textAlign: 'right',
  },

  // 입력 바
  inputBar: {
    alignItems: 'flex-end',
    backgroundColor: colors.bg.warm,
    borderTopColor: colors.line.warm,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  textInput: {
    backgroundColor: colors.surface.raised,
    borderColor: colors.line.warm,
    borderWidth: 1,
    borderRadius: radius.input,
    color: colors.text.primary,
    flex: 1,
    fontSize: typography.body.fontSize,
    maxHeight: 100,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.brand.primary,
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    marginBottom: 2,
    width: 36,
  },
  sendButtonDisabled: {
    backgroundColor: colors.line.soft,
  },
});
