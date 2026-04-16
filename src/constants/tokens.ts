import type { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  bg: {
    canvas: '#F8F3FA',
    sunken: '#F2EBF6',
    overlay: 'rgba(28, 21, 39, 0.28)',
  },
  surface: {
    primary: '#FFFFFF',
    secondary: '#FCF7FB',
    tertiary: '#F4EDF7',
    inverse: '#241B31',
  },
  line: {
    soft: '#E8DDEA',
    strong: '#D4C7D9',
    accent: '#F1D2DB',
  },
  text: {
    primary: '#221B2F',
    secondary: '#6E637A',
    tertiary: '#9A8FA6',
    inverse: '#FFFFFF',
  },
  brand: {
    primary: '#EF8BAA',
    secondary: '#9CCCE8',
    accent: '#F4C67C',
    primarySoft: '#FCE5ED',
    secondarySoft: '#E9F5FC',
  },
  status: {
    success: '#93C7A3',
    warning: '#E1B567',
    danger: '#DF9393',
    info: '#7DB6D5',
  },
  badge: {
    certification: '#FDE7EE',
    chat: '#E7F4FF',
    neutral: '#EEE7F3',
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
  input: 18,
  button: 20,
  card: 28,
  sheet: 32,
} as const;

export const typography = {
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  bodyStrong: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  title: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '800',
  },
  hero: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
  },
} as const satisfies Record<string, TextStyle>;

export const shadow = {
  card: {
    shadowColor: '#241B31',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  floating: {
    shadowColor: '#241B31',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  sheet: {
    shadowColor: '#241B31',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 8,
  },
} as const satisfies Record<string, ViewStyle>;

export const motion = {
  fast: 160,
  base: 240,
  slow: 320,
} as const;
