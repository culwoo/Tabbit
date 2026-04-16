import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/tokens';
import { formatLifeDayLabel, formatTimestampLabel } from '@/lib/life-day';

import type { GroupMemberShareCard, GroupReadModel, GroupTagReadModel } from '../model/story-share';

type StoryShareCardProps = {
  group: GroupReadModel;
  tagEntry: GroupTagReadModel;
  width: number;
};

function chunkMembers(members: GroupMemberShareCard[], columns: number) {
  const rows: GroupMemberShareCard[][] = [];

  for (let index = 0; index < members.length; index += columns) {
    rows.push(members.slice(index, index + columns));
  }

  return rows;
}

function getColumnCount(memberCount: number) {
  if (memberCount <= 4) {
    return 2;
  }

  if (memberCount <= 9) {
    return 3;
  }

  return 4;
}

export function StoryShareCard({ group, tagEntry, width }: StoryShareCardProps) {
  const height = width * (16 / 9);
  const columns = getColumnCount(tagEntry.members.length);
  const rows = chunkMembers(tagEntry.members, columns);
  const completionCopy =
    tagEntry.thresholdState.status === 'archived'
      ? '오전 5시 마감 후 고정된 팀 기록'
      : '오전 5시 전까지 현재 화면이 계속 반영돼요';

  return (
    <View style={[styles.frame, { width, height }]}>
      <View style={[styles.orb, styles.orbTop]} />
      <View style={[styles.orb, styles.orbBottom]} />

      <View style={styles.header}>
        <View style={styles.brandPill}>
          <Text style={styles.brandPillText}>Tabbit</Text>
        </View>
        <Text style={styles.lifeDay}>{formatLifeDayLabel(tagEntry.lifeDay)}</Text>
      </View>

      <View style={styles.titleBlock}>
        <Text numberOfLines={2} style={styles.title}>
          {group.name} {tagEntry.tagLabel} 완료
        </Text>
        <Text numberOfLines={2} style={styles.subtitle}>
          {completionCopy}
        </Text>
      </View>

      <View style={styles.progressPanel}>
        <View>
          <Text style={styles.progressLabel}>TEAM PROGRESS</Text>
          <Text style={styles.progressValue}>{tagEntry.shareProgressLabel}</Text>
        </View>
        <Text style={styles.progressTime}>
          {formatTimestampLabel(tagEntry.thresholdState.archivedAt ?? tagEntry.thresholdState.unlockedAt)}
        </Text>
      </View>

      <View style={styles.mosaic}>
        {rows.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.mosaicRow}>
            {row.map((member) => (
              <View
                key={member.memberId}
                style={[
                  styles.memberPanel,
                  {
                    backgroundColor: member.accentColor,
                    opacity: member.isCertified ? 1 : 0.58,
                  },
                ]}>
                <View style={styles.memberPanelTop}>
                  <Text style={styles.memberEmoji}>{member.emoji}</Text>
                  <View style={styles.memberStatePill}>
                    <Text style={styles.memberStateText}>{member.isCertified ? 'done' : 'wait'}</Text>
                  </View>
                </View>
                <View style={styles.memberPanelBottom}>
                  <Text numberOfLines={1} style={styles.memberName}>
                    {member.displayName}
                  </Text>
                  <Text numberOfLines={2} style={styles.memberCaption}>
                    {member.isCertified ? member.caption : member.overlayComment ?? '인증 대기 중'}
                  </Text>
                </View>
              </View>
            ))}
            {row.length < columns
              ? Array.from({ length: columns - row.length }).map((_, index) => (
                  <View key={`spacer-${rowIndex}-${index}`} style={styles.memberSpacer} />
                ))
              : null}
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerCaption}>today, together, softly</Text>
        <Text style={styles.footerBrand}>Tabbit</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: '#FFF8F4',
    borderColor: 'rgba(239, 139, 170, 0.22)',
    borderRadius: radius.sheet,
    borderWidth: 1,
    gap: spacing.md,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  orb: {
    position: 'absolute',
    borderRadius: radius.pill,
  },
  orbTop: {
    top: -86,
    right: -78,
    width: 190,
    height: 190,
    backgroundColor: 'rgba(156, 204, 232, 0.38)',
  },
  orbBottom: {
    bottom: -118,
    left: -88,
    width: 230,
    height: 230,
    backgroundColor: 'rgba(239, 139, 170, 0.24)',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  brandPill: {
    backgroundColor: colors.surface.inverse,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  brandPillText: {
    color: colors.text.inverse,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  lifeDay: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: typography.label.fontWeight,
  },
  titleBlock: {
    gap: spacing.xs,
    zIndex: 1,
  },
  title: {
    color: colors.text.primary,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 37,
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: typography.body.fontWeight,
    lineHeight: 20,
  },
  progressPanel: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderColor: 'rgba(232, 221, 234, 0.92)',
    borderRadius: radius.card - 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    zIndex: 1,
  },
  progressLabel: {
    color: colors.text.tertiary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  progressValue: {
    color: colors.text.primary,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    lineHeight: 24,
  },
  progressTime: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: typography.label.fontWeight,
    maxWidth: 116,
    textAlign: 'right',
  },
  mosaic: {
    flex: 1,
    gap: spacing.sm,
    zIndex: 1,
  },
  mosaicRow: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  memberPanel: {
    borderColor: 'rgba(255, 255, 255, 0.78)',
    borderRadius: radius.card - 10,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'space-between',
    overflow: 'hidden',
    padding: spacing.sm,
  },
  memberSpacer: {
    flex: 1,
  },
  memberPanelTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  memberEmoji: {
    fontSize: 26,
  },
  memberStatePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.76)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  memberStateText: {
    color: colors.text.primary,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  memberPanelBottom: {
    gap: spacing.xxs,
  },
  memberName: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 18,
  },
  memberCaption: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: typography.label.fontWeight,
    lineHeight: 15,
  },
  footer: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  footerCaption: {
    color: colors.text.tertiary,
    fontSize: 12,
    fontWeight: typography.label.fontWeight,
  },
  footerBrand: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
});
