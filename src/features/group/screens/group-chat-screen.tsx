import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
  fetchChatMessages,
  sendChatMessage,
  subscribeToChatMessages,
  type ChatMessageRow,
} from '@/lib/supabase';
import { useAppSession } from '@/providers/app-session-provider';
import { useFontPreference } from '@/providers/font-preference-provider';

type UserJoinResult = { id: string; display_name: string; avatar_url: string | null };

type ChatBubble = ChatMessageRow & {
  users?: UserJoinResult | UserJoinResult[] | null;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function GroupChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { userId } = useAppSession();
  const { bodyTextStyle, strongTextStyle } = useFontPreference();

  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList<ChatBubble> | null>(null);

  const normalizedGroupId = Array.isArray(groupId) ? groupId[0] : groupId ?? '';

  useEffect(() => {
    if (!normalizedGroupId) return;

    (async () => {
      try {
        const data = await fetchChatMessages(normalizedGroupId, 80);
        setMessages(data as unknown as ChatBubble[]);
      } catch (error) {
        console.error('[GroupChat] fetch error:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [normalizedGroupId]);

  useEffect(() => {
    if (!normalizedGroupId) return undefined;

    const unsubscribe = subscribeToChatMessages(normalizedGroupId, (newMessage) => {
      setMessages((items) => [...items, newMessage as ChatBubble]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    return unsubscribe;
  }, [normalizedGroupId]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !userId || !normalizedGroupId || sending) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);
    Keyboard.dismiss();

    try {
      await sendChatMessage(normalizedGroupId, userId, text);
    } catch (error) {
      console.error('[GroupChat] send error:', error);
      setInputText(text);
    } finally {
      setSending(false);
    }
  }, [inputText, normalizedGroupId, sending, userId]);

  function handleBack() {
    if (navigation.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  }

  const renderMessage = useCallback(
    ({ item, index }: { item: ChatBubble; index: number }) => {
      const isMine = item.author_id === userId;
      const userRecord = Array.isArray(item.users) ? item.users[0] : item.users;
      const displayName = userRecord?.display_name ?? '멤버';

      return (
        <View style={[styles.messageRow, isMine ? styles.messageRowMine : undefined]}>
          {!isMine ? <PaperAvatar label={displayName} size={34} tone={toneFromIndex(index)} /> : null}
          <View style={[styles.messageContent, isMine ? styles.messageContentMine : undefined]}>
            {!isMine ? <Text style={[styles.senderName, bodyTextStyle]}>{displayName}</Text> : null}
            <View
              style={[
                styles.bubble,
                isMine ? styles.bubbleMine : styles.bubbleOther,
                { transform: [{ rotate: `${isMine ? 0.3 : -0.3}deg` }] },
              ]}>
              <Text style={[styles.bubbleText, bodyTextStyle, isMine ? styles.bubbleTextMine : undefined]}>
                {item.body}
              </Text>
            </View>
            <Text style={[styles.timestamp, bodyTextStyle, isMine ? styles.timestampMine : undefined]}>
              {formatTime(item.created_at)}
            </Text>
          </View>
        </View>
      );
    },
    [bodyTextStyle, userId],
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable accessibilityLabel="뒤로가기" onPress={handleBack} style={styles.iconButton}>
          <Ionicons color={paperColors.ink0} name="chevron-back" size={24} />
        </Pressable>
        <Text style={styles.topTitle}>그룹 채팅</Text>
        <View style={styles.iconButton} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={styles.flex}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={paperColors.coral} size="large" />
            <Text style={[styles.loadingText, bodyTextStyle]}>메모를 불러오는 중</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyBox}>
            <Tape angle={-6} left={40} top={-10} width={76} />
            <Ionicons color={paperColors.ink2} name="chatbubbles-outline" size={42} />
            <Text style={[styles.emptyTitle, strongTextStyle]}>아직 남긴 말이 없어요</Text>
            <Text style={[styles.emptyDesc, bodyTextStyle]}>오늘 인증을 기다리는 친구들에게 짧게 말을 걸어보세요.</Text>
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

        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 10 }]}>
          <TextInput
            maxLength={500}
            multiline
            onChangeText={setInputText}
            placeholder="짧은 응원을 남겨보세요"
            placeholderTextColor={paperColors.ink3}
            style={[styles.textInput, bodyTextStyle]}
            value={inputText}
          />
          <Pressable
            accessibilityLabel="전송"
            disabled={!inputText.trim() || sending}
            onPress={() => void handleSend()}
            style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}>
            {sending ? (
              <ActivityIndicator color={paperColors.card} size={16} />
            ) : (
              <Ionicons color={paperColors.card} name="arrow-up" size={18} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    borderColor: paperColors.ink0,
    borderRadius: 14,
    borderWidth: 1.3,
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  bubbleMine: {
    backgroundColor: paperColors.ink0,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: paperColors.card,
    borderBottomLeftRadius: 4,
    ...paperShadow,
  },
  bubbleText: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTextMine: {
    color: paperColors.card,
  },
  emptyBox: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 9,
    marginHorizontal: 24,
    marginTop: 88,
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
    fontSize: 21,
    lineHeight: 26,
  },
  flex: {
    flex: 1,
  },
  iconButton: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  inputBar: {
    alignItems: 'flex-end',
    backgroundColor: 'rgba(251,247,240,0.96)',
    borderTopColor: paperColors.ink0,
    borderTopWidth: 1.2,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  loadingBox: {
    alignItems: 'center',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
  },
  loadingText: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 14,
    lineHeight: 19,
  },
  messageContent: {
    flexShrink: 1,
    gap: 3,
  },
  messageContentMine: {
    alignItems: 'flex-end',
  },
  messageList: {
    gap: 9,
    paddingBottom: 12,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  messageRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    maxWidth: '86%',
  },
  messageRowMine: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  screen: {
    backgroundColor: paperColors.paper0,
    flex: 1,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: paperColors.ink0,
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.3,
    height: 40,
    justifyContent: 'center',
    marginBottom: 1,
    width: 40,
  },
  sendButtonDisabled: {
    backgroundColor: paperColors.ink3,
    borderColor: paperColors.ink2,
  },
  senderName: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 11,
    lineHeight: 15,
    paddingLeft: 3,
  },
  textInput: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 18,
    borderWidth: 1.4,
    color: paperColors.ink0,
    flex: 1,
    fontFamily: paperFonts.handBold,
    fontSize: 15,
    lineHeight: 21,
    maxHeight: 110,
    paddingHorizontal: 13,
    paddingVertical: Platform.OS === 'ios' ? 10 : 7,
  },
  timestamp: {
    color: paperColors.ink3,
    fontFamily: paperFonts.handBold,
    fontSize: 10,
    lineHeight: 14,
    paddingLeft: 4,
  },
  timestampMine: {
    paddingLeft: 0,
    paddingRight: 4,
    textAlign: 'right',
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
});
