import type { PropsWithChildren } from 'react';
import {
  ImageBackground,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

export const paperColors = {
  paper0: '#FBF7F0',
  paper1: '#F4EEE2',
  paper2: '#E9E0CE',
  card: '#FDFBF5',
  ink0: '#1B1A17',
  ink1: '#32302B',
  ink2: '#6B6861',
  ink3: '#A8A49A',
  line: '#2A2824',
  mint: '#B9D3C2',
  sage: '#B9D3C2',
  peach: '#F1C9B3',
  sky: '#BFD2DE',
  butter: '#EAD48A',
  coral: '#D98773',
  lilac: '#C7BEDB',
  kraft: '#E9E0CE',
  tape: 'rgba(234, 212, 138, 0.55)',
} as const;

export type PaperTone = 'sage' | 'peach' | 'sky' | 'butter' | 'lilac' | 'kraft' | 'mint';

const toneOrder: PaperTone[] = ['sage', 'peach', 'sky', 'butter', 'lilac', 'kraft'];

export function toneFromIndex(index: number): PaperTone {
  return toneOrder[index % toneOrder.length];
}

export function colorForTone(tone: PaperTone) {
  return paperColors[tone];
}

export const paperFonts = {
  pen: 'NanumPenScript',
  hand: 'Gaegu',
  handBold: 'Gaegu-Bold',
} as const;

export const paperShadow = {
  shadowColor: '#1E190F',
  shadowOpacity: 0.12,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const;

export function stripHash(label: string) {
  return label.trim().replace(/^#+/, '');
}

export function withHash(label: string) {
  const clean = stripHash(label);
  return clean ? `#${clean}` : '#';
}

export function firstGlyph(value: string) {
  const trimmed = value.trim();
  return Array.from(trimmed)[0] ?? '?';
}

type BunnyProps = {
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function Bunny({ size = 44, style }: BunnyProps) {
  const headW = size * 0.76;
  const headH = size * 0.58;
  const earW = size * 0.18;
  const earH = size * 0.48;

  return (
    <View style={[{ width: size, height: size * 1.14 }, style]}>
      <View
        style={[
          styles.bunnyEar,
          {
            width: earW,
            height: earH,
            left: size * 0.18,
            top: size * 0.04,
            borderRadius: earW,
            transform: [{ rotate: '-5deg' }],
          },
        ]}>
        <View style={[styles.bunnyInnerEar, { width: earW * 0.42, height: earH * 0.56 }]} />
      </View>
      <View
        style={[
          styles.bunnyEar,
          {
            width: earW,
            height: earH,
            right: size * 0.18,
            top: size * 0.04,
            borderRadius: earW,
            transform: [{ rotate: '5deg' }],
          },
        ]}>
        <View style={[styles.bunnyInnerEar, { width: earW * 0.42, height: earH * 0.56 }]} />
      </View>
      <View
        style={[
          styles.bunnyHead,
          {
            width: headW,
            height: headH,
            left: (size - headW) / 2,
            top: size * 0.39,
            borderRadius: headW * 0.42,
          },
        ]}>
        <View style={[styles.bunnyEye, { left: headW * 0.29, top: headH * 0.44 }]} />
        <View style={[styles.bunnyEye, { right: headW * 0.29, top: headH * 0.44 }]} />
        <View style={[styles.bunnyCheek, { left: headW * 0.16, top: headH * 0.61 }]} />
        <View style={[styles.bunnyCheek, { right: headW * 0.16, top: headH * 0.61 }]} />
        <View style={[styles.bunnyNose, { left: headW * 0.47, top: headH * 0.6 }]} />
      </View>
    </View>
  );
}

type TapeProps = {
  width?: number;
  angle?: number;
  top?: number;
  left?: number;
  right?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export function Tape({
  width = 60,
  angle = -6,
  top = -10,
  left,
  right,
  color = paperColors.tape,
  style,
}: TapeProps) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.tape,
        {
          width,
          top,
          left,
          right,
          backgroundColor: color,
          transform: [{ rotate: `${angle}deg` }],
        },
        style,
      ]}
    />
  );
}

type PhotoBlockProps = PropsWithChildren<{
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  tone?: PaperTone;
  label?: string;
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}>;

export function PhotoBlock({
  width = '100%',
  height = 120,
  tone = 'kraft',
  label = '',
  uri,
  style,
  imageStyle,
  children,
}: PhotoBlockProps) {
  const baseStyle = [
    styles.photo,
    {
      width,
      height,
      backgroundColor: colorForTone(tone),
    },
    style,
  ];

  const content = (
    <>
      {Array.from({ length: 7 }).map((_, index) => (
        <View
          key={`stripe-${index}`}
          style={[
            styles.photoStripe,
            {
              top: index * 24 - 36,
              transform: [{ rotate: '-34deg' }],
            },
          ]}
        />
      ))}
      {children ?? (label ? <Text style={styles.photoLabel}>{label}</Text> : null)}
    </>
  );

  if (uri) {
    return (
      <ImageBackground imageStyle={imageStyle} source={{ uri }} style={baseStyle}>
        {children ?? null}
      </ImageBackground>
    );
  }

  return <View style={baseStyle}>{content}</View>;
}

type PolaroidProps = PropsWithChildren<{
  width?: number;
  photoHeight?: number;
  tone?: PaperTone;
  label?: string;
  caption?: string;
  handNote?: string | null;
  tilt?: number;
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
}>;

export function Polaroid({
  width = 120,
  photoHeight,
  tone = 'kraft',
  label,
  caption,
  handNote,
  tilt = 0,
  uri,
  style,
  children,
}: PolaroidProps) {
  return (
    <View
      style={[
        styles.polaroid,
        {
          width,
          paddingBottom: caption ? 30 : 10,
          transform: [{ rotate: `${tilt}deg` }],
        },
        style,
      ]}>
      {children ?? (
        <PhotoBlock
          height={photoHeight ?? width}
          label={label}
          tone={tone}
          uri={uri}
          imageStyle={styles.polaroidImage}
        />
      )}
      {caption ? (
        <Text numberOfLines={1} style={styles.polaroidCaption}>
          {caption}
        </Text>
      ) : null}
      {handNote ? <Text style={styles.handNote}>{handNote}</Text> : null}
    </View>
  );
}

type AvatarProps = {
  label: string;
  tone?: PaperTone;
  size?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function PaperAvatar({ label, tone = 'sage', size = 44, style, textStyle }: AvatarProps) {
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colorForTone(tone),
        },
        style,
      ]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.44 }, textStyle]}>{firstGlyph(label)}</Text>
    </View>
  );
}

