import { ImageBackground, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/tokens';
import { formatLifeDayLabel, formatTimestampLabel } from '@/lib/life-day';

import type { GroupRow } from '@/lib/supabase';
import type { GroupMemberWithCert, GroupTagEntry } from '../hooks/use-group-detail';

type StoryShareCardProps = {
  group: GroupRow;
  tagEntry: GroupTagEntry;
  width: number;
};

function chunkMembers(members: GroupMemberWithCert[], columns: number) {
  const rows: GroupMemberWithCert[][] = [];

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

function getInitials(displayName: string) {
  const trimmedName = displayName.trim();

  if (!trimmedName) {
    return '?';
  }

  return trimmedName.slice(0, 2);
}

export function StoryShareCard({ group, tagEntry, width }: StoryShareCardProps) {
  const height = width * (16 / 9);
  const columns = getColumnCount(tagEntry.members.length);
  const rows = chunkMembers(tagEntry.members, columns);
  const completionCopy =
    tagEntry.thresholdState.status === 'expired'
      ? '오전 5시 마감 후 고정된 팀 기록'
      : '오전 5시 전까지 현재 화면이 계속 반영돼요';

  return (
    <View style={[styles.frame, { width, height }]}>
      <View style={[styles.paperBand, styles.paperBandTop]} />
      <View style={[styles.paperBand, styles.paperBandBottom]} />

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
          {formatTimestampLabel('unlocked_at' in tagEntry.thresholdState ? (tagEntry.thresholdState.finalized_at ?? tagEntry.thresholdState.unlocked_at ?? undefined) : undefined)}
        </Text>
      </View>

      <View style={styles.mosaic}>
        {rows.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.mosaicRow}>
            {row.map((member, memberIndex) => {
              const panelStyle = [
                styles.memberPanel,
                {
                  backgroundColor: colors.surface.secondary,
                  opacity: member.isCertified ? 1 : 0.58,
                },
              ];
              const panelContent = (
                <>
                  <View style={styles.memberPanelTop}>
                    <View style={styles.memberInitials}>
                      <Text style={styles.memberInitialsText}>{getInitials(member.displayName)}</Text>
                    </View>
                    <View style={styles.memberStatePill}>
                      <Text style={styles.memberStateText}>{member.isCertified ? 'done' : 'wait'}</Text>
                    </View>
                  </View>
                  <View style={styles.memberPanelBottom}>
                    <Text numberOfLines={1} style={styles.memberName}>
                      {member.displayName}
                    </Text>
                    <Text numberOfLines={2} style={styles.memberCaption}>
                      {member.isCertified ? member.caption || '인증 완료' : '인증 대기 중'}
                    </Text>
                  </View>
                </>
              );

              return member.imageUrl ? (
                <ImageBackground
                  imageStyle={styles.memberPanelImage}
                  key={`${member.memberId}-${rowIndex}-${memberIndex}`}
                  source={{ uri: member.imageUrl }}
                  style={panelStyle}>
                  {panelContent}
                </ImageBackground>
              ) : (
                <View key={`${member.memberId}-${rowIndex}-${memberIndex}`} style={panelStyle}>
                  {panelContent}
                </View>
              );
            })}
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
    backgroundColor: colors.bg.warm,
    borderColor: colors.line.warm,
    borderRadius: radius.sheet,
    borderWidth: 1,
    gap: spacing.md,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  paperBand: {
    position: 'absolute',
    height: 84,
    left: -30,
    right: -30,
    transform: [{ rotate: '-7deg' }],
  },
  paperBandTop: {
    top: 42,
    backgroundColor: colors.brand.blushSoft,
  },
  paperBandBottom: {
    bottom: 96,
    backgroundColor: colors.brand.secondarySoft,
    transform: [{ rotate: '6deg' }],
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
    letterSpacing: 0,
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
    letterSpacing: 0,
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
    backgroundColor: colors.surface.raised,
    borderColor: colors.line.soft,
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
    letterSpacing: 0,
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
  memberPanelImage: {
    borderRadius: radius.card - 10,
  },
  memberInitials: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    borderRadius: radius.pill,
    height: 30,
    justifyContent: 'center',
    minWidth: 30,
    paddingHorizontal: spacing.xs,
  },
  memberInitialsText: {
    color: colors.text.primary,
    fontSize: 11,
    fontWeight: '900',
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
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderRadius: radius.input,
    gap: spacing.xxs,
    padding: spacing.xs,
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
    letterSpacing: 0,
  },
});
