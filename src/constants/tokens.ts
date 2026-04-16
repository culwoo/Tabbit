import type { TextStyle, ViewStyle } from 'react-native';

// ─────────────────────────────────────────
// Tabbit Design Tokens
// Aesthetic: Soft lavender, warm, 귀여운
// Context: .impeccable.md 참조
// ─────────────────────────────────────────

export const colors = {
  bg: {
    canvas: '#F6F3FA',       // 연보라 틴트 배경
    sunken: '#EDEAF4',       // 한 단계 깊은 배경
    overlay: 'rgba(35, 28, 50, 0.32)',
  },
  surface: {
    primary: '#FFFFFF',
    secondary: '#F9F7FC',    // 카드 내부 서브 영역
    tertiary: '#F0ECF7',     // 입력 필드, 칩 배경
    inverse: '#2D2440',      // 다크 서피스 (버튼 등)
  },
  line: {
    soft: '#E2DCE9',         // 기본 구분선
    strong: '#CFC7D9',       // 강조 구분선
    accent: '#D9C5F0',       // 보라 악센트 라인
  },
  text: {
    primary: '#241B33',      // 거의 검정, 보라 틴트
    secondary: '#6B5F7B',    // 보조 텍스트
    tertiary: '#9990A8',     // 비활성/힌트
    inverse: '#FEFCFF',      // 다크 위 텍스트
  },
  brand: {
    primary: '#9B7FD4',      // 연보라 메인
    secondary: '#7EC4D6',    // 청록 포인트 (진행, 달성)
    accent: '#E8A86D',       // 따뜻한 오렌지 (배지, CTA)
    primarySoft: '#EDE5F8',  // 연보라 10% 배경
    secondarySoft: '#E4F3F7',// 청록 10% 배경
  },
  status: {
    success: '#89BF99',      // 달성/완료
    warning: '#D9B563',      // 주의
    danger: '#D48E8E',       // 오류
    info: '#7EB3CF',         // 안내
  },
  badge: {
    certification: '#EDE5F8',// 인증 알림 배경
    chat: '#E4F3F7',         // 채팅 알림 배경
    neutral: '#EAEAF0',      // 중립 배지
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
  input: 16,    // 기존 18 → 16 (4pt 배수 정렬)
  button: 20,
  card: 24,     // 기존 28 → 24 (좀 더 정돈)
  sheet: 28,    // 기존 32 → 28
} as const;

export const typography = {
  eyebrow: {
    fontSize: 11,   // 12 → 11 (더 섬세)
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  label: {
    fontSize: 13,    // 14 → 13
    lineHeight: 17,
    fontWeight: '600',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',  // 500 → 400 (본문은 레귤러)
  },
  bodyStrong: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',  // 700 → 600 (세미볼드)
  },
  title: {
    fontSize: 20,    // 21 → 20
    lineHeight: 26,
    fontWeight: '700',  // 800 → 700
  },
  hero: {
    fontSize: 28,    // 32 → 28 (모바일에서 32는 과도)
    lineHeight: 34,
    fontWeight: '700',
  },
} as const satisfies Record<string, TextStyle>;

export const shadow = {
  card: {
    shadowColor: '#2D2440',
    shadowOpacity: 0.06,     // 0.08 → 0.06 (더 은은)
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  floating: {
    shadowColor: '#2D2440',
    shadowOpacity: 0.10,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  sheet: {
    shadowColor: '#2D2440',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 6,
  },
} as const satisfies Record<string, ViewStyle>;

export const motion = {
  fast: 150,
  base: 220,
  slow: 300,
} as const;
