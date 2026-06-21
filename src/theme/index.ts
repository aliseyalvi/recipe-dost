export const colors = {
  background: '#FFFDF8',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F2EA',
  text: '#201A16',
  textMuted: '#6F6258',
  border: '#E5D8C8',
  primary: '#28745E',
  primaryPressed: '#1F5D4B',
  primaryText: '#FFFFFF',
  accent: '#D86F2C',
  danger: '#B42318',
  dangerSurface: '#FFF1F0',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

export const typography = {
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
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
  sm: 6,
  md: 8,
  pill: 999,
} as const
