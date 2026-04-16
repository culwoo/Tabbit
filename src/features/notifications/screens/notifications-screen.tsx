import { router, useNavigation } from 'expo-router';

import { InfoCard } from '@/components/ui/info-card';
import { PlaceholderScreen } from '@/components/ui/placeholder-screen';
import { demoGroup } from '@/lib/sample-data';

export default function NotificationsScreen() {
  const navigation = useNavigation();

  function handleBack() {
    if (navigation.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/index');
  }

  return (
    <PlaceholderScreen
      description="새 인증, 새 채팅, 초대, 스토리 언락 알림을 모아보는 화면입니다."
      header={{
        onBack: handleBack,
        title: '알림',
        variant: 'detail',
      }}
      title="놓치지 말아야 할 활동"
      secondaryAction={{
        label: '샘플 그룹 열기',
        onPress: () => router.push(`/groups/${demoGroup.id}`),
      }}>
      <InfoCard
        title="우선순위"
        description="이 앱에서는 새 인증과 새 채팅을 상단에 우선 배치하고, 기타 설정 알림은 뒤로 미룹니다."
      />
    </PlaceholderScreen>
  );
}
