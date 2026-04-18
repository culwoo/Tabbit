import { Redirect } from 'expo-router';

import { AppButton } from '@/components/ui/app-button';
import { InfoCard } from '@/components/ui/info-card';
import { PlaceholderScreen } from '@/components/ui/placeholder-screen';
import { env } from '@/config/env';
import { supabaseRedirectUrl } from '@/features/auth/lib/supabase-auth';
import { useAppSession } from '@/providers/app-session-provider';

export default function SignInScreen() {
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

  const primaryLabel = isAuthenticating ? 'Google 로그인 연결 중...' : 'Google로 시작하기';
  const configSummary = `환경변수를 먼저 채워야 합니다: ${env.missingSupabaseEnv.join(', ')}`;

  return (
    <PlaceholderScreen
      description="친구들과 아침 루틴, 운동, 공부 인증을 같이 쌓아가요."
      eyebrow="Welcome to Tabbit"
      primaryAction={{
        disabled: !isConfigured || isAuthenticating,
        icon: 'logo-google',
        label: primaryLabel,
        onPress: signInWithGoogle,
      }}
      title="오늘도 같이 한 칸 채워볼까요?">
      <InfoCard title="그룹 인증" description="친구들이 같은 태그로 인증하면 오늘의 스토리 카드가 열립니다." />
      <InfoCard title="개인공간" description="그룹에 올리지 않는 기록도 태그별로 조용히 모아둘 수 있어요." />
      {!isConfigured ? (
        <InfoCard title="개발 설정 필요" description={`${configSummary} OAuth redirect: ${supabaseRedirectUrl}`} />
      ) : null}
      {authError ? (
        <InfoCard title="최근 인증 오류" description={authError}>
          <AppButton label="오류 메시지 닫기" onPress={clearAuthError} variant="secondary" />
        </InfoCard>
      ) : null}
    </PlaceholderScreen>
  );
}
