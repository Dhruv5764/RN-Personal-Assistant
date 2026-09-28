import type { TextStyle } from 'react-native';

// Approved design tokens (see design canvas "Foundations" board). Light only for v1.
export const colors = {
  background: '#F4F5F7',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF0F3',
  hairline: '#E2E5E9',
  border: '#D5DAE0',
  text: '#131A24',
  textSecondary: '#566170',
  textDisabled: '#9AA3AE',
  accent: '#28786C',
  accentSoft: '#E4EFEC',
  accentText: '#1E5F55',
  danger: '#A63F36',
  dangerSoft: '#F7E8E6',
  dangerBorder: '#E6C9C5',
  onTint: '#FFFFFF',
  scrim: 'rgba(19, 26, 36, 0.44)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  smd: 12,
  md: 16,
  mdl: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  xs: 4,
  md: 10,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

// Font family names are the keys registered with useFonts in the root layout.
export const fonts = {
  sans: 'IBMPlexSans_400Regular',
  sansMedium: 'IBMPlexSans_500Medium',
  sansSemiBold: 'IBMPlexSans_600SemiBold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

export const type = {
  display: { fontFamily: fonts.sansSemiBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.4, color: colors.text },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 22, lineHeight: 28, letterSpacing: -0.2, color: colors.text },
  headline: { fontFamily: fonts.sansSemiBold, fontSize: 15, lineHeight: 20, color: colors.text },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: colors.text },
  label: { fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  caption: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  // Mono is only for times, dates and technical values.
  mono: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 18, color: colors.text },
  monoSmall: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 14, color: colors.textSecondary },
  sectionLabel: { fontFamily: fonts.monoMedium, fontSize: 12, lineHeight: 16, letterSpacing: 0.5, color: colors.textSecondary },
} as const satisfies Record<string, TextStyle>;

export const hitTarget = 44;
