import { colors, radius, spacing, typography } from '@/theme'
import { AppIcon } from '@/ui/app-icon'
import { Pressable, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

export function EmptyRecipeLibraryCard({
  onSaveRecipe,
}: {
  onSaveRecipe: () => void
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      style={{
        minHeight: 320,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.lg,
        overflow: 'hidden',
        borderRadius: 30,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.primaryOutlineSoft,
        backgroundColor: '#151316',
        boxShadow: '0 22px 42px rgba(0, 0, 0, 0.30)',
        padding: spacing.xl,
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -90,
          right: -90,
          width: 220,
          height: 220,
          borderRadius: radius.pill,
          backgroundColor: colors.primaryWash,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: -100,
          left: -110,
          width: 230,
          height: 230,
          borderRadius: radius.pill,
          backgroundColor: 'rgba(132, 215, 167, 0.035)',
        }}
      />

      <View
        style={{
          width: 98,
          height: 98,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 28,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: colors.primaryOutline,
          backgroundColor: colors.surfaceContainerHigh,
          transform: [{ rotate: '-2deg' }],
        }}
      >
        <AppIcon name="recipe" color={colors.primary} size={44} />
        <View style={{ position: 'absolute', top: 10, right: 10 }}>
          <AppIcon name="ai-recipe" color={colors.success} size={20} />
        </View>
      </View>

      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Text
          selectable
          style={[typography.label, { color: colors.primary, textAlign: 'center' }]}
        >
          YOUR RECIPE LIBRARY
        </Text>
        <Text
          selectable
          style={[
            typography.heading,
            { color: colors.onSurface, textAlign: 'center' },
          ]}
        >
          Your recipe library is waiting
        </Text>
        <Text
          selectable
          style={[
            typography.body,
            { color: colors.textMuted, textAlign: 'center' },
          ]}
        >
          Save your first Instagram, TikTok, YouTube, or recipe link.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save Recipe"
        onPress={onSaveRecipe}
        style={({ pressed }) => ({
          width: '100%',
          minHeight: 54,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          borderRadius: radius.pill,
          backgroundColor: colors.primary,
          opacity: pressed ? 0.82 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        })}
      >
        <Text
          selectable={false}
          style={[typography.body, { color: colors.onPrimary, fontWeight: '800' }]}
        >
          Save Recipe
        </Text>
        <AppIcon name="forward" color={colors.onPrimary} size={20} />
      </Pressable>
    </Animated.View>
  )
}
