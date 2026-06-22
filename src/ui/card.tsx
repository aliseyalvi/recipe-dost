import { colors, radius, spacing } from '@/theme'
import { ReactNode } from 'react'
import { View, ViewStyle } from 'react-native'

type Props = {
  children: ReactNode
  tone?: 'default' | 'warm' | 'muted'
}

const toneStyles: Record<NonNullable<Props['tone']>, ViewStyle> = {
  default: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  warm: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.accentSoft,
  },
  muted: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
}

export function Card({ children, tone = 'default' }: Props) {
  return (
    <View
      style={{
        gap: spacing.md,
        borderWidth: 1,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        padding: spacing.lg,
        ...toneStyles[tone],
      }}
    >
      {children}
    </View>
  )
}
