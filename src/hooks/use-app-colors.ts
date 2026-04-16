import { colors } from '@/constants/tokens';

export function useAppColors() {
  return {
    background: colors.bg.canvas,
    surface: colors.surface.primary,
    surfaceMuted: colors.surface.tertiary,
    border: colors.line.soft,
    text: colors.text.primary,
    textMuted: colors.text.secondary,
    accent: colors.brand.primary,
    accentSoft: colors.brand.primarySoft,
    successSoft: colors.badge.certification,
    warningSoft: colors.brand.secondarySoft,
    tabActive: colors.text.primary,
    tabInactive: colors.text.tertiary,
    buttonText: colors.text.inverse,
  };
}
