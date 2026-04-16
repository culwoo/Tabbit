import { AppButton } from '@/components/ui/app-button';
import { InfoCard } from '@/components/ui/info-card';
import { PlaceholderScreen } from '@/components/ui/placeholder-screen';
import { env } from '@/config/env';
import { supabaseRedirectUrl } from '@/features/auth/lib/supabase-auth';
import { useAppSession } from '@/providers/app-session-provider';

export default function SignInScreen() {
  const { authError, clearAuthError, isAuthenticating, isConfigured, signInWithGoogle } = useAppSession();

  const primaryLabel = isAuthenticating ? 'Google 로그인 연결 중...' : 'Google로 시작하기';
  const configSummary = isConfigured
    ? `Supabase URL과 키가 준비되어 있습니다. OAuth redirect는 ${supabaseRedirectUrl} 기준으로 동작합니다.`
    : `환경변수를 먼저 채워야 합니다: ${env.missingSupabaseEnv.join(', ')}`;

  return (
    <PlaceholderScreen
      description="Supabase Auth 기준 signed-out 게이트입니다. Google OAuth와 세션 복구를 이 화면에서 시작합니다."
      eyebrow="Supabase Auth bootstrap"
      primaryAction={{
        disabled: !isConfigured || isAuthenticating,
        label: primaryLabel,
        onPress: signInWithGoogle,
      }}
      title="Tabbit 로그인">
      <InfoCard
        title="현재 부트스트랩 상태"
        description={`env=${env.appEnv}, ${configSummary}`}
      />
      <InfoCard
        title="지금 필요한 설정"
        description="Supabase Auth에서 Google provider를 켜고 redirect URL에 `tabbit://**`를 추가해야 실제 로그인 왕복이 끝납니다."
      />
      {authError ? (
        <InfoCard title="최근 인증 오류" description={authError}>
          <AppButton label="오류 메시지 닫기" onPress={clearAuthError} variant="secondary" />
        </InfoCard>
      ) : null}
    </PlaceholderScreen>
  );
}
