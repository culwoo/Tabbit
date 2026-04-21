import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  PaperAvatar,
  Tape,
  paperColors,
  paperFonts,
  paperShadow,
  toneFromIndex,
} from '@/components/ui/paper-design';
import { useAppSession } from '@/providers/app-session-provider';
import { useFontPreference } from '@/providers/font-preference-provider';

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc?: string;
  onPress: () => void;
  danger?: boolean;
};

export default function MyScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { isAuthenticating, signOut, user } = useAppSession();
  const { bodyTextStyle, fontPreset, fontPresets, setFontPreset, strongTextStyle } = useFontPreference();

  function handleBack() {
    if (navigation.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  }

  async function handleSignOut() {
    Alert.alert('로그아웃할까요?', '다시 들어오려면 계정 인증이 필요합니다.', [
      { style: 'cancel', text: '취소' },
      {
        onPress: async () => {
          await signOut();
          router.replace('/sign-in');
        },
        style: 'destructive',
        text: '로그아웃',
      },
    ]);
  }

  const displayName = user?.user_metadata?.full_name ?? 'Tabbit 사용자';
  const email = user?.email ?? '';

  const menuItems: MenuItem[] = [
    {
      desc: '이름, 핸들, 프로필 사진',
      icon: 'person-outline',
      label: '프로필 편집',
      onPress: () => {},
    },
    {
      desc: '인증, 채팅, 스토리 알림',
      icon: 'notifications-outline',
      label: '알림 설정',
      onPress: () => {},
    },
    {
      desc: '로그인, 연결, 데이터',
      icon: 'shield-checkmark-outline',
      label: '계정 및 보안',
      onPress: () => {},
    },
    {
      icon: 'help-circle-outline',
      label: '도움말 & 피드백',
      onPress: () => {},
    },
    {
      danger: true,
      icon: 'log-out-outline',
      label: isAuthenticating ? '로그아웃 중' : '로그아웃',
      onPress: () => void handleSignOut(),
    },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 34, paddingTop: insets.top + 8 },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable accessibilityLabel="뒤로가기" onPress={handleBack} style={styles.iconButton}>
            <Ionicons color={paperColors.ink0} name="chevron-back" size={24} />
          </Pressable>
          <Text style={styles.topTitle}>내 공간</Text>
          <View style={styles.iconButton} />
        </View>

        <View style={styles.profileCard}>
          <Tape angle={-6} left={34} top={-10} width={78} />
          <PaperAvatar label={displayName} size={76} tone="butter" />
          <View style={styles.profileCopy}>
            <Text numberOfLines={1} style={[styles.displayName, strongTextStyle]}>{displayName}</Text>
            {email ? <Text numberOfLines={1} style={[styles.email, bodyTextStyle]}>{email}</Text> : null}
          </View>
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>-</Text>
            <Text style={styles.statLabel}>총 인증</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>-</Text>
            <Text style={styles.statLabel}>참여 그룹</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>-</Text>
            <Text style={styles.statLabel}>연속일</Text>
          </View>
        </View>

        <View style={styles.fontCard}>
          <Tape angle={-5} left={28} top={-10} width={72} />
          <View style={styles.fontHeader}>
            <View>
              <Text style={[styles.fontTitle, strongTextStyle]}>읽는 글씨</Text>
              <Text style={[styles.fontHint, bodyTextStyle]}>로고와 스탬프는 그대로 둬요</Text>
            </View>
            <Ionicons color={paperColors.ink2} name="text-outline" size={21} />
          </View>
          <View style={styles.fontOptions}>
            {fontPresets.map((preset) => {
              const active = preset.id === fontPreset.id;

              return (
                <Pressable
                  accessibilityLabel={`${preset.label} 글씨체 선택`}
                  accessibilityRole="button"
                  key={preset.id}
                  onPress={() => void setFontPreset(preset.id)}
                  style={[
                    styles.fontOption,
                    active ? styles.fontOptionActive : undefined,
                  ]}>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.fontOptionLabel,
                      preset.regularFamily ? { fontFamily: preset.regularFamily } : undefined,
                    ]}>
                    {preset.label}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.fontOptionDesc,
                      preset.regularFamily ? { fontFamily: preset.regularFamily } : undefined,
                    ]}>
                    {preset.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.menuCard}>
          <Tape angle={7} right={30} top={-10} width={74} />
          {menuItems.map((item, index) => (
            <Pressable
              accessibilityLabel={item.label}
              accessibilityRole="button"
              disabled={isAuthenticating && item.danger}
              key={item.label}
              onPress={item.onPress}
              style={[styles.menuRow, index > 0 ? styles.menuRowDivider : undefined]}>
              <View
                style={[
                  styles.menuIconCircle,
                  {
                    backgroundColor: item.danger ? paperColors.peach : paperColors[toneFromIndex(index)],
                  },
                ]}>
                <Ionicons
                  color={item.danger ? paperColors.coral : paperColors.ink0}
                  name={item.icon}
                  size={18}
                />
              </View>
              <View style={styles.menuTextGroup}>
                <Text style={[styles.menuLabel, strongTextStyle, item.danger ? styles.menuLabelDanger : undefined]}>
                  {item.label}
                </Text>
                {item.desc ? <Text style={[styles.menuDesc, bodyTextStyle]}>{item.desc}</Text> : null}
              </View>
              {!item.danger ? (
                <Ionicons color={paperColors.ink2} name="chevron-forward" size={16} />
              ) : null}
            </Pressable>
          ))}
        </View>

        <Text style={[styles.version, bodyTextStyle]}>Tabbit v0.1.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  displayName: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 25,
    lineHeight: 31,
    textAlign: 'center',
  },
  email: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  iconButton: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  fontCard: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 12,
    padding: 16,
    position: 'relative',
    ...paperShadow,
  },
  fontHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fontHint: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  fontOption: {
    backgroundColor: paperColors.paper1,
    borderColor: paperColors.ink0,
    borderRadius: 14,
    borderWidth: 1.1,
    flexBasis: '48%',
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fontOptionActive: {
    backgroundColor: paperColors.butter,
    shadowColor: paperColors.ink0,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  fontOptionDesc: {
    color: paperColors.ink2,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  fontOptionLabel: {
    color: paperColors.ink0,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  fontOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fontTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 20,
    lineHeight: 25,
  },
  menuCard: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 8,
    borderWidth: 1.5,
    overflow: 'hidden',
    position: 'relative',
    ...paperShadow,
  },
  menuDesc: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 1,
  },
  menuIconCircle: {
    alignItems: 'center',
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.2,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  menuLabel: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 15,
    lineHeight: 20,
  },
  menuLabelDanger: {
    color: paperColors.coral,
  },
  menuRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  menuRowDivider: {
    borderTopColor: 'rgba(27,26,23,0.1)',
    borderTopWidth: 1,
  },
  menuTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: paperColors.sage,
    borderColor: paperColors.ink0,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 22,
    position: 'relative',
    ...paperShadow,
  },
  profileCopy: {
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  screen: {
    backgroundColor: paperColors.paper0,
    flex: 1,
  },
  scrollContent: {
    gap: 15,
    paddingHorizontal: 16,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  statDivider: {
    backgroundColor: 'rgba(27,26,23,0.16)',
    height: 30,
    width: 1,
  },
  statLabel: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 11,
    lineHeight: 15,
  },
  statValue: {
    color: paperColors.ink0,
    fontFamily: paperFonts.pen,
    fontSize: 29,
    lineHeight: 32,
  },
  statsCard: {
    alignItems: 'center',
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 8,
    borderWidth: 1.5,
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...paperShadow,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 40,
  },
  topTitle: {
    color: paperColors.ink0,
    flex: 1,
    fontFamily: paperFonts.pen,
    fontSize: 26,
    lineHeight: 32,
    textAlign: 'center',
  },
  version: {
    color: paperColors.ink3,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
});
