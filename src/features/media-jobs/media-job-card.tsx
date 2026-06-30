import { MediaJob } from '@/lib/api/recipes'
import { colors, radius, spacing, typography } from '@/theme'
import { AppBadge } from '@/ui/app-badge'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { Image, Text, View } from 'react-native'
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
  const needsAttention = job.status === 'failed' || job.status === 'needs_caption'
  const isCompleted = job.status === 'completed'
  const isCompletedWithoutResult = isCompleted && !job.result_recipe_card_id
  const isOverDurationLimit =
    typeof job.source_metadata.duration_seconds === 'number' &&
    job.source_metadata.duration_seconds > 120

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
            {getMediaJobMessage(job)}
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
              label="Retry Analysis"
              fullWidth
              disabled={isOverDurationLimit}
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
    case 'needs_caption':
      return 'Needs caption'
  }
}

function getMediaJobMessage(job: MediaJob) {
  if (job.error_code === 'video_duration_exceeded') {
    return 'This video is over the 2-minute analysis limit. Save the link or paste the caption instead.'
  }

  if (job.status === 'completed' && !job.result_recipe_card_id) {
    return 'Analysis completed, but the recipe card link is missing.'
  }

  switch (job.status) {
    case 'queued':
      return 'Waiting to start...'
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
    case 'needs_caption':
      return 'Paste caption or visible ingredients for accurate AI results.'
  }
}
