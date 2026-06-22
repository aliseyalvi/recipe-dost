export const colors = {
  background: '#050505',
  surface: '#121212',
  surfaceMuted: '#1B1B1B',
  surfaceWarm: '#201917',
  text: '#F8F6F2',
  textMuted: '#A7A29A',
  border: '#242424',
  primary: '#FF493D',
  primaryPressed: '#E73B31',
  primarySoft: '#351513',
  primaryText: '#FFFFFF',
  accent: '#53D18A',
  accentSoft: '#123322',
  warning: '#FFD166',
  warningSurface: '#302716',
  danger: '#FF8A7A',
  dangerSurface: '#3B211F',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const

export const typography = {
  hero: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  heading: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
} as const

export const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  pill: 999,
} as const
