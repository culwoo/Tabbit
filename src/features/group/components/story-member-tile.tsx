import { StyleSheet, Text, View } from 'react-native';

import { SoftCard } from '@/components/ui/soft-card';
import { colors, radius, spacing, typography } from '@/constants/tokens';
import { formatTimestampLabel } from '@/lib/life-day';

import type { GroupMemberShareCard } from '../model/story-share';

type StoryMemberTileProps = {
  member: GroupMemberShareCard;
  mode?: 'feed' | 'share';
};

export function StoryMemberTile({ member, mode = 'feed' }: StoryMemberTileProps) {
  const isShareMode = mode === 'share';

  return (
    <SoftCard
      style={[
        styles.card,
        isShareMode ? styles.shareCard : styles.feedCard,
        !member.isCertified && styles.pendingCard,
      ]}
      variant="empty">
      <View
        style={[
          styles.poster,
          {
            backgroundColor: member.accentColor,
            minHeight: isShareMode ? 180 : 136,
          },
        ]}>
        <View style={styles.posterHeader}>
          <Text style={styles.posterEmoji}>{member.emoji}</Text>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: member.isCertified ? colors.surface.primary : colors.surface.secondary,
              },
            ]}>
            <Text
              style={[
                styles.statusLabel,
                {
                  color: member.isCertified ? colors.text.primary : colors.text.secondary,
                },
              ]}>
              {member.isCertified ? '인증 완료' : '대기 중'}
            </Text>
          </View>
        </View>
        {member.overlayComment ? (
          <View style={styles.overlayComment}>
            <Text style={styles.overlayCommentText}>{member.overlayComment}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.copy}>
        <View style={styles.copyHeader}>
          <Text style={styles.name}>{member.displayName}</Text>
          <Text style={styles.handle}>{member.handle}</Text>
        </View>
        <Text style={styles.caption}>
          {member.isCertified ? member.caption ?? '오늘의 인증을 남겼어요.' : '아직 이 태그 인증을 올리지 않았어요.'}
        </Text>
        <Text style={styles.timestamp}>
          {member.isCertified ? formatTimestampLabel(member.completedAt) : '오전 5시 전까지 반영 가능'}
        </Text>
      </View>
    </SoftCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.sm,
  },
  feedCard: {
    paddingBottom: spacing.md,
  },
  shareCard: {
    paddingBottom: spacing.sm,
  },
  pendingCard: {
    opacity: 0.78,
  },
  poster: {
    borderRadius: radius.card - 8,
    justifyContent: 'space-between',
    overflow: 'hidden',
    padding: spacing.sm,
  },
  posterHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  posterEmoji: {
    fontSize: 24,
  },
  statusPill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: typography.label.fontWeight,
  },
  overlayComment: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface.primary,
    borderRadius: 16,
    maxWidth: '84%',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  overlayCommentText: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: typography.label.fontWeight,
    lineHeight: 16,
  },
  copy: {
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  copyHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  name: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: typography.title.fontWeight,
    lineHeight: 20,
  },
  handle: {
    color: colors.text.tertiary,
    fontSize: 12,
    fontWeight: typography.label.fontWeight,
    lineHeight: 16,
  },
  caption: {
    color: colors.text.secondary,
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: typography.body.lineHeight,
  },
  timestamp: {
    color: colors.text.tertiary,
    fontSize: 12,
    fontWeight: typography.label.fontWeight,
    lineHeight: 16,
  },
});
