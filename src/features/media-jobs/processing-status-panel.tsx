import type { ProcessingStage } from '@/features/media-jobs/processing-stage'
import { colors, radius, spacing, typography } from '@/theme'
import { AppBadge } from '@/ui/app-badge'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { ActivityIndicator, Text, View } from 'react-native'

type Props = {
  stage: ProcessingStage
  progress?: number | null
  isChecking?: boolean
  onGoToLibrary: () => void
  onWaitHere: () => void
}

export function ProcessingStatusPanel({
  stage,
  progress,
  isChecking = false,
  onGoToLibrary,
  onWaitHere,
}: Props) {
  const resolvedProgress = normalizeProgress(progress)

  return (
    <Card tone="warm">
      <AppBadge label={stage.label} tone="primary" />
      <Text selectable style={[typography.heading, { color: colors.text }]}>
        {stage.title}
      </Text>
      <Text selectable style={[typography.body, { color: colors.textMuted }]}>
        {stage.detail}
      </Text>
      <Text selectable style={[typography.body, { color: colors.text }]}>
        You can leave this screen. Recipe Dost will keep working and update your Library.
      </Text>

      {resolvedProgress === null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <ActivityIndicator color={colors.primary} />
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Checking the latest status while this screen is open.
          </Text>
        </View>
      ) : (
        <View style={{ gap: spacing.xs }}>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: resolvedProgress }}
            style={{
              overflow: 'hidden',
              height: 8,
              borderRadius: radius.pill,
              backgroundColor: colors.border,
            }}
          >
            <View
              style={{
                width: `${resolvedProgress}%`,
                height: '100%',
                backgroundColor: colors.primary,
              }}
            />
          </View>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            {resolvedProgress}% complete
          </Text>
        </View>
      )}

      <View style={{ gap: spacing.sm }}>
        <Button
          label="Go to Library"
          fullWidth
          variant="secondary"
          onPress={onGoToLibrary}
        />
        <Button
          label={isChecking ? 'Checking latest status...' : 'Wait here'}
          fullWidth
          variant="outline"
          disabled={isChecking}
          onPress={onWaitHere}
        />
      </View>
    </Card>
  )
}

function normalizeProgress(progress: number | null | undefined) {
  if (typeof progress !== 'number' || !Number.isFinite(progress)) {
    return null
  }

  return Math.min(100, Math.max(0, Math.round(progress)))
}
