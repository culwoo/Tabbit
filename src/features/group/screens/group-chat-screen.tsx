import { router, useLocalSearchParams, useNavigation } from 'expo-router';

import { InfoCard } from '@/components/ui/info-card';
import { PlaceholderScreen } from '@/components/ui/placeholder-screen';

export default function GroupChatScreen() {
  const navigation = useNavigation();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();

  function handleBack() {
    if (navigation.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/index');
  }

  return (
    <PlaceholderScreen
      description={`${groupId ?? 'unknown-group'} 채팅 placeholder입니다. 인증 중심 흐름을 방해하지 않는 가벼운 보조 채널만 유지합니다.`}
      header={{
        onBack: handleBack,
        title: '그룹 채팅',
        variant: 'detail',
      }}
      title="한 방에서 짧게 소통하기">
      <InfoCard
        title="비범위"
        description="1:1 채팅, 사진 첨부 채팅, 스레드 답글은 넣지 않고 한 방에서 짧게 소통하는 구조만 유지합니다."
      />
    </PlaceholderScreen>
  );
}
