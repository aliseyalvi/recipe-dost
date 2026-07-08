import { shouldShowCustomDevTools } from '@/features/dev-tools/dev-tools-visibility'
import { RecipePlatform } from '@/features/recipe-draft/types'
import { MediaJobSourceMetadata } from '@/lib/api/recipes'
import { colors, spacing, typography } from '@/theme'
import { AppBadge } from '@/ui/app-badge'
import { Text, View } from 'react-native'

type Props = {
  metadata?: MediaJobSourceMetadata | null
  fallbackPlatform?: string | null
  isMockResult?: boolean
}

export function MediaJobSourceMetadataSummary({
  metadata,
  fallbackPlatform,
  isMockResult = false,
}: Props) {
  const sourceTitle = metadata?.title?.trim()
  const sourceDescription = metadata?.description?.trim()
  const platformLabel = getPlatformLabel(
    getSourcePlatform(metadata?.platform ?? fallbackPlatform)
  )
  const durationLabel =
    typeof metadata?.duration_seconds === 'number'
      ? formatDuration(metadata.duration_seconds)
      : null
  const isOverDurationLimit =
    typeof metadata?.duration_seconds === 'number' &&
    metadata.duration_seconds > 120
  const sizeLabel =
    typeof metadata?.media?.size_bytes === 'number'
      ? formatBytes(metadata.media.size_bytes)
      : null
  const resolverLabel = metadata?.resolver?.trim()
  const authorLabel = metadata?.author_username?.trim()
  const hasContent = Boolean(
    sourceTitle ||
      sourceDescription ||
      authorLabel ||
      platformLabel ||
      durationLabel ||
      sizeLabel ||
      resolverLabel ||
      isMockResult
  )

  if (!hasContent) {
    return null
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {platformLabel ? <AppBadge label={platformLabel} /> : null}
        {durationLabel ? <AppBadge label={durationLabel} /> : null}
        {authorLabel ? <AppBadge label={`Creator: ${authorLabel}`} /> : null}
        {sizeLabel ? <AppBadge label={sizeLabel} /> : null}
        {resolverLabel ? <AppBadge label={`Resolver: ${resolverLabel}`} /> : null}
        {isMockResult && shouldShowCustomDevTools() ? (
          <AppBadge label="Mock recipe result" />
        ) : null}
      </View>

      {sourceTitle ? (
        <Text selectable style={[typography.body, { color: colors.text, fontWeight: '800' }]}>
          {sourceTitle}
        </Text>
      ) : null}

      {sourceDescription ? (
        <Text
          selectable
          numberOfLines={2}
          style={[typography.caption, { color: colors.textMuted }]}
        >
          {sourceDescription}
        </Text>
      ) : null}

      {isOverDurationLimit ? (
        <Text selectable style={[typography.caption, { color: colors.warning }]}>
          Video analysis supports clips up to 2 minutes.
        </Text>
      ) : null}
    </View>
  )
}

function getSourcePlatform(value: string | null | undefined): RecipePlatform | null {
  if (
    value === 'instagram' ||
    value === 'tiktok' ||
    value === 'youtube' ||
    value === 'facebook' ||
    value === 'other'
  ) {
    return value
  }

  return null
}

function getPlatformLabel(platform: RecipePlatform | null) {
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
    default:
      return null
  }
}

function formatDuration(value: number) {
  const totalSeconds = Math.max(0, Math.round(value))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

function formatBytes(value: number) {
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`
  }

  if (value >= 1024) {
    return `${Math.round(value / 1024)} KB`
  }

  return `${value} B`
}
