import type { TextStyle, ViewStyle } from 'react-native'

export const colors = {
  background: '#0A0A0A',
  surface: '#121317',
  surfaceContainerLowest: '#0D0E12',
  surfaceContainerLow: '#1A1B1F',
  surfaceContainer: '#1E1F23',
  surfaceContainerHigh: '#292A2E',
  surfaceContainerHighest: '#343539',
  onSurface: '#E3E2E7',
  onSurfaceVariant: '#E3BEBB',
  outline: '#AA8987',
  outlineVariant: '#5B403F',
  primary: '#FFB3B0',
  onPrimary: '#68000F',
  primaryContainer: '#BE1E2D',
  onPrimaryContainer: '#FFD3D1',
  tertiary: '#85D1EF',
  onTertiary: '#003544',
  error: '#FFB4AB',
  onError: '#690005',
  errorContainer: '#93000A',
  success: '#84D7A7',
  successContainer: '#123322',
  warning: '#FFD166',
  warningContainer: '#302716',
  glassSurface: 'rgba(18, 19, 23, 0.94)',
  glassElevated: 'rgba(41, 42, 46, 0.72)',
  glassBadge: 'rgba(52, 53, 57, 0.84)',
  modalBackdrop: 'rgba(0, 0, 0, 0.60)',
  inputSurface: 'rgba(52, 53, 57, 0.34)',
  primaryOutline: 'rgba(255, 179, 176, 0.72)',
  primaryOutlineSoft: 'rgba(255, 179, 176, 0.24)',
  primaryWash: 'rgba(255, 179, 176, 0.08)',

  // Compatibility aliases for screens that have not moved to semantic tokens yet.
  surfaceMuted: '#1A1B1F',
  surfaceWarm: '#1E1F23',
  text: '#E3E2E7',
  textMuted: '#B9A6A4',
  border: '#3D3030',
  primaryPressed: '#A71927',
  primarySoft: '#351517',
  primaryText: '#68000F',
  accent: '#84D7A7',
  accentSoft: '#123322',
  warningSurface: '#302716',
  danger: '#FFB4AB',
  dangerSurface: '#3B211F',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  card: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  mobileMargin: 16,
  sectionGap: 32,
  cardGap: 20,
  cardPadding: 20,
} as const

export const fontFamily = {
  // Expo-safe fallbacks. Bodoni Moda and Work Sans can replace these slots later
  // without changing component styles or blocking app startup on font loading.
  editorial: 'serif',
  body: undefined,
} as const

export const typography = {
  hero: {
    fontFamily: fontFamily.editorial,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.32,
  },
  title: {
    fontFamily: fontFamily.editorial,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  heading: {
    fontFamily: fontFamily.editorial,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
  },
  body: {
    fontFamily: fontFamily.body,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  caption: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  label: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>

export const radius = {
  sm: 12,
  md: 16,
  card: 20,
  lg: 24,
  pill: 999,
} as const

export const borders = {
  subtle: {
    borderWidth: 1,
    borderColor: 'rgba(91, 64, 63, 0.42)',
  },
  emphasized: {
    borderWidth: 1,
    borderColor: colors.primaryOutline,
  },
} satisfies Record<string, ViewStyle>

export const shadows = {
  card: {
    boxShadow: '0 12px 24px rgba(0, 0, 0, 0.16)',
  },
  floating: {
    boxShadow: '0 18px 40px rgba(0, 0, 0, 0.45)',
  },
  fab: {
    boxShadow: '0 12px 28px rgba(190, 30, 45, 0.36)',
  },
} satisfies Record<string, ViewStyle>
