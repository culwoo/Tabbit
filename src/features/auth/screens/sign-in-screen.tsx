import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Bunny,
  PhotoBlock,
  Polaroid,
  Scribble,
  Tape,
  paperColors,
  paperFonts,
  paperShadow,
} from '@/components/ui/paper-design';
import { env } from '@/config/env';
import { supabaseRedirectUrl } from '@/features/auth/lib/supabase-auth';
import { useAppSession } from '@/providers/app-session-provider';
import { useFontPreference } from '@/providers/font-preference-provider';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { bodyTextStyle, strongTextStyle } = useFontPreference();
  const {
    authError,
    bootstrapState,
    clearAuthError,
    isAuthenticating,
    isConfigured,
    signInWithGoogle,
  } = useAppSession();

  if (bootstrapState === 'signed-in') {
    return <Redirect href="/" />;
  }

  const configSummary = `환경변수를 먼저 채워야 합니다: ${env.missingSupabaseEnv.join(', ')}`;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: insets.bottom + 36, paddingTop: insets.top + 16 },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <Bunny size={32} />
          <Text style={styles.logo}>tabbit</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={[styles.eyebrow, bodyTextStyle]}>Welcome to Tabbit</Text>
            <Text style={styles.title}>
              오늘도 찰칵,{'\n'}같이 쌓아볼까
            </Text>
            <Scribble width={166} style={styles.titleScribble} />
            <Text style={[styles.description, bodyTextStyle]}>
              친구들과 아침 루틴, 운동, 공부 인증을 같은 기록장에 붙여요.
            </Text>
          </View>
          <View style={styles.heroPolaroidWrap}>
            <Tape angle={-8} left={42} top={-12} width={70} />
            <Polaroid caption="오늘의 한 컷" tilt={-2} tone="sage" width={168}>
              <PhotoBlock height={148} tone="sage">
                <Bunny size={94} />
              </PhotoBlock>
            </Polaroid>
          </View>
        </View>

        <Pressable
          accessibilityLabel="Google로 시작하기"
          accessibilityRole="button"
          disabled={!isConfigured || isAuthenticating}
          onPress={() => void signInWithGoogle()}
          style={({ pressed }) => [
            styles.googleButton,
            (!isConfigured || isAuthenticating) ? styles.disabledButton : undefined,
            pressed && isConfigured && !isAuthenticating ? styles.pressedButton : undefined,
          ]}>
          {isAuthenticating ? (
            <ActivityIndicator color={paperColors.card} />
          ) : (
            <Ionicons color={paperColors.card} name="logo-google" size={19} />
          )}
          <Text style={[styles.googleButtonText, strongTextStyle]}>
            {isAuthenticating ? 'Google 로그인 연결 중' : 'Google로 시작하기'}
          </Text>
        </Pressable>

        <View style={styles.featureRow}>
          <View style={[styles.featureCard, { backgroundColor: paperColors.peach }]}>
            <Ionicons color={paperColors.ink0} name="people-outline" size={20} />
            <Text style={[styles.featureTitle, strongTextStyle]}>그룹 인증</Text>
            <Text style={[styles.featureBody, bodyTextStyle]}>같은 태그로 올리면 스토리 카드가 열려요.</Text>
          </View>
          <View style={[styles.featureCard, { backgroundColor: paperColors.sky }]}>
            <Ionicons color={paperColors.ink0} name="albums-outline" size={20} />
            <Text style={[styles.featureTitle, strongTextStyle]}>개인공간</Text>
            <Text style={[styles.featureBody, bodyTextStyle]}>혼자 남기는 기록도 태그별로 모아요.</Text>
          </View>
        </View>

        {!isConfigured ? (
          <View style={styles.noticeCard}>
            <Tape angle={-6} left={28} top={-10} width={70} />
            <Text style={[styles.noticeTitle, strongTextStyle]}>개발 설정 필요</Text>
            <Text selectable style={[styles.noticeBody, bodyTextStyle]}>
              {configSummary} OAuth redirect: {supabaseRedirectUrl}
            </Text>
          </View>
        ) : null}

        {authError ? (
          <View style={styles.noticeCard}>
            <Tape angle={6} right={28} top={-10} width={70} />
            <Text style={[styles.noticeTitle, strongTextStyle]}>최근 인증 오류</Text>
            <Text selectable style={[styles.noticeBody, bodyTextStyle]}>{authError}</Text>
            <Pressable onPress={clearAuthError} style={styles.secondaryButton}>
              <Text style={[styles.secondaryButtonText, strongTextStyle]}>닫기</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  container: {
    gap: 18,
    paddingHorizontal: 22,
  },
  description: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 18,
  },
  disabledButton: {
    opacity: 0.45,
  },
  eyebrow: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 16,
  },
  featureBody: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  featureCard: {
    borderColor: paperColors.ink0,
    borderRadius: 16,
    borderWidth: 1.4,
    flex: 1,
    minHeight: 116,
    padding: 13,
  },
  featureRow: {
    flexDirection: 'row',
    gap: 10,
  },
  featureTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 15,
    lineHeight: 20,
    marginTop: 10,
  },
  googleButton: {
    alignItems: 'center',
    backgroundColor: paperColors.ink0,
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 18,
    paddingVertical: 13,
    shadowColor: '#0A0908',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  googleButtonText: {
    color: paperColors.card,
    fontFamily: paperFonts.handBold,
    fontSize: 15,
    lineHeight: 20,
  },
  hero: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 20,
    overflow: 'hidden',
    padding: 18,
    position: 'relative',
    ...paperShadow,
  },
  heroCopy: {
    position: 'relative',
    zIndex: 2,
  },
  heroPolaroidWrap: {
    alignSelf: 'center',
    marginTop: 4,
    position: 'relative',
  },
  logo: {
    color: paperColors.ink0,
    fontFamily: paperFonts.pen,
    fontSize: 32,
    lineHeight: 38,
  },
  noticeBody: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 18,
  },
  noticeCard: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 9,
    padding: 15,
    position: 'relative',
    ...paperShadow,
  },
  noticeTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 17,
    lineHeight: 22,
  },
  pressedButton: {
    opacity: 0.86,
    transform: [{ translateY: 1 }],
  },
  screen: {
    backgroundColor: paperColors.paper0,
    flex: 1,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.2,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  secondaryButtonText: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 16,
  },
  title: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 31,
    lineHeight: 38,
    marginTop: 8,
  },
  titleScribble: {
    marginTop: -1,
  },
});
