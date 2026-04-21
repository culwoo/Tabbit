import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Keyboard,
  type KeyboardEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Tape,
  paperColors,
  paperFonts,
  paperShadow,
} from '@/components/ui/paper-design';
import { createGroup, joinGroupByInviteCode } from '@/lib/supabase';
import { useAppSession } from '@/providers/app-session-provider';
import { useFontPreference } from '@/providers/font-preference-provider';

type Mode = 'menu' | 'create' | 'join';

export default function GroupEntryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { userId } = useAppSession();
  const { bodyTextStyle, strongTextStyle } = useFontPreference();
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const [mode, setMode] = useState<Mode>('menu');
  const [loading, setLoading] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showThresholdGuide, setShowThresholdGuide] = useState(false);

  useEffect(() => {
    function moveSheet(event: KeyboardEvent) {
      const bottomInset = Math.max(insets.bottom, 0);
      const nextOffset = -Math.min(Math.max(event.endCoordinates.height - bottomInset + 18, 0), 280);

      Animated.timing(keyboardOffset, {
        duration: event.duration || 240,
        easing: Easing.out(Easing.cubic),
        toValue: nextOffset,
        useNativeDriver: true,
      }).start();
    }

    function resetSheet(event?: KeyboardEvent) {
      Animated.timing(keyboardOffset, {
        duration: event?.duration || 220,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }

    const showListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      moveSheet,
    );
    const hideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      resetSheet,
    );

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, [insets.bottom, keyboardOffset]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();

    if (navigation.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  }, [navigation]);

  const handleCreate = useCallback(async () => {
    const name = groupName.trim();

    if (!name || !userId || loading) {
      return;
    }

    Keyboard.dismiss();
    setLoading(true);

    try {
      const group = await createGroup({
        createdBy: userId,
        description: groupDesc.trim() || undefined,
        name,
        thresholdRule: 'ALL',
      });

      Alert.alert('그룹 만들었어', `"${group.name}"에서 같이 인증할 수 있어요.`, [
        { onPress: () => router.replace(`/groups/${group.id}`), text: '확인' },
      ]);
    } catch (error) {
      Alert.alert(
        '그룹을 만들지 못했어요',
        error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.',
      );
    } finally {
      setLoading(false);
    }
  }, [groupDesc, groupName, loading, userId]);

  const handleJoin = useCallback(async () => {
    const code = inviteCode.trim();

    if (!code || !userId || loading) {
      return;
    }

    Keyboard.dismiss();
    setLoading(true);

    try {
      const result = await joinGroupByInviteCode(code, userId);
      Alert.alert('그룹에 들어갔어', `"${result.groupName}"에 참여했어요.`, [
        { onPress: () => router.replace(`/groups/${result.groupId}`), text: '확인' },
      ]);
    } catch (error) {
      Alert.alert(
        '참여하지 못했어요',
        error instanceof Error ? error.message : '초대 코드를 다시 확인해주세요.',
      );
    } finally {
      setLoading(false);
    }
  }, [inviteCode, loading, userId]);

  return (
    <View style={styles.overlay}>
      <Pressable accessibilityLabel="닫기" onPress={handleClose} style={StyleSheet.absoluteFill} />
      <Animated.View
        style={[
          styles.sheetWrap,
          {
            paddingBottom: Math.max(insets.bottom, 12) + 10,
            transform: [{ translateY: keyboardOffset }],
          },
        ]}>
        <Tape angle={-5} left={42} top={2} width={86} />
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={[styles.eyebrow, bodyTextStyle]}>
                {mode === 'menu' ? '같이 하기' : mode === 'create' ? '새 그룹' : '초대장'}
              </Text>
              <Text style={[styles.title, strongTextStyle]}>
                {mode === 'menu' ? '그룹을 어떻게 시작할까?' : mode === 'create' ? '그룹 만들기' : '초대 코드'}
              </Text>
            </View>
            {mode !== 'menu' ? (
              <Pressable accessibilityLabel="뒤로" onPress={() => setMode('menu')} style={styles.iconButton}>
                <Ionicons color={paperColors.ink0} name="chevron-back" size={21} />
              </Pressable>
            ) : null}
            <Pressable accessibilityLabel="닫기" onPress={handleClose} style={styles.iconButton}>
              <Ionicons color={paperColors.ink0} name="close" size={21} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {mode === 'menu' ? (
              <View style={styles.optionList}>
                <Pressable
                  accessibilityLabel="그룹 만들기"
                  accessibilityRole="button"
                  onPress={() => setMode('create')}
                  style={[styles.optionCard, { backgroundColor: paperColors.sage }]}>
                  <View style={styles.optionIcon}>
                    <Ionicons color={paperColors.ink0} name="add-outline" size={25} />
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={[styles.optionTitle, strongTextStyle]}>그룹 만들기</Text>
                    <Text style={[styles.optionText, bodyTextStyle]}>태그를 정하고 친구를 초대해요</Text>
                  </View>
                  <Ionicons color={paperColors.ink1} name="chevron-forward" size={18} />
                </Pressable>

                <Pressable
                  accessibilityLabel="초대 코드로 참여"
                  accessibilityRole="button"
                  onPress={() => setMode('join')}
                  style={[styles.optionCard, { backgroundColor: paperColors.peach }]}>
                  <View style={styles.optionIcon}>
                    <Ionicons color={paperColors.ink0} name="enter-outline" size={24} />
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={[styles.optionTitle, strongTextStyle]}>초대 코드로 참여</Text>
                    <Text style={[styles.optionText, bodyTextStyle]}>받은 코드를 넣고 바로 합류해요</Text>
                  </View>
                  <Ionicons color={paperColors.ink1} name="chevron-forward" size={18} />
                </Pressable>
              </View>
            ) : null}

            {mode === 'create' ? (
              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, bodyTextStyle]}>이름</Text>
                  <TextInput
                    autoFocus
                    editable={!loading}
                    maxLength={30}
                    onChangeText={setGroupName}
                    placeholder="새벽 운동팟"
                    placeholderTextColor={paperColors.ink3}
                    style={[styles.textInput, strongTextStyle]}
                    value={groupName}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, bodyTextStyle]}>한 줄 메모</Text>
                  <TextInput
                    editable={!loading}
                    maxLength={100}
                    multiline
                    onChangeText={setGroupDesc}
                    placeholder="함께 지킬 약속을 적어줘"
                    placeholderTextColor={paperColors.ink3}
                    style={[styles.textInput, styles.textArea, strongTextStyle]}
                    value={groupDesc}
                  />
                </View>

                <View style={styles.thresholdGuideRow}>
                  <Text style={[styles.inputLabel, bodyTextStyle]}>인증 기준</Text>
                  <Pressable
                    accessibilityLabel="인증 기준 안내"
                    accessibilityRole="button"
                    onPress={() => setShowThresholdGuide((value) => !value)}
                    style={styles.infoButton}>
                    <Ionicons color={paperColors.ink1} name="information-circle-outline" size={20} />
                  </Pressable>
                </View>
                {showThresholdGuide ? (
                  <View style={styles.infoNote}>
                    <Text style={[styles.infoNoteTitle, strongTextStyle]}>처음에는 모두 인증으로 시작해요</Text>
                    <Text style={[styles.infoNoteText, bodyTextStyle]}>
                      그룹 설정에서 멤버 수에 맞춰 기준, 태그, 초대 코드를 바꿀 수 있어요.
                    </Text>
                  </View>
                ) : null}

                <Pressable
                  disabled={!groupName.trim() || loading}
                  onPress={() => void handleCreate()}
                  style={[styles.primaryButton, (!groupName.trim() || loading) && styles.disabledButton]}>
                  {loading ? <ActivityIndicator color={paperColors.card} /> : null}
                  <Text style={[styles.primaryButtonText, strongTextStyle]}>{loading ? '만드는 중' : '그룹 만들기'}</Text>
                </Pressable>
              </View>
            ) : null}

            {mode === 'join' ? (
              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, bodyTextStyle]}>초대 코드</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    editable={!loading}
                    maxLength={24}
                    onChangeText={setInviteCode}
                    placeholder="a3f2b1c9e0d4"
                    placeholderTextColor={paperColors.ink3}
                    style={[styles.textInput, strongTextStyle]}
                    value={inviteCode}
                  />
                </View>

                <Pressable
                  disabled={!inviteCode.trim() || loading}
                  onPress={() => void handleJoin()}
                  style={[styles.primaryButton, (!inviteCode.trim() || loading) && styles.disabledButton]}>
                  {loading ? <ActivityIndicator color={paperColors.card} /> : null}
                  <Text style={[styles.primaryButtonText, strongTextStyle]}>{loading ? '참여 중' : '그룹 참여하기'}</Text>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 14,
  },
  disabledButton: {
    opacity: 0.45,
  },
  eyebrow: {
    color: paperColors.ink2,
    fontFamily: paperFonts.pen,
    fontSize: 18,
    lineHeight: 22,
  },
  form: {
    gap: 14,
  },
  headerCopy: {
    flex: 1,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  infoNote: {
    backgroundColor: paperColors.butter,
    borderColor: paperColors.ink0,
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1.2,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  infoNoteText: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  infoNoteTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 14,
    lineHeight: 18,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 17,
  },
  infoButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  optionCard: {
    alignItems: 'center',
    borderColor: paperColors.ink0,
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 13,
    paddingVertical: 13,
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
  },
  optionIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(253,251,245,0.58)',
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.2,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  optionList: {
    gap: 10,
  },
  optionText: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  optionTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 17,
    lineHeight: 22,
  },
  overlay: {
    backgroundColor: 'rgba(31,27,20,0.32)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: paperColors.ink0,
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: paperColors.card,
    fontFamily: paperFonts.handBold,
    fontSize: 15,
    lineHeight: 20,
  },
  sheet: {
    backgroundColor: paperColors.paper0,
    borderColor: paperColors.ink0,
    borderRadius: 18,
    borderWidth: 1.5,
    maxHeight: 560,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 20,
    ...paperShadow,
  },
  sheetWrap: {
    paddingHorizontal: 14,
    position: 'relative',
  },
  thresholdGuideRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -2,
  },
  textArea: {
    minHeight: 78,
    textAlignVertical: 'top',
  },
  textInput: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 14,
    borderWidth: 1.5,
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  title: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 24,
    lineHeight: 30,
    marginTop: 2,
  },
});