type PaperTagProps = PropsWithChildren<{
  active?: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
}>;

export function PaperTag({ active = false, color = paperColors.ink0, style, children }: PaperTagProps) {
  return (
    <View
      style={[
        styles.tag,
        {
          backgroundColor: active ? color : 'transparent',
          borderColor: active ? color : paperColors.ink2,
        },
        style,
      ]}>
      <Text style={[styles.tagText, { color: active ? paperColors.card : paperColors.ink1 }]}>
        {children}
      </Text>
    </View>
  );
}

type StampProps = {
  text?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function Stamp({ text = 'done', size = 54, style }: StampProps) {
  return (
    <View
      style={[
        styles.stamp,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          transform: [{ rotate: '-12deg' }],
        },
        style,
      ]}>
      <Text style={[styles.stampText, { fontSize: size * 0.34 }]}>{text}</Text>
    </View>
  );
}

type ScribbleProps = {
  width?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export function Scribble({ width = 120, color = paperColors.coral, style }: ScribbleProps) {
  return (
    <View style={[{ width, height: 9 }, style]}>
      <View style={[styles.scribbleLine, { backgroundColor: color, left: 0, width: width * 0.46 }]} />
      <View
        style={[
          styles.scribbleLine,
          {
            backgroundColor: color,
            left: width * 0.33,
            width: width * 0.42,
            top: 4,
            transform: [{ rotate: '-2deg' }],
          },
        ]}
      />
      <View
        style={[
          styles.scribbleLine,
          {
            backgroundColor: color,
            right: 0,
            width: width * 0.35,
            top: 3,
            transform: [{ rotate: '2deg' }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    borderColor: paperColors.ink0,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  avatarText: {
    color: paperColors.ink0,
    fontFamily: paperFonts.pen,
    lineHeight: 28,
  },
  bunnyCheek: {
    backgroundColor: paperColors.peach,
    borderRadius: 99,
    height: 5,
    opacity: 0.85,
    position: 'absolute',
    width: 5,
  },
  bunnyEar: {
    alignItems: 'center',
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderWidth: 1.6,
    justifyContent: 'center',
    position: 'absolute',
  },
  bunnyEye: {
    backgroundColor: paperColors.ink0,
    borderRadius: 99,
    height: 4.5,
    position: 'absolute',
    width: 4,
  },
  bunnyHead: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderWidth: 1.8,
    position: 'absolute',
  },
  bunnyInnerEar: {
    backgroundColor: paperColors.peach,
    borderRadius: 99,
    opacity: 0.8,
  },
  bunnyMouth: {
    display: 'none',
  },
  bunnyNose: {
    backgroundColor: paperColors.coral,
    borderColor: paperColors.ink0,
    borderRadius: 99,
    borderWidth: 1,
    height: 5,
    position: 'absolute',
    width: 5,
  },
  handNote: {
    bottom: -6,
    color: paperColors.coral,
    fontFamily: paperFonts.pen,
    fontSize: 18,
    position: 'absolute',
    right: -8,
    transform: [{ rotate: '-8deg' }],
  },
  photo: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  photoImageVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(251,247,240,0.08)',
  },
  photoLabel: {
    color: 'rgba(50,48,43,0.55)',
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  photoStripe: {
    backgroundColor: 'rgba(27, 26, 23, 0.055)',
    height: 6,
    left: -30,
    position: 'absolute',
    width: '140%',
  },
  polaroid: {
    backgroundColor: paperColors.card,
    padding: 8,
    position: 'relative',
    shadowColor: '#1E190F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 3,
  },
  polaroidCaption: {
    bottom: 6,
    color: paperColors.ink1,
    fontFamily: paperFonts.pen,
    fontSize: 17,
    left: 8,
    lineHeight: 20,
    position: 'absolute',
    right: 8,
    textAlign: 'center',
  },
  polaroidImage: {
    borderRadius: 0,
  },
  scribbleLine: {
    borderRadius: 10,
    height: 2.3,
    position: 'absolute',
    top: 2,
  },
  stamp: {
    alignItems: 'center',
    borderColor: paperColors.coral,
    borderStyle: 'dashed',
    borderWidth: 2,
    justifyContent: 'center',
  },
  stampText: {
    color: paperColors.coral,
    fontFamily: paperFonts.pen,
    lineHeight: 25,
  },
  tag: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1.2,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  tagText: {
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 16,
  },
  tape: {
    borderLeftColor: 'rgba(0,0,0,0.08)',
    borderLeftWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.08)',
    borderRightWidth: 1,
    height: 22,
    opacity: 0.94,
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    zIndex: 3,
  },
});
