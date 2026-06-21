import { MetadataStatusBadge } from '@/features/home/metadata-status-badge'
import { RecentRecipeItem } from '@/features/home/recent-recipes-api'
import { colors, radius, spacing, typography } from '@/theme'
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
        padding: spacing.md,
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
              backgroundColor: colors.surfaceMuted,
            }}
          >
            <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
              Link
            </Text>
          </View>
        )}

        <View style={{ flex: 1, gap: spacing.sm }}>
          <Text
            selectable
            numberOfLines={2}
            style={[typography.body, { color: colors.text, fontWeight: '700' }]}
          >
            {recipe.title?.trim() || 'Untitled recipe link'}
          </Text>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            {formatRecipeMeta(recipe.platform, recipe.created_at)}
          </Text>
          <MetadataStatusBadge status={recipe.metadata_status} />
        </View>
      </View>
    </Pressable>
  )
}

function formatRecipeMeta(platform: string | null, createdAt: string) {
  const platformLabel = platform ? titleCase(platform) : 'Unknown platform'
  const dateLabel = formatDate(createdAt)

  return `${platformLabel} · ${dateLabel}`
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

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
