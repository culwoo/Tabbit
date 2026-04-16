import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppHeader } from '@/components/shell/app-header';
import { colors, radius, spacing, typography } from '@/constants/tokens';
import { useAppSession } from '@/providers/app-session-provider';

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc?: string;
  onPress: () => void;
  danger?: boolean;
};

export default function MyScreen() {
  const navigation = useNavigation();
  const { isAuthenticating, signOut, user, userId } = useAppSession();

  function handleBack() {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/index');
    }
  }

  async function handleSignOut() {
    Alert.alert('로그아웃', '정말 로그아웃 하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/sign-in');
        },
      },
    ]);
  }

  const displayName = user?.user_metadata?.full_name ?? 'Tabbit 사용자';
  const email = user?.email ?? '';
  const initial = displayName.charAt(0);

  const menuItems: MenuItem[] = [
    {
      icon: 'person-outline',
      label: '프로필 편집',
      desc: '이름, 핸들, 프로필 사진',
      onPress: () => {},
    },
    {
      icon: 'notifications-outline',
      label: '알림 설정',
      desc: '인증, 채팅, 스토리 알림',
      onPress: () => {},
    },
    {
      icon: 'shield-checkmark-outline',
      label: '계정 및 보안',
      desc: 'Google 연동, 데이터 관리',
      onPress: () => {},
    },
    {
      icon: 'help-circle-outline',
      label: '도움말 & 피드백',
      onPress: () => {},
    },
    {
      icon: 'log-out-outline',
      label: isAuthenticating ? '로그아웃 중…' : '로그아웃',
      onPress: handleSignOut,
      danger: true,
    },
  ];

  return (
    <View style={styles.screen}>
      <AppHeader onBack={handleBack} title="마이페이지" variant="detail" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 프로필 헤더 */}
        <View style={styles.profileSection}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>{initial}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.displayName}>{displayName}</Text>
            {email ? <Text style={styles.email}>{email}</Text> : null}
          </View>
        </View>

        {/* 통계 미리보기 */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>—</Text>
            <Text style={styles.statLabel}>총 인증</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>—</Text>
            <Text style={styles.statLabel}>참여 그룹</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>—</Text>
            <Text style={styles.statLabel}>연속일</Text>
          </View>
        </View>

        {/* 메뉴 */}
        <View style={styles.menuSection}>
          {menuItems.map((item) => (
            <TouchableOpacity
              accessibilityLabel={item.label}
              accessibilityRole="button"
              activeOpacity={0.65}
              key={item.label}
              onPress={item.onPress}
              style={styles.menuRow}
            >
              <View style={[styles.menuIconCircle, item.danger && styles.menuIconCircleDanger]}>
                <Ionicons
                  color={item.danger ? colors.status.danger : colors.brand.primary}
                  name={item.icon}
                  size={18}
                />
              </View>
              <View style={styles.menuTextGroup}>
                <Text style={[styles.menuLabel, item.danger && styles.menuLabelDanger]}>
                  {item.label}
                </Text>
                {item.desc ? <Text style={styles.menuDesc}>{item.desc}</Text> : null}
              </View>
              {!item.danger ? (
                <Ionicons color={colors.text.tertiary} name="chevron-forward" size={16} />
              ) : null}
            </TouchableOpacity>
          ))}
        </View>

        {/* 앱 정보 */}
        <Text style={styles.version}>Tabbit v0.1.0 · MVP</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.bg.canvas,
    flex: 1,
  },
  scrollContent: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },

  // 프로필 헤더
  profileSection: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  avatarLarge: {
    alignItems: 'center',
    backgroundColor: colors.brand.primarySoft,
    borderRadius: 36,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  avatarLargeText: {
    color: colors.brand.primary,
    fontSize: 28,
    fontWeight: '700',
  },
  profileInfo: {
    alignItems: 'center',
    gap: spacing.xxs,
  },
  displayName: {
    color: colors.text.primary,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
  },
  email: {
    color: colors.text.secondary,
    fontSize: typography.body.fontSize,
  },

  // 통계
  statsRow: {
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    borderRadius: radius.card,
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xxs,
  },
  statValue: {
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    color: colors.text.tertiary,
    fontSize: 12,
    fontWeight: '600',
  },
  statDivider: {
    backgroundColor: colors.line.soft,
    height: 28,
    width: 1,
  },

  // 메뉴
  menuSection: {
    backgroundColor: colors.surface.primary,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  menuRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  menuIconCircle: {
    alignItems: 'center',
    backgroundColor: colors.brand.primarySoft,
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  menuIconCircleDanger: {
    backgroundColor: '#F5E5E5',
  },
  menuTextGroup: {
    flex: 1,
    gap: 1,
  },
  menuLabel: {
    color: colors.text.primary,
    fontSize: typography.body.fontSize,
    fontWeight: typography.bodyStrong.fontWeight,
  },
  menuLabelDanger: {
    color: colors.status.danger,
  },
  menuDesc: {
    color: colors.text.tertiary,
    fontSize: 12,
  },

  // 버전
  version: {
    color: colors.text.tertiary,
    fontSize: 12,
    textAlign: 'center',
  },
});
