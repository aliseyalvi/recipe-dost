import { colors, spacing, typography } from '@/theme'
import { RecipeLoadingMark } from '@/ui/recipe-loading-mark'
import Constants from 'expo-constants'
import { Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type Props = {
  message?: string
  detail?: string
}

export function AppLoadingScreen({
  message = 'Preparing Recipe Dost...',
  detail,
}: Props) {
  const insets = useSafeAreaInsets()
  const topInset = insets.top || Constants.statusBarHeight || 0

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: colors.background,
        paddingTop: topInset,
        paddingBottom: insets.bottom,
        paddingHorizontal: spacing.xl,
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: 280,
          height: 280,
          borderRadius: 999,
          backgroundColor: colors.primaryWash,
        }}
      />
      <Animated.View
        entering={FadeIn.duration(240)}
        style={{ alignItems: 'center', gap: spacing.xl }}
      >
        <RecipeLoadingMark />
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <Text
            selectable
            style={[
              typography.heading,
              { color: colors.onSurface, textAlign: 'center' },
            ]}
          >
            {message}
          </Text>
          {detail ? (
            <Text
              selectable
              style={[
                typography.body,
                { color: colors.textMuted, textAlign: 'center' },
              ]}
            >
              {detail}
            </Text>
          ) : null}
        </View>
      </Animated.View>
    </View>
  )
}
