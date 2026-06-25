import { MediaJob } from '@/lib/api/recipes'
import { colors, radius, spacing, typography } from '@/theme'
import { AppBadge } from '@/ui/app-badge'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { Image, Text, View } from 'react-native'

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
  const thumbnailUrl = job.thumbnail_url ?? fallbackThumbnailUrl
  const needsAttention = job.status === 'failed' || job.status === 'needs_caption'

  return (
    <Card tone={needsAttention ? 'muted' : 'warm'}>
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
              tone={needsAttention ? 'warning' : 'primary'}
            />
            <AppBadge label={`${job.progress}%`} />
          </View>
          <Text selectable style={[typography.heading, { color: colors.text }]}>
            Video analysis
          </Text>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            {job.error_message || getMediaJobMessage(job)}
          </Text>
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

      {needsAttention ? (
        <View style={{ gap: spacing.sm }}>
          {onRetry ? (
            <Button label="Retry Analysis" fullWidth onPress={onRetry} />
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

function getMediaJobStatusLabel(status: MediaJob['status']) {
  switch (status) {
    case 'queued':
      return 'Queued'
    case 'resolving':
      return 'Resolving source'
    case 'downloading':
      return 'Downloading'
    case 'validating':
      return 'Validating'
    case 'thumbnailing':
      return 'Creating thumbnail'
    case 'uploading_to_ai':
      return 'Preparing AI'
    case 'analyzing':
      return 'Analyzing'
    case 'saving_result':
      return 'Saving result'
    case 'completed':
      return 'Completed'
    case 'failed':
      return 'Failed'
    case 'needs_caption':
      return 'Needs caption'
  }
}

function getMediaJobMessage(job: MediaJob) {
  switch (job.status) {
    case 'queued':
      return 'Waiting for the media worker. No video has been downloaded.'
    case 'resolving':
      return 'Checking how this source can be processed.'
    case 'downloading':
      return 'A future authorized worker is retrieving temporary media.'
    case 'validating':
      return 'Checking the temporary media before analysis.'
    case 'thumbnailing':
      return 'Preparing a static thumbnail.'
    case 'uploading_to_ai':
      return 'Preparing authorized media for AI analysis.'
    case 'analyzing':
      return 'Extracting recipe details from the authorized media.'
    case 'saving_result':
      return 'Saving the recipe card.'
    case 'completed':
      return 'Video analysis finished.'
    case 'failed':
      return 'Video analysis could not finish.'
    case 'needs_caption':
      return 'Paste the recipe caption or visible ingredients to continue.'
  }
}
