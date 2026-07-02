import { RecipePlatform } from '@/features/recipe-draft/types'
import { colors, radius, spacing, typography } from '@/theme'
import { AppBadge } from '@/ui/app-badge'
import { Image, Pressable, Text, View } from 'react-native'

export type VisualRecipeStatus =
  | 'saving'
  | 'fetching_details'
  | 'saved_link'
  | 'ai_card'
  | 'processing'
  | 'ai_failed'
  | 'failed'

type Props = {
  title: string
  subtitle: string
  platform: RecipePlatform
  status: VisualRecipeStatus
  thumbnailUrl?: string | null
  sourceUrl?: string | null
  hasGroceryList?: boolean
  hasNotes?: boolean
  progress?: number | null
  createdAt: string
  onPress: () => void
}

export function VisualRecipeCard({
  title,
  subtitle,
  platform,
  status,
  thumbnailUrl,
  sourceUrl,
  hasGroceryList = false,
  hasNotes = false,
  progress,
  createdAt,
  onPress,
}: Props) {
  const displayThumbnailUrl = thumbnailUrl ?? getYouTubeThumbnailUrl(sourceUrl)

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        overflow: 'hidden',
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        backgroundColor: colors.surface,
        opacity: pressed ? 0.84 : 1,
      })}
    >
      <View style={{ aspectRatio: 0.92, backgroundColor: colors.surfaceMuted }}>
        {displayThumbnailUrl ? (
          <Image
            source={{ uri: displayThumbnailUrl }}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <RecipeFallback />
        )}
        <View
          style={{
            position: 'absolute',
            top: spacing.sm,
            right: spacing.sm,
            maxWidth: '82%',
          }}
        >
          <AppBadge
            label={getStatusLabel(status)}
            tone={getStatusTone(status)}
          />
        </View>
      </View>

      <View style={{ gap: spacing.sm, padding: spacing.md }}>
        <Text
          selectable
          numberOfLines={2}
          style={[typography.body, { color: colors.text, fontWeight: '800' }]}
        >
          {title}
        </Text>
        <Text
          selectable
          numberOfLines={1}
          style={[typography.caption, { color: colors.textMuted }]}
        >
          {subtitle}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          <MiniPill label={getPlatformLabel(platform)} />
          {hasGroceryList ? <MiniPill label="Grocery" /> : null}
          {hasNotes ? <MiniPill label="Notes" /> : null}
          {status === 'processing' && typeof progress === 'number' ? (
            <MiniPill label={`${progress}%`} />
          ) : null}
        </View>
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
          {formatDate(createdAt)}
        </Text>
      </View>
    </Pressable>
  )
}

function RecipeFallback() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface,
        padding: spacing.md,
      }}
    >
      <Text
        selectable={false}
        style={{
          color: colors.textMuted,
          fontSize: 40,
          lineHeight: 44,
          fontWeight: '900',
        }}
      >
        RD
      </Text>
    </View>
  )
}

function MiniPill({ label }: { label: string }) {
  return (
    <View
      style={{
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceMuted,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
      }}
    >
      <Text selectable={false} style={[typography.caption, { color: colors.textMuted }]}>
        {label}
      </Text>
    </View>
  )
}

function getStatusLabel(status: VisualRecipeStatus) {
  switch (status) {
    case 'saving':
      return 'Saving'
    case 'fetching_details':
      return 'Fetching details'
    case 'ai_card':
      return 'AI Recipe'
    case 'processing':
      return 'Analyzing'
    case 'ai_failed':
      return 'AI failed'
    case 'failed':
      return 'Saved Link'
    case 'saved_link':
      return 'Saved Link'
  }
}

function getStatusTone(status: VisualRecipeStatus) {
  switch (status) {
    case 'saving':
      return 'primary'
    case 'fetching_details':
      return 'primary'
    case 'ai_card':
      return 'accent'
    case 'processing':
      return 'primary'
    case 'ai_failed':
      return 'warning'
    case 'failed':
      return 'warning'
    case 'saved_link':
      return 'default'
  }
}

function getPlatformLabel(platform: RecipePlatform) {
  switch (platform) {
    case 'instagram':
      return 'Instagram'
    case 'tiktok':
      return 'TikTok'
    case 'youtube':
      return 'YouTube'
    case 'facebook':
      return 'Facebook'
    case 'other':
      return 'Link'
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function getYouTubeThumbnailUrl(sourceUrl: string | null | undefined) {
  const videoId = getYouTubeVideoId(sourceUrl)

  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null
}

function getYouTubeVideoId(sourceUrl: string | null | undefined) {
  if (!sourceUrl) {
    return null
  }

  try {
    const parsedUrl = new URL(sourceUrl)
    const host = parsedUrl.hostname.replace(/^www\./, '')

    if (host === 'youtu.be') {
      return cleanVideoId(parsedUrl.pathname.slice(1))
    }

    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      const shortsMatch = parsedUrl.pathname.match(/^\/shorts\/([^/?#]+)/)
      return (
        cleanVideoId(parsedUrl.searchParams.get('v')) ??
        cleanVideoId(shortsMatch?.[1] ?? null)
      )
    }
  } catch {
    return null
  }

  return null
}

function cleanVideoId(value: string | null) {
  const trimmedValue = value?.trim()

  return trimmedValue && /^[a-zA-Z0-9_-]{6,}$/.test(trimmedValue)
    ? trimmedValue
    : null
}
