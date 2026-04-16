import { Alert } from 'react-native';

import { router, useNavigation } from 'expo-router';

import type { HeaderAction } from '@/components/shell/app-header';
import { InfoCard } from '@/components/ui/info-card';
import { PlaceholderScreen } from '@/components/ui/placeholder-screen';
import { demoDate } from '@/lib/sample-data';

export default function PersonalSpaceScreen() {
  const navigation = useNavigation();

  function handleBack() {
    if (navigation.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/index');
  }

  const rightActions: HeaderAction[] = [
    {
      accessibilityLabel: '공유',
      icon: 'share-social-outline',
      onPress: () => Alert.alert('준비 중', '개인공간 공유 메뉴는 06번 화면 계획에서 확정합니다.'),
    },
  ];

  return (
    <PlaceholderScreen
      description="기록과 회고 중심 화면입니다. 그룹 판정과 채팅은 이 영역에 넣지 않습니다."
      header={{
        onBack: handleBack,
        rightActions,
        title: '개인공간',
        variant: 'detail',
      }}
      secondaryAction={{
        label: '날짜 상세 보기',
        onPress: () => router.push(`/calendar/${demoDate}`),
      }}
      title="내 태그 기록">
      <InfoCard
        title="태그 기준 기록"
        description="내가 사용한 태그 pill과 이미지 리스트가 이 화면을 구성합니다."
      />
    </PlaceholderScreen>
  );
}
