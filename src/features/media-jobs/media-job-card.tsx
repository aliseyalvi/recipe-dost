import { MediaJob } from '@/lib/api/recipes'
import { colors, radius, spacing, typography } from '@/theme'
import { AppBadge } from '@/ui/app-badge'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { Image, Text, View } from 'react-native'
import {
  getDurationLimitMessage,
  getEffectiveSourceDurationLimitSeconds,
  selectMediaCtaState,
} from './duration-policy'
import { MediaJobSourceMetadataSummary } from './media-job-source-metadata'

type Props = {
  job: MediaJob
  fallbackThumbnailUrl?: string | null
  onOpenResult?: () => void
  onPasteCaption?: () => void
  onRetry?: () => void
}

export function MediaJobCard({
  job,
  fallbackThumbnailUrl,
  onOpenResult,
  onPasteCaption,
  onRetry,
}: Props) {
  const thumbnailUrl =
    job.thumbnail_url ??
    job.source_metadata.uploaded_thumbnail_url ??
    fallbackThumbnailUrl
  const needsAttention =
    job.status === 'failed' ||
    job.status === 'cancelled' ||
    job.status === 'needs_caption'
  const isCompleted = job.status === 'completed'
  const isCompletedWithoutResult = isCompleted && !job.result_recipe_card_id
  const sourceVideoDurationSeconds =
    job.source_metadata.actual_duration_seconds ??
    job.media_duration_seconds ??
    job.source_metadata.duration_seconds
  const ctaState = selectMediaCtaState({
    jobId: job.id,
    jobStatus: job.status,
    retryable: job.source_metadata.retryable,
    retryBlockReason: job.source_metadata.retry_block_reason,
    sourceVideoDurationSeconds,
    maxDurationSeconds: job.source_metadata.max_duration_seconds,
    maxSourceVideoDurationSeconds:
      job.source_metadata.max_source_video_duration_seconds,
    hasRecipeCard: Boolean(job.result_recipe_card_id),
  })

  return (
    <Card tone={needsAttention || isCompletedWithoutResult ? 'muted' : 'warm'}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 84,
            aspectRatio: 1,
            overflow: 'hidden',
            borderRadius: radius.md,
            borderCurve: 'continuous',
            backgroundColor: colors.surfaceMuted,
          }}
        >
          {thumbnailUrl ? (
            <Image
              accessibilityLabel="Video analysis thumbnail"
              source={{ uri: thumbnailUrl }}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                selectable={false}
                style={{ color: colors.text, fontSize: 26, fontWeight: '900' }}
              >
                RD
              </Text>
            </View>
          )}
        </View>

        <View style={{ flex: 1, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            <AppBadge
              label={getMediaJobStatusLabel(job.status)}
              tone={
                needsAttention || isCompletedWithoutResult
                  ? 'warning'
                  : isCompleted
                    ? 'accent'
                    : 'primary'
              }
            />
            <AppBadge label={`${job.progress}%`} />
          </View>
          <Text selectable style={[typography.heading, { color: colors.text }]}>
            {isCompleted
              ? job.result_recipe_card_id
                ? 'Recipe card ready'
                : 'Recipe card unavailable'
              : 'Video analysis'}
          </Text>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            {getMediaJobMessage(job, ctaState.message)}
          </Text>
          <MediaJobSourceMetadataSummary
            metadata={job.source_metadata}
            fallbackPlatform={job.platform}
            isMockResult={isMockMediaJob(job)}
          />
        </View>
      </View>

      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: job.progress }}
        style={{
          overflow: 'hidden',
          height: 8,
          borderRadius: radius.pill,
          backgroundColor: colors.border,
        }}
      >
        <View
          style={{
            width: `${job.progress}%`,
            height: '100%',
            backgroundColor: needsAttention ? colors.warning : colors.primary,
          }}
        />
      </View>

      {job.status === 'completed' && job.result_recipe_card_id && onOpenResult ? (
        <Button label="Open Recipe Card" fullWidth onPress={onOpenResult} />
      ) : null}

      {isCompletedWithoutResult ? (
        <Text selectable style={[typography.caption, { color: colors.warning }]}>
          Analysis finished, but the recipe card is not linked yet. Pull to refresh
          or try again in a moment.
        </Text>
      ) : null}

      {needsAttention ? (
        <View style={{ gap: spacing.sm }}>
          {onRetry ? (
            <Button
              label="Retry AI Recipe Generation"
              fullWidth
              disabled={ctaState.kind !== 'retry'}
              onPress={onRetry}
            />
          ) : null}
          {onPasteCaption ? (
            <Button
              label="Paste Caption"
              fullWidth
              variant="secondary"
              onPress={onPasteCaption}
            />
          ) : null}
        </View>
      ) : null}
    </Card>
  )
}

function isMockMediaJob(job: MediaJob) {
  return (
    job.ai_provider?.toLowerCase() === 'mock' ||
    job.source_metadata.resolver?.toLowerCase().includes('mock') === true
  )
}

function getMediaJobStatusLabel(status: MediaJob['status']) {
  switch (status) {
    case 'queued':
      return 'Waiting'
    case 'processing':
      return 'Processing'
    case 'pending':
      return 'Waiting'
    case 'running':
      return 'Processing'
    case 'resolving':
      return 'Finding video'
    case 'downloading':
      return 'Finding video'
    case 'validating':
      return 'Finding video'
    case 'thumbnailing':
      return 'Reading recipe'
    case 'uploading_to_ai':
      return 'Reading recipe'
    case 'analyzing':
      return 'Reading recipe'
    case 'saving_result':
      return 'Saving'
    case 'completed':
      return 'Ready'
    case 'failed':
      return 'Failed'
    case 'cancelled':
      return 'Cancelled'
    case 'needs_caption':
      return 'Needs caption'
  }
}

function getMediaJobMessage(job: MediaJob, ctaMessage: string | null) {
  if (job.error_code === 'video_duration_exceeded') {
    const actualDuration =
      job.source_metadata.actual_duration_seconds ??
      job.media_duration_seconds ??
      job.source_metadata.duration_seconds
    const limit = getEffectiveSourceDurationLimitSeconds({
      maxDurationSeconds: job.source_metadata.max_duration_seconds,
      maxSourceVideoDurationSeconds:
        job.source_metadata.max_source_video_duration_seconds,
    })

    return getDurationLimitMessage(actualDuration, limit).body
  }

  if (ctaMessage && job.status === 'failed') {
    return ctaMessage
  }

  if (job.status === 'completed' && !job.result_recipe_card_id) {
    return 'Analysis completed, but the recipe card link is missing.'
  }

  switch (job.status) {
    case 'queued':
      return 'Waiting to start...'
    case 'processing':
      return 'Processing recipe video...'
    case 'pending':
      return 'Waiting to start...'
    case 'running':
      return 'Processing recipe video...'
    case 'resolving':
      return 'Finding recipe video...'
    case 'downloading':
      return 'Finding recipe video...'
    case 'validating':
      return 'Finding recipe video...'
    case 'thumbnailing':
      return 'Reading recipe steps...'
    case 'uploading_to_ai':
      return 'Reading recipe steps...'
    case 'analyzing':
      return 'Reading recipe steps...'
    case 'saving_result':
      return 'Saving recipe card...'
    case 'completed':
      return 'Recipe card ready'
    case 'failed':
      return 'Video analysis failed. Paste caption manually.'
    case 'cancelled':
      return 'Video analysis was cancelled.'
    case 'needs_caption':
      return 'Paste caption or visible ingredients for accurate AI results.'
  }
}
