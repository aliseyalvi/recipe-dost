import {
  AiRecipeBadge,
  FavoriteIconButton,
  RecipeMetadataChip,
  RecipeStatusBadge,
} from '@/features/recipe-card/recipe-card-chrome'
import { borders, colors, radius, shadows, spacing, typography } from '@/theme'
import { AppIcon, type AppIconName } from '@/ui/app-icon'
import { useEffect, useState } from 'react'
import { Image, Pressable, Text, View } from 'react-native'

export function EditorialRecipeCard({
  title,
  thumbnailUrl,
  platform,
  platformLabel,
  creatorLabel,
  durationLabel,
  dateLabel,
  statusLabel,
  statusIcon = 'link',
  isAiRecipe,
  isFavorite,
  isFavoriteUpdating = false,
  isProcessing = false,
  onFavoritePress,
  onPress,
}: {
  title: string
  thumbnailUrl: string | null
  platform: string | null
  platformLabel: string
  creatorLabel?: string | null
  durationLabel?: string | null
  dateLabel: string
  statusLabel?: string | null
  statusIcon?: AppIconName
  isAiRecipe: boolean
  isFavorite: boolean
  isFavoriteUpdating?: boolean
  isProcessing?: boolean
  onFavoritePress: () => void
  onPress: () => void
}) {
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageFailed(false)
  }, [thumbnailUrl])

  const showImage = Boolean(thumbnailUrl && !imageFailed)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${title}`}
      onPress={onPress}
      style={({ pressed }) => ({
        overflow: 'hidden',
        borderRadius: radius.card,
        borderCurve: 'continuous',
        ...borders.subtle,
        ...shadows.card,
        backgroundColor: colors.surfaceContainer,
        opacity: pressed ? 0.86 : 1,
      })}
    >
      <View
        style={{
          aspectRatio: 4 / 3,
          backgroundColor: colors.surfaceContainerHigh,
        }}
      >
        {showImage ? (
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="cover"
            source={{ uri: thumbnailUrl! }}
            onError={() => setImageFailed(true)}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              backgroundColor: colors.surfaceContainerHigh,
            }}
          >
            {isProcessing ? (
              <AppIcon name="hourglass" color={colors.primary} size={28} />
            ) : null}
            <Text
              selectable={false}
              style={[
                typography.heading,
                { color: colors.onSurfaceVariant, opacity: 0.72 },
              ]}
            >
              Recipe Dost
            </Text>
          </View>
        )}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            inset: 0,
            experimental_backgroundImage:
              'linear-gradient(to top, rgba(10, 10, 10, 0.92) 0%, rgba(10, 10, 10, 0.18) 58%, rgba(10, 10, 10, 0.08) 100%)',
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: spacing.lg,
            right: spacing.lg,
            left: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: spacing.sm,
          }}
        >
          <FavoriteIconButton
            title={title}
            isFavorite={isFavorite}
            disabled={isFavoriteUpdating}
            onPress={onFavoritePress}
          />
          {isAiRecipe ? <AiRecipeBadge /> : null}
          {!isAiRecipe && statusLabel ? (
            <RecipeStatusBadge
              icon={statusIcon}
              label={statusLabel}
              color={isProcessing ? colors.primary : colors.onSurface}
            />
          ) : null}
        </View>
      </View>

      <View style={{ gap: spacing.sm, padding: spacing.cardPadding }}>
        <Text
          selectable
          numberOfLines={2}
          style={[
            typography.body,
            { color: colors.onSurface, fontWeight: '800' },
          ]}
        >
          {title}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: spacing.xs,
          }}
        >
          <RecipeMetadataChip
            platform={platform}
            label={platformLabel}
          />
          {creatorLabel ? (
            <RecipeMetadataChip
              icon="creator"
              label={creatorLabel}
              accent
            />
          ) : null}
          {durationLabel ? (
            <RecipeMetadataChip icon="clock" label={durationLabel} />
          ) : null}
          <RecipeMetadataChip icon="calendar" label={dateLabel} />
        </View>
        {isProcessing ? (
          <View
            accessibilityLabel="Recipe preview is processing"
            style={{
              width: '44%',
              height: 3,
              borderRadius: radius.pill,
              backgroundColor: colors.primary,
              opacity: 0.56,
            }}
          />
        ) : null}
      </View>
    </Pressable>
  )
}
