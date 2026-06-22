import { colors, spacing, typography } from '@/theme'
import { ActivityIndicator, Text, View } from 'react-native'

type Props = {
  message?: string
}

export function LoadingState({ message = 'Loading...' }: Props) {
  return (
    <View
      style={{
        gap: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        borderCurve: 'continuous',
        backgroundColor: colors.surfaceMuted,
        padding: spacing.xl,
      }}
    >
      <ActivityIndicator color={colors.primary} />
      <Text selectable style={[typography.body, { color: colors.textMuted }]}>
        {message}
      </Text>
    </View>
  )
}
