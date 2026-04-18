import type { TextStyle, ViewStyle } from 'react-native';

// ─────────────────────────────────────────
// Tabbit Design Tokens
// Aesthetic: Soft lavender, warm, 귀여운
// Context: .impeccable.md 참조
// ─────────────────────────────────────────

export const colors = {
  bg: {
    canvas: '#F8F3F8',
    sunken: '#EFE7F2',
    warm: '#FFF8EF',
    overlay: 'rgba(44, 31, 53, 0.34)',
  },
  surface: {
    primary: '#FFFCF8',
    secondary: '#F6EFF7',
    tertiary: '#F0E8F4',
    raised: '#FFFFFF',
    pressed: '#ECE1F0',
    inverse: '#332544',
  },
  line: {
    soft: '#E7DDEA',
    warm: '#F0D8C7',
    strong: '#CDBFD7',
    accent: '#D9C2EE',
  },
  text: {
    primary: '#2E213C',
    secondary: '#6E5D7A',
    tertiary: '#A092AC',
    inverse: '#FFF9F3',
  },
  brand: {
    primary: '#9E79D7',
    primaryDeep: '#72509D',
    secondary: '#72B7C5',
    accent: '#EEA06B',
    blush: '#F2A2B8',
    butter: '#F6D681',
    mint: '#8DCCAB',
    primarySoft: '#EEE3F8',
    secondarySoft: '#E3F3F5',
    accentSoft: '#FFF0DD',
    blushSoft: '#FCE8EF',
    butterSoft: '#FFF7D8',
    mintSoft: '#E9F7EF',
  },
  status: {
    success: '#78B58F',
    warning: '#D7A84E',
    danger: '#D9828B',
    info: '#6BA9C6',
  },
  badge: {
    certification: '#EEE3F8',
    chat: '#E3F3F5',
    story: '#FFF0DD',
    neutral: '#ECE6EF',
  },
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const radius = {
  pill: 999,
  chip: 14,
  input: 18,
  button: 20,
  card: 26,
  sheet: 30,
} as const;

export const typography = {
  eyebrow: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  label: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  bodyStrong: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
  },
  hero: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
} as const satisfies Record<string, TextStyle>;

export const shadow = {
  card: {
    shadowColor: '#4B3562',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  floating: {
    shadowColor: '#4B3562',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  sheet: {
    shadowColor: '#4B3562',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 6,
  },
} as const satisfies Record<string, ViewStyle>;

export const motion = {
  fast: 150,
  base: 220,
  slow: 300,
} as const;
