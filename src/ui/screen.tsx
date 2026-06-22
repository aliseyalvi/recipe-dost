import { colors, spacing } from '@/theme'
import { ReactNode } from 'react'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type Props = {
  children: ReactNode
  compact?: boolean
  tabBarPadding?: boolean
}

export function Screen({
  children,
  compact = false,
  tabBarPadding = false,
}: Props) {
  const insets = useSafeAreaInsets()
  const bottomPadding = tabBarPadding
    ? 112 + insets.bottom
    : spacing.xxl + insets.bottom

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          flexGrow: 1,
          gap: compact ? spacing.lg : spacing.xl,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.lg,
          paddingBottom: bottomPadding,
        }}
      >
        <View style={{ gap: compact ? spacing.lg : spacing.xl }}>{children}</View>
      </ScrollView>
    </View>
  )
}
