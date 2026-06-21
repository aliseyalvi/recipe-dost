import { colors, radius, spacing } from '@/theme'
import { ReactNode } from 'react'
import { View } from 'react-native'

type Props = {
  children: ReactNode
}

export function Card({ children }: Props) {
  return (
    <View
      style={{
        gap: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        backgroundColor: colors.surface,
        padding: spacing.lg,
      }}
    >
      {children}
    </View>
  )
}
