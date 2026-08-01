import { shouldShowCustomDevTools } from '@/features/dev-tools/dev-tools-visibility'
import { RecipePlatform } from '@/features/recipe-draft/types'
import { MediaJobSourceMetadata } from '@/lib/api/recipes'
import { colors, radius, spacing, typography } from '@/theme'
import { AppBadge } from '@/ui/app-badge'
import { AppIcon } from '@/ui/app-icon'
import { Text, View } from 'react-native'
import {
  formatRecipeDurationMinutes,
  formatSourceDurationSeconds,
  getDurationLimitMessage,
  getEffectiveSourceDurationLimitSeconds,
} from './duration-policy'

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
  const sourceDurationSeconds =
    metadata?.actual_duration_seconds ?? metadata?.duration_seconds ?? null
  const maxDurationSeconds = getEffectiveSourceDurationLimitSeconds({
    maxDurationSeconds: metadata?.max_duration_seconds,
    maxSourceVideoDurationSeconds:
      metadata?.max_source_video_duration_seconds,
  })
  const isOverDurationLimit =
    typeof sourceDurationSeconds === 'number'
      ? sourceDurationSeconds > maxDurationSeconds
      : metadata?.is_too_long === true
  const durationLimitCopy = isOverDurationLimit
    ? getDurationLimitMessage(sourceDurationSeconds, maxDurationSeconds)
    : null
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
      sourceDurationSeconds ||
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
        <DurationChips
          sourceVideoDurationSeconds={sourceDurationSeconds}
        />
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

      {durationLimitCopy ? (
        <View style={{ gap: spacing.xs }}>
          <Text selectable style={[typography.label, { color: colors.warning }]}>
            {durationLimitCopy.title}
          </Text>
          <Text selectable style={[typography.caption, { color: colors.warning }]}>
            {durationLimitCopy.body}
          </Text>
        </View>
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

export function DurationChips({
  recipeTotalMinutes,
  sourceVideoDurationSeconds,
}: {
  recipeTotalMinutes?: number | null
  sourceVideoDurationSeconds?: number | null
}) {
  const recipeDuration =
    typeof recipeTotalMinutes === 'number' &&
    Number.isFinite(recipeTotalMinutes) &&
    recipeTotalMinutes > 0
      ? formatRecipeDurationMinutes(recipeTotalMinutes)
      : null
  const sourceDuration =
    typeof sourceVideoDurationSeconds === 'number' &&
    Number.isFinite(sourceVideoDurationSeconds) &&
    sourceVideoDurationSeconds > 0
      ? formatSourceDurationSeconds(sourceVideoDurationSeconds)
      : null

  return (
    <View
      style={{
        minHeight: 28,
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: spacing.xs,
      }}
    >
      {recipeDuration ? (
        <DurationChip
          accessibilityLabel={`Recipe time ${recipeDuration}`}
          icon="clock"
          label={recipeDuration}
        />
      ) : null}
      {sourceDuration ? (
        <DurationChip
          accessibilityLabel={`Video length ${sourceDuration}`}
          icon="play"
          label={sourceDuration}
        />
      ) : null}
    </View>
  )
}

function DurationChip({
  accessibilityLabel,
  icon,
  label,
}: {
  accessibilityLabel: string
  icon: 'clock' | 'play'
  label: string
}) {
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={{
        minHeight: 28,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        backgroundColor: 'rgba(0, 0, 0, 0.48)',
        paddingHorizontal: spacing.sm,
      }}
    >
      <AppIcon name={icon} color={colors.onSurfaceVariant} size={14} />
      <Text
        selectable
        numberOfLines={1}
        style={[
          typography.label,
          { color: colors.onSurfaceVariant, fontSize: 9 },
        ]}
      >
        {label}
      </Text>
    </View>
  )
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
