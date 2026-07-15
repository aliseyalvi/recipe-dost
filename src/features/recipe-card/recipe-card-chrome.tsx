import { colors, radius, spacing, typography } from '@/theme'
import {
  AppIcon,
  PlatformIcon,
  type AppIconName,
} from '@/ui/app-icon'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'

export function FavoriteIconButton({
  title,
  isFavorite,
  disabled = false,
  onPress,
}: {
  title: string
  isFavorite: boolean
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        isFavorite
          ? `Remove ${title} from favorites`
          : `Add ${title} to favorites`
      }
      accessibilityState={{ selected: isFavorite, disabled }}
      disabled={disabled}
      onPress={(event) => {
        event.stopPropagation()
        onPress()
      }}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: isFavorite
          ? colors.primaryOutline
          : colors.primaryOutlineSoft,
        backgroundColor: isFavorite
          ? colors.primaryContainer
          : 'rgba(0, 0, 0, 0.58)',
        opacity: pressed || disabled ? 0.62 : 1,
      })}
    >
      {disabled ? (
        <ActivityIndicator
          color={isFavorite ? colors.onPrimaryContainer : colors.primary}
          size="small"
        />
      ) : (
        <AppIcon
          name={isFavorite ? 'heart' : 'heart-outline'}
          color={isFavorite ? colors.onPrimaryContainer : colors.primary}
          size={22}
        />
      )}
    </Pressable>
  )
}

export function AiRecipeBadge() {
  return (
    <View
      accessible
      accessibilityLabel="AI Recipe"
      style={{
        minHeight: 36,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.primaryOutlineSoft,
        backgroundColor: 'rgba(24, 12, 14, 0.82)',
        paddingHorizontal: spacing.md,
      }}
    >
      <AppIcon name="ai-recipe" color={colors.primary} size={16} />
      <Text
        selectable={false}
        style={[typography.caption, { color: colors.primary, fontWeight: '800' }]}
      >
        AI Recipe
      </Text>
    </View>
  )
}

export function RecipeStatusBadge({
  icon,
  label,
  color = colors.onSurface,
  borderColor = colors.primaryOutlineSoft,
}: {
  icon: AppIconName
  label: string
  color?: string
  borderColor?: string
}) {
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        minHeight: 36,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor,
        backgroundColor: 'rgba(0, 0, 0, 0.58)',
        paddingHorizontal: spacing.md,
      }}
    >
      <AppIcon name={icon} color={color} size={15} />
      <Text selectable={false} style={[typography.caption, { color }]}>
        {label}
      </Text>
    </View>
  )
}

export function RecipeMetadataChip({
  icon,
  platform,
  label,
  accent = false,
  maxWidth = '58%',
}: {
  icon?: AppIconName
  platform?: string | null
  label: string
  accent?: boolean
  maxWidth?: number | `${number}%`
}) {
  if (!label.trim()) {
    return null
  }

  const foreground = accent ? colors.primary : colors.onSurfaceVariant

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        minHeight: 28,
        maxWidth,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: accent
          ? colors.primaryOutlineSoft
          : 'rgba(255, 255, 255, 0.12)',
        backgroundColor: 'rgba(0, 0, 0, 0.48)',
        paddingHorizontal: spacing.sm,
      }}
    >
      {platform !== undefined ? (
        <PlatformIcon platform={platform} color={foreground} size={14} />
      ) : icon ? (
        <AppIcon name={icon} color={foreground} size={14} />
      ) : null}
      <Text
        selectable
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[
          typography.label,
          {
            minWidth: 0,
            flexShrink: 1,
            color: foreground,
            fontSize: 9,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  )
}
