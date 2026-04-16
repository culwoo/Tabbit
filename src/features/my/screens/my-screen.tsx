import { router, useNavigation } from 'expo-router';

import { InfoCard } from '@/components/ui/info-card';
import { PlaceholderScreen } from '@/components/ui/placeholder-screen';
import { useAppSession } from '@/providers/app-session-provider';

export default function MyScreen() {
  const navigation = useNavigation();
  const { isAuthenticating, signOut, user } = useAppSession();

  function handleBack() {
    if (navigation.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/index');
  }

  async function handleSignOut() {
    await signOut();
    router.replace('/sign-in');
  }

  return (
    <PlaceholderScreen
      description="프로필, 로그아웃, 알림 설정, 계정 정보가 들어갈 마이페이지 placeholder입니다."
      header={{
        onBack: handleBack,
        title: '마이페이지',
        variant: 'detail',
      }}
      secondaryAction={{
        disabled: isAuthenticating,
        label: isAuthenticating ? '로그아웃 처리 중...' : '로그아웃',
        onPress: () => {
          void handleSignOut();
        },
      }}
      title="내 기록과 설정">
      <InfoCard
        title="이번 단계 범위"
        description="프로필 편집, 알림 토글, 계정 연결은 아직 넣지 않고 셸과 라우트만 고정합니다."
      />
      <InfoCard
        title="현재 세션"
        description={user?.email ? `로그인 사용자: ${user.email}` : '세션 사용자 정보가 아직 없습니다.'}
      />
    </PlaceholderScreen>
  );
}
