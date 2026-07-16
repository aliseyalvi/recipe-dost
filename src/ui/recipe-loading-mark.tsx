import { colors, radius } from '@/theme'
import { AppIcon } from '@/ui/app-icon'
import { ActivityIndicator, View } from 'react-native'

export function RecipeLoadingMark({ compact = false }: { compact?: boolean }) {
  const size = compact ? 62 : 82
  const iconSize = compact ? 28 : 38

  return (
    <View
      accessibilityLabel="Recipe Dost is loading"
      accessibilityRole="progressbar"
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: compact ? 20 : 26,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.primaryOutlineSoft,
        backgroundColor: colors.surfaceContainerHigh,
        boxShadow: '0 18px 36px rgba(0, 0, 0, 0.28)',
      }}
    >
      <AppIcon name="recipe" color={colors.primary} size={iconSize} />
      <View
        style={{
          position: 'absolute',
          right: compact ? -5 : -7,
          bottom: compact ? -5 : -7,
          width: compact ? 27 : 32,
          height: compact ? 27 : 32,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.pill,
          borderWidth: 2,
          borderColor: colors.background,
          backgroundColor: colors.primary,
        }}
      >
        <ActivityIndicator
          size={compact ? 13 : 15}
          color={colors.onPrimary}
        />
      </View>
    </View>
  )
}
