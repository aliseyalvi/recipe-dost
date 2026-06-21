import { colors, spacing } from '@/theme'
import { ReactNode } from 'react'
import { ScrollView, View } from 'react-native'

type Props = {
  children: ReactNode
}

export function Screen({ children }: Props) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        flexGrow: 1,
        gap: spacing.xl,
        padding: spacing.xl,
        paddingBottom: spacing.xxl,
      }}
    >
      <View style={{ gap: spacing.xl }}>{children}</View>
    </ScrollView>
  )
}
