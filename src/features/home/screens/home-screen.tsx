import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import type { HeaderAction } from '@/components/shell/app-header';
import { PlaceholderScreen } from '@/components/ui/placeholder-screen';
import { SoftCard } from '@/components/ui/soft-card';
import { TagPill } from '@/components/ui/tag-pill';
import { colors, spacing, typography } from '@/constants/tokens';
import { demoGroups, demoPersonalSpace } from '@/lib/sample-data';

function ActivityBadge({ label }: { label: string }) {
  const backgroundColor = label.includes('채팅') ? colors.badge.chat : colors.badge.certification;

  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

function TagRail({ tags }: { tags: readonly string[] }) {
  const visibleTags = tags.slice(0, 4);
  const overflowCount = Math.max(tags.length - visibleTags.length, 0);

  return (
    <View style={styles.tagRail}>
      {visibleTags.map((tag) => (
        <TagPill key={tag} label={tag} />
      ))}
      {overflowCount > 0 ? <TagPill label="overflow" overflowCount={overflowCount} /> : null}
    </View>
  );
}

const rightActions: HeaderAction[] = [
  {
    accessibilityLabel: '그룹 생성 또는 참여',
    icon: 'add',
    onPress: () => router.push('/group-actions'),
  },
  {
    accessibilityLabel: '알림',
    icon: 'notifications-outline',
    onPress: () => router.push('/notifications'),
  },
  {
    accessibilityLabel: '마이페이지',
    icon: 'person-circle-outline',
    onPress: () => router.push('/profile'),
  },
];

export default function HomeScreen() {
  return (
    <PlaceholderScreen
      description="개인공간 1개와 참여 그룹 카드 리스트만 두고, 상단 액션은 헤더 우측에서만 처리합니다."
      header={{
        rightActions,
        variant: 'home',
      }}
      title="오늘 어디로 들어갈까요?">
      <SoftCard style={styles.card} variant="personal-space">
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle}>{demoPersonalSpace.name}</Text>
          <Text style={styles.cardMeta}>기록/회고</Text>
        </View>
        <Text style={styles.recentActivity}>{demoPersonalSpace.recentActivity}</Text>
        <TagRail tags={demoPersonalSpace.tags} />
        <Text style={styles.cardMeta}>그룹 판정, 채팅, 임계값 UI는 여기서 제외합니다.</Text>
        <Text onPress={() => router.push('/personal')} style={styles.linkText}>
          개인공간 열기
        </Text>
      </SoftCard>

      {demoGroups.map((group) => (
        <SoftCard key={group.id} style={styles.card} variant="group-space">
          <View style={styles.cardTopRow}>
            <View style={styles.titleWithBadge}>
              <Text style={styles.cardTitle}>{group.name}</Text>
              <ActivityBadge label={group.activityBadge} />
            </View>
            <Text style={styles.cardMeta}>{group.members}명</Text>
          </View>
          <Text style={styles.recentActivity}>{group.recentActivity}</Text>
          <TagRail tags={group.tags} />
          <Text style={styles.cardMeta}>{group.threshold} · 태그 기준 인증 피드</Text>
          <Text onPress={() => router.push(`/groups/${group.id}`)} style={styles.linkText}>
            그룹 상세 열기
          </Text>
        </SoftCard>
      ))}
    </PlaceholderScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  cardTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  titleWithBadge: {
    flex: 1,
    gap: spacing.xs,
  },
  cardTitle: {
    color: colors.text.primary,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    lineHeight: typography.title.lineHeight,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  recentActivity: {
    color: colors.text.secondary,
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: typography.body.lineHeight,
  },
  tagRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    minHeight: 72,
  },
  cardMeta: {
    color: colors.text.tertiary,
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
    lineHeight: 20,
  },
  linkText: {
    color: colors.brand.primary,
    fontSize: typography.body.fontSize,
    fontWeight: typography.bodyStrong.fontWeight,
    lineHeight: typography.body.lineHeight,
  },
});
