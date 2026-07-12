import { borders, colors, radius, shadows, spacing, typography } from '@/theme'
import { useEffect, useState } from 'react'
import { Image, Pressable, Text, View } from 'react-native'

export function EditorialRecipeCard({
  title,
  thumbnailUrl,
  badge,
  creatorLabel,
  metadata,
  isProcessing = false,
  onPress,
}: {
  title: string
  thumbnailUrl: string | null
  badge: string
  creatorLabel?: string | null
  metadata: string[]
  isProcessing?: boolean
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
      <View style={{ aspectRatio: 4 / 3, backgroundColor: colors.surfaceContainerHigh }}>
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
              backgroundColor: colors.surfaceContainerHigh,
            }}
          >
            <Text
              selectable={false}
              style={[
                typography.heading,
                { color: colors.onSurfaceVariant, opacity: 0.72 },
              ]}
            >
              {isProcessing ? '⧖' : 'Recipe Dost'}
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
            left: spacing.lg,
            borderRadius: radius.pill,
            backgroundColor: isProcessing ? colors.primaryWash : colors.glassBadge,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
          }}
        >
          <Text selectable={false} style={[typography.caption, { color: colors.onSurface }]}>
            {badge}
          </Text>
        </View>
      </View>

      <View style={{ gap: spacing.sm, padding: spacing.cardPadding }}>
        <Text
          selectable
          numberOfLines={2}
          style={[typography.body, { color: colors.onSurface, fontWeight: '800' }]}
        >
          {title}
        </Text>
        {creatorLabel ? (
          <View
            style={{
              alignSelf: 'flex-start',
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: colors.outlineVariant,
              backgroundColor: colors.surfaceContainerHigh,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
            }}
          >
            <Text
              selectable
              numberOfLines={1}
              style={[typography.caption, { color: colors.onSurfaceVariant }]}
            >
              {creatorLabel}
            </Text>
          </View>
        ) : null}
        <Text
          selectable
          numberOfLines={2}
          style={[
            typography.label,
            { color: colors.onSurfaceVariant, textTransform: 'none', letterSpacing: 0.35 },
          ]}
        >
          {metadata.join('  ·  ')}
        </Text>
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
