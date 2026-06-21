import {
  detectRecipePlatform,
  getPlatformLabel,
} from '@/features/recipe-draft/platform'
import { useRecipeDraftStore } from '@/features/recipe-draft/recipe-draft-store'
import { validateRecipeUrl } from '@/features/recipe-draft/validation'
import { parseRecipeUrl } from '@/lib/api/recipes'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, spacing, typography } from '@/theme'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { ErrorState } from '@/ui/error-state'
import { Input } from '@/ui/input'
import { LoadingState } from '@/ui/loading-state'
import { Screen } from '@/ui/screen'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Text, View } from 'react-native'

export default function SaveRecipeRoute() {
  const router = useRouter()
  const { track } = usePostHog()
  const { setDraft } = useRecipeDraftStore()
  const [sourceUrl, setSourceUrl] = useState('')
  const [hasBlurred, setHasBlurred] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<Error | null>(null)
  const validationResult = useMemo(
    () => validateRecipeUrl(sourceUrl),
    [sourceUrl]
  )
  const trimmedSourceUrl = validationResult.success
    ? validationResult.data
    : sourceUrl.trim()
  const validationMessage = validationResult.success
    ? null
    : validationResult.error.issues[0]?.message ?? 'Enter a valid recipe link.'
  const shouldShowError = hasBlurred && !validationResult.success

  const continueToPreview = async () => {
    if (isParsing) {
      return
    }

    if (!validationResult.success) {
      track('link_validation_failed', {
        reason: 'invalid_url',
      })
      setHasBlurred(true)
      return
    }

    const platform = detectRecipePlatform(validationResult.data)

    setIsParsing(true)
    setParseError(null)
    track('link_pasted', {
      platform,
    })
    track('metadata_fetch_started', {
      platform,
    })

    try {
      const parsedRecipeUrl = await parseRecipeUrl(validationResult.data)

      setDraft({
        source_url: parsedRecipeUrl.source_url,
        normalized_url: parsedRecipeUrl.normalized_url,
        host: parsedRecipeUrl.host,
        platform: parsedRecipeUrl.platform,
        title: parsedRecipeUrl.title,
        description: parsedRecipeUrl.description,
        thumbnail_url: parsedRecipeUrl.thumbnail_url,
        metadata_status: parsedRecipeUrl.metadata_status,
        requires_manual_caption: parsedRecipeUrl.requires_manual_caption,
        created_at: new Date().toISOString(),
      })
      track('metadata_fetch_completed', {
        platform: parsedRecipeUrl.platform,
        metadata_status: parsedRecipeUrl.metadata_status,
        requires_manual_caption: parsedRecipeUrl.requires_manual_caption,
      })
      router.push('/recipe/preview')
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error
          ? caughtError
          : new Error('Could not check this recipe link. Please try again.')

      setParseError(nextError)
      track('metadata_fetch_failed', {
        platform,
        metadata_status: 'failed',
        requires_manual_caption: true,
      })
    } finally {
      setIsParsing(false)
    }
  }

  return (
    <Screen>
      <View style={{ gap: spacing.md }}>
        <Text selectable style={[typography.title, { color: colors.text }]}>
          Save a recipe video
        </Text>
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          Paste a Reel, TikTok, Short, or food video link. We will turn it into
          a clean recipe card later.
        </Text>
      </View>

      <Card>
        <Input
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isParsing}
          keyboardType="url"
          label="Recipe video link"
          onBlur={() => {
            setHasBlurred(true)

            if (!validationResult.success && sourceUrl.trim().length > 0) {
              track('link_validation_failed', {
                reason: 'invalid_url',
              })
            }
          }}
          onChangeText={(value) => {
            if (parseError) {
              setParseError(null)
            }
            setSourceUrl(value)
          }}
          onSubmitEditing={() => {
            void continueToPreview()
          }}
          placeholder="https://www.instagram.com/reel/..."
          returnKeyType="next"
          value={sourceUrl}
        />
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
          Works with Instagram, TikTok, YouTube, Facebook, and other recipe
          links.
        </Text>
        {shouldShowError && validationMessage ? (
          <Text selectable style={[typography.caption, { color: colors.danger }]}>
            {validationMessage}
          </Text>
        ) : null}
        {validationResult.success ? (
          <Text selectable style={[typography.caption, { color: colors.primary }]}>
            Looks good. Platform:{' '}
            {getPlatformLabel(detectRecipePlatform(trimmedSourceUrl))}.
          </Text>
        ) : null}
      </Card>

      <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
        Recipe Dost saves recipe cards and links, not video files.
      </Text>

      {isParsing ? <LoadingState message="Checking recipe link..." /> : null}
      {parseError ? (
        <ErrorState
          title="Could not check link"
          message={parseError.message}
          retryLabel="Retry"
          onRetry={() => {
            void continueToPreview()
          }}
        />
      ) : null}

      <Button
        label="Continue"
        fullWidth
        disabled={!validationResult.success || isParsing}
        onPress={() => {
          void continueToPreview()
        }}
      />
    </Screen>
  )
}
