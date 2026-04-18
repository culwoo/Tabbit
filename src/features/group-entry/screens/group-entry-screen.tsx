import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { SoftCard } from '@/components/ui/soft-card';
import { colors, radius, shadow, spacing, typography } from '@/constants/tokens';
import { useAppSession } from '@/providers/app-session-provider';
import { createGroup, joinGroupByInviteCode, type GroupRow } from '@/lib/supabase';

type Mode = 'menu' | 'create' | 'join';
type ThresholdOption = GroupRow['threshold_rule'];

const thresholdOptions: { value: ThresholdOption; label: string; desc: string }[] = [
  { value: 'ALL', label: '전원', desc: '모든 멤버가 인증해야 언락' },
  { value: 'N_MINUS_1', label: 'N-1', desc: '한 명 빠져도 언락' },
  { value: 'N_MINUS_2', label: 'N-2', desc: '두 명까지 빠져도 언락' },
];

export default function GroupEntryScreen() {
  const navigation = useNavigation();
  const { userId } = useAppSession();
  const [mode, setMode] = useState<Mode>('menu');
  const [loading, setLoading] = useState(false);

  // 생성 폼
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [threshold, setThreshold] = useState<ThresholdOption>('N_MINUS_1');

  // 참여 폼
  const [inviteCode, setInviteCode] = useState('');

  const handleClose = useCallback(() => {
    if (navigation.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  }, [navigation]);

  const handleCreate = useCallback(async () => {
    if (!groupName.trim() || !userId) return;

    Keyboard.dismiss();
    setLoading(true);

    try {
      const group = await createGroup({
        name: groupName.trim(),
        description: groupDesc.trim() || undefined,
        thresholdRule: threshold,
        createdBy: userId,
      });

      Alert.alert('그룹 생성 완료!', `"${group.name}" 그룹이 만들어졌어요.`, [
        { text: '확인', onPress: () => router.replace(`/groups/${group.id}`) },
      ]);
    } catch (err: any) {
      Alert.alert('생성 실패', err?.message ?? '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }, [groupName, groupDesc, threshold, userId]);

  const handleJoin = useCallback(async () => {
    if (!inviteCode.trim() || !userId) return;

    Keyboard.dismiss();
    setLoading(true);

    try {
      const result = await joinGroupByInviteCode(inviteCode.trim(), userId);
      Alert.alert('참여 완료!', `"${result.groupName}" 그룹에 참여했어요.`, [
        { text: '확인', onPress: () => router.replace(`/groups/${result.groupId}`) },
      ]);
    } catch (err: any) {
      Alert.alert('참여 실패', err?.message ?? '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }, [inviteCode, userId]);

  return (
    <View style={styles.overlay}>
      <Pressable accessibilityLabel="닫기" onPress={handleClose} style={StyleSheet.absoluteFill} />
      <View style={styles.sheetWrap}>
        <SoftCard style={styles.sheet} variant="empty">
          {/* 헤더 */}
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>
                {mode === 'menu' ? 'Team setup' : mode === 'create' ? '새 그룹' : '그룹 참여'}
              </Text>
              <Text style={styles.title}>
                {mode === 'menu' ? '같이 인증할 공간 만들기' : mode === 'create' ? '그룹 만들기' : '초대 코드 입력'}
              </Text>
            </View>
            {mode !== 'menu' ? (
              <TouchableOpacity
                accessibilityLabel="뒤로"
                activeOpacity={0.7}
                onPress={() => setMode('menu')}
                style={styles.backButton}
              >
                <Ionicons color={colors.text.secondary} name="arrow-back" size={18} />
              </TouchableOpacity>
            ) : null}
            <AppButton icon="close" label="닫기" onPress={handleClose} variant="secondary" />
          </View>

          {/* 메뉴 */}
          {mode === 'menu' ? (
            <View style={styles.optionList}>
              <TouchableOpacity
                accessibilityLabel="그룹 만들기"
                accessibilityRole="button"
                activeOpacity={0.7}
                onPress={() => setMode('create')}
                style={styles.optionItem}
              >
                <Ionicons color={colors.brand.primary} name="add-circle" size={24} />
                <View style={styles.optionCopy}>
                  <Text style={styles.optionTitle}>그룹 만들기</Text>
                  <Text style={styles.optionDescription}>이름과 언락 기준을 정하고 친구를 초대해요</Text>
                </View>
                <Ionicons color={colors.text.tertiary} name="chevron-forward" size={18} />
              </TouchableOpacity>

              <TouchableOpacity
                accessibilityLabel="초대 코드로 참여"
                accessibilityRole="button"
                activeOpacity={0.7}
                onPress={() => setMode('join')}
                style={styles.optionItem}
              >
                <Ionicons color={colors.brand.secondary} name="enter" size={24} />
                <View style={styles.optionCopy}>
                  <Text style={styles.optionTitle}>초대 코드로 참여</Text>
                  <Text style={styles.optionDescription}>친구에게 받은 코드를 입력하고 바로 합류해요</Text>
                </View>
                <Ionicons color={colors.text.tertiary} name="chevron-forward" size={18} />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* 생성 폼 */}
          {mode === 'create' ? (
            <View style={styles.formSection}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>그룹 이름 *</Text>
                <TextInput
                  autoFocus
                  maxLength={30}
                  onChangeText={setGroupName}
                  placeholder="예: 새벽 운동팟"
                  placeholderTextColor={colors.text.tertiary}
                  style={styles.textInput}
                  value={groupName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>설명 (선택)</Text>
                <TextInput
                  maxLength={100}
                  multiline
                  numberOfLines={2}
                  onChangeText={setGroupDesc}
                  placeholder="그룹에 대한 한 줄 소개"
                  placeholderTextColor={colors.text.tertiary}
                  style={[styles.textInput, styles.textArea]}
                  value={groupDesc}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>임계값 규칙</Text>
                <View style={styles.thresholdRow}>
                  {thresholdOptions.map((opt) => (
                    <TouchableOpacity
                      accessibilityLabel={opt.label}
                      activeOpacity={0.7}
                      key={opt.value}
                      onPress={() => setThreshold(opt.value)}
                      style={[
                        styles.thresholdChip,
                        threshold === opt.value && styles.thresholdChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.thresholdChipLabel,
                          threshold === opt.value && styles.thresholdChipLabelSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      <Text style={styles.thresholdChipDesc}>{opt.desc}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <AppButton
                disabled={!groupName.trim() || loading}
                label={loading ? '생성 중…' : '그룹 만들기'}
                onPress={handleCreate}
              />
            </View>
          ) : null}

          {/* 참여 폼 */}
          {mode === 'join' ? (
            <View style={styles.formSection}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>초대 코드</Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  maxLength={20}
                  onChangeText={setInviteCode}
                  placeholder="예: a3f2b1c9e0d4"
                  placeholderTextColor={colors.text.tertiary}
                  style={styles.textInput}
                  value={inviteCode}
                />
              </View>

              <AppButton
                disabled={!inviteCode.trim() || loading}
                label={loading ? '참여 중…' : '그룹 참여하기'}
                onPress={handleJoin}
              />
            </View>
          ) : null}

          {loading ? (
            <ActivityIndicator color={colors.brand.primary} style={styles.loader} />
          ) : null}
        </SoftCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: colors.bg.overlay,
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    padding: spacing.md,
  },
  sheet: {
    backgroundColor: colors.bg.warm,
    borderColor: colors.line.warm,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
    ...shadow.sheet,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.brand.accent,
    fontSize: typography.eyebrow.fontSize,
    fontWeight: typography.eyebrow.fontWeight,
    lineHeight: typography.eyebrow.lineHeight,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    lineHeight: typography.title.lineHeight,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.surface.tertiary,
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },

  // 메뉴
  optionList: {
    gap: spacing.sm,
  },
  optionItem: {
    alignItems: 'center',
    backgroundColor: colors.surface.raised,
    borderColor: colors.line.warm,
    borderRadius: radius.input,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  optionCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  optionTitle: {
    color: colors.text.primary,
    fontSize: typography.body.fontSize,
    fontWeight: typography.bodyStrong.fontWeight,
  },
  optionDescription: {
    color: colors.text.secondary,
    fontSize: typography.label.fontSize,
    lineHeight: 18,
  },

  // 폼
  formSection: {
    gap: spacing.md,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  inputLabel: {
    color: colors.text.secondary,
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
  },
  textInput: {
    backgroundColor: colors.surface.raised,
    borderColor: colors.line.warm,
    borderRadius: radius.input,
    borderWidth: 1,
    color: colors.text.primary,
    fontSize: typography.body.fontSize,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  textArea: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  thresholdRow: {
    gap: spacing.xs,
  },
  thresholdChip: {
    backgroundColor: colors.surface.raised,
    borderColor: colors.line.soft,
    borderRadius: radius.input,
    borderWidth: 1,
    gap: spacing.xxs,
    padding: spacing.sm,
  },
  thresholdChipSelected: {
    backgroundColor: colors.brand.butterSoft,
    borderColor: colors.brand.accent,
  },
  thresholdChipLabel: {
    color: colors.text.primary,
    fontSize: typography.label.fontSize,
    fontWeight: typography.bodyStrong.fontWeight,
  },
  thresholdChipLabelSelected: {
    color: colors.text.primary,
  },
  thresholdChipDesc: {
    color: colors.text.secondary,
    fontSize: 12,
  },
  loader: {
    marginTop: spacing.sm,
  },
});
