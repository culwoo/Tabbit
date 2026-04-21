import { StyleSheet, Text, View } from 'react-native';

import {
  Bunny,
  Polaroid,
  Scribble,
  Tape,
  paperColors,
  paperFonts,
  toneFromIndex,
} from '@/components/ui/paper-design';
import { formatLifeDayLabel } from '@/lib/life-day';

import type { GroupRow } from '@/lib/supabase';
import type { GroupMemberWithCert, GroupTagEntry } from '../hooks/use-group-detail';

type StoryShareCardProps = {
  group: GroupRow;
  tagEntry: GroupTagEntry;
  width: number;
};

function getDisplayName(member: GroupMemberWithCert) {
  return member.displayName.trim() || member.handle || 'member';
}

function getSignature(members: GroupMemberWithCert[]) {
  const names = members.slice(0, 4).map(getDisplayName);

  if (members.length > 4) {
    return `${names.join(', ')} +${members.length - 4}`;
  }

  return names.join(', ');
}

export function StoryShareCard({ group, tagEntry, width }: StoryShareCardProps) {
  const height = width * (16 / 9);
  const scale = width / 360;
  const borderInset = 15 * scale;
  const members = tagEntry.members.slice(0, 4);
  const certifiedCount = tagEntry.members.filter((member) => member.isCertified).length;
  const polaroidW = 124 * scale;
  const photoH = 108 * scale;
  const titleFont = 50 * scale;

  const positions = [
    { left: 32 * scale, top: height * 0.42, tilt: -5, tape: -6 },
    { right: 28 * scale, top: height * 0.405, tilt: 4, tape: 8 },
    { left: 58 * scale, top: height * 0.62, tilt: -2, tape: 4 },
    { right: 46 * scale, top: height * 0.63, tilt: 6, tape: -8 },
  ];

  return (
    <View style={[styles.frame, { height, width }]}>
      <View style={styles.paperWashA} />
      <View style={styles.paperWashB} />
      <View
        pointerEvents="none"
        style={[
          styles.outerBorder,
          {
            borderRadius: 12 * scale,
            inset: borderInset,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.innerBorder,
          {
            borderRadius: 8 * scale,
            inset: borderInset + 6 * scale,
          },
        ]}
      />

      <View style={[styles.header, { paddingHorizontal: 34 * scale, paddingTop: 38 * scale }]}>
        <View style={styles.brandRow}>
          <Bunny size={28 * scale} />
          <Text style={[styles.brand, { fontSize: 28 * scale, lineHeight: 32 * scale }]}>
            tabbit
          </Text>
        </View>
        <Text style={[styles.date, { fontSize: 18 * scale, lineHeight: 23 * scale }]}>
          {formatLifeDayLabel(tagEntry.lifeDay)}
        </Text>
      </View>
      <View style={[styles.headerLine, { left: 34 * scale, right: 34 * scale, top: 80 * scale }]} />

      <View style={[styles.titleBlock, { paddingHorizontal: 34 * scale, top: 92 * scale }]}>
        <Text style={[styles.warmLead, { fontSize: 28 * scale, lineHeight: 32 * scale }]}>
          오늘 우리,
        </Text>
        <View style={styles.titleWrap}>
          <Text style={[styles.title, { fontSize: titleFont, lineHeight: titleFont * 1.02 }]}>
            함께 갓생
          </Text>
          <Scribble style={styles.titleScribble} width={230 * scale} />
        </View>
        <Text
          numberOfLines={2}
          style={[
            styles.handNote,
            {
              fontSize: 24 * scale,
              lineHeight: 29 * scale,
              marginTop: 14 * scale,
            },
          ]}>
          {group.name}의 진짜 기록이야
        </Text>
      </View>

      <View style={styles.collageLayer}>
        {members.map((member, index) => {
          const position = positions[index];

          return (
            <View
              key={member.memberId}
              style={[
                styles.memberPolaroid,
                {
                  left: position.left,
                  right: position.right,
                  top: position.top,
                  transform: [{ rotate: `${position.tilt}deg` }],
                },
              ]}>
              <Tape
                angle={position.tape}
                left={30 * scale}
                top={-8 * scale}
                width={42 * scale}
              />
              <Polaroid
                caption={getDisplayName(member)}
                handNote={member.isCertified && index === 0 ? '찰칵' : null}
                photoHeight={photoH}
                tone={toneFromIndex(index + 1)}
                uri={member.imageUrl}
                width={polaroidW}
              />
            </View>
          );
        })}
      </View>

      <View
        style={[
          styles.footer,
          {
            bottom: 34 * scale,
            left: 34 * scale,
            right: 34 * scale,
          },
        ]}>
        <Text
          numberOfLines={2}
          style={[
            styles.signature,
            {
              fontSize: 23 * scale,
              lineHeight: 27 * scale,
              maxWidth: width * 0.62,
            },
          ]}>
          by {getSignature(tagEntry.members)}
        </Text>
        <View style={styles.footerMeta}>
          <Text style={[styles.streak, { fontSize: 22 * scale, lineHeight: 24 * scale }]}>
            {certifiedCount}/{tagEntry.members.length}
          </Text>
          <Text style={[styles.footerBrand, { fontSize: 10 * scale, lineHeight: 12 * scale }]}>
            TABBIT
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: {
    color: paperColors.ink0,
    fontFamily: paperFonts.pen,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  collageLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  date: {
    color: paperColors.ink2,
    fontFamily: paperFonts.pen,
  },
  footer: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'absolute',
    zIndex: 4,
  },
  footerBrand: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 3,
  },
  footerMeta: {
    alignItems: 'flex-end',
  },
  frame: {
    backgroundColor: paperColors.paper0,
    overflow: 'hidden',
    position: 'relative',
  },
  handNote: {
    color: paperColors.coral,
    fontFamily: paperFonts.pen,
    transform: [{ rotate: '-1deg' }],
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'relative',
    zIndex: 5,
  },
  headerLine: {
    backgroundColor: paperColors.ink0,
    height: 1.5,
    opacity: 0.15,
    position: 'absolute',
    zIndex: 1,
  },
  innerBorder: {
    borderColor: paperColors.ink2,
    borderStyle: 'dashed',
    borderWidth: 1,
    opacity: 0.72,
    position: 'absolute',
  },
  memberPolaroid: {
    position: 'absolute',
  },
  outerBorder: {
    borderColor: paperColors.ink0,
    borderWidth: 1.5,
    position: 'absolute',
  },
  paperWashA: {
    backgroundColor: 'rgba(180,160,120,0.08)',
    borderRadius: 999,
    height: 240,
    left: -70,
    position: 'absolute',
    top: 130,
    width: 240,
  },
  paperWashB: {
    backgroundColor: 'rgba(140,120,90,0.06)',
    borderRadius: 999,
    bottom: 70,
    height: 280,
    position: 'absolute',
    right: -90,
    width: 280,
  },
  signature: {
    color: paperColors.ink0,
    fontFamily: paperFonts.pen,
    transform: [{ rotate: '-2deg' }],
  },
  streak: {
    color: paperColors.coral,
    fontFamily: paperFonts.pen,
  },
  title: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    letterSpacing: -1,
  },
  titleBlock: {
    position: 'absolute',
    zIndex: 3,
  },
  titleScribble: {
    bottom: -4,
    left: 0,
    position: 'absolute',
  },
  titleWrap: {
    alignSelf: 'flex-start',
    position: 'relative',
  },
  warmLead: {
    color: paperColors.ink2,
    fontFamily: paperFonts.pen,
  },
});
