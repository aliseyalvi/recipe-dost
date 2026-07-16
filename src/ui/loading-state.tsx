import { colors, radius, spacing, typography } from '@/theme'
import { RecipeLoadingMark } from '@/ui/recipe-loading-mark'
import { Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

type Props = {
  message?: string
}

export function LoadingState({ message = 'Loading...' }: Props) {
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={{
        minHeight: 176,
        gap: spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.primaryOutlineSoft,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        backgroundColor: colors.surfaceContainerLow,
        padding: spacing.xl,
      }}
    >
      <RecipeLoadingMark compact />
      <Text
        selectable
        style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}
      >
        {message}
      </Text>
    </Animated.View>
  )
}
