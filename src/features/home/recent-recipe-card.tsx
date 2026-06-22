import { MetadataStatusBadge } from '@/features/home/metadata-status-badge'
import { PlatformBadge } from '@/features/recipe-draft/platform-badge'
import { RecipePlatform } from '@/features/recipe-draft/types'
import { RecentRecipeItem } from '@/features/home/recent-recipes-api'
import { colors, radius, spacing, typography } from '@/theme'
import { AppBadge } from '@/ui/app-badge'
import { Image, Pressable, Text, View } from 'react-native'

type Props = {
  recipe: RecentRecipeItem
  onPress: (recipe: RecentRecipeItem) => void
}

export function RecentRecipeCard({ recipe, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(recipe)}
      style={({ pressed }) => ({
        gap: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        backgroundColor: colors.surface,
        padding: spacing.lg,
        opacity: pressed ? 0.86 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        {recipe.thumbnail_url ? (
          <Image
            source={{ uri: recipe.thumbnail_url }}
            style={{
              width: 72,
              height: 72,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceMuted,
            }}
          />
        ) : (
          <View
            style={{
              width: 72,
              height: 72,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.md,
              borderCurve: 'continuous',
              backgroundColor: colors.accentSoft,
            }}
          >
            <Text selectable style={[typography.heading, { color: colors.accent }]}>
              RD
            </Text>
            <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
              Recipe
            </Text>
          </View>
        )}

        <View style={{ flex: 1, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <PlatformBadge platform={getRecipePlatform(recipe.platform)} />
            <AppBadge label="Saved Link" tone="accent" />
            <MetadataStatusBadge status={recipe.metadata_status} />
          </View>
          <Text
            selectable
            numberOfLines={2}
            style={[typography.body, { color: colors.text, fontWeight: '700' }]}
          >
            {recipe.title?.trim() || 'Untitled recipe link'}
          </Text>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            {formatDate(recipe.created_at)}
          </Text>
        </View>
      </View>
    </Pressable>
  )
}

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Saved recently'
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function getRecipePlatform(platform: string | null): RecipePlatform {
  if (
    platform === 'instagram' ||
    platform === 'tiktok' ||
    platform === 'youtube' ||
    platform === 'facebook' ||
    platform === 'other'
  ) {
    return platform
  }

  return 'other'
}
