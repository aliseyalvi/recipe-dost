import {
  detectRecipePlatform,
  getPlatformLabel,
} from '@/features/recipe-draft/platform'
import { PlatformBadge } from '@/features/recipe-draft/platform-badge'
import { useRecipeDraftStore } from '@/features/recipe-draft/recipe-draft-store'
import { validateRecipeUrl } from '@/features/recipe-draft/validation'
import { parseRecipeUrl } from '@/lib/api/recipes'
import { getUsageSummary } from '@/lib/api/usage'
import { useAuth } from '@/providers/auth-provider'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, spacing, typography } from '@/theme'
import { AppBadge } from '@/ui/app-badge'
import { AppHeader } from '@/ui/app-header'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { ErrorState } from '@/ui/error-state'
import { Input } from '@/ui/input'
import { LoadingState } from '@/ui/loading-state'
import { Screen } from '@/ui/screen'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

export default function SaveRecipeRoute() {
  const router = useRouter()
  const { user } = useAuth()
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
  const usageSummaryQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ['usage-summary', user?.id],
    queryFn: getUsageSummary,
  })
  const savedLinksRemaining = usageSummaryQuery.data?.savedLinksRemaining

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
        author_username: parsedRecipeUrl.author_username,
        duration_seconds: parsedRecipeUrl.duration_seconds,
        metadata_status: parsedRecipeUrl.metadata_status,
        requires_manual_caption: parsedRecipeUrl.requires_manual_caption,
        created_at: new Date().toISOString(),
      })
      track('metadata_fetch_completed', {
        platform: parsedRecipeUrl.platform,
        metadata_status: parsedRecipeUrl.metadata_status,
        requires_manual_caption: parsedRecipeUrl.requires_manual_caption,
      })
      track('media_preview_loaded', {
        platform: parsedRecipeUrl.platform,
        metadata_status: parsedRecipeUrl.metadata_status,
        has_title: Boolean(parsedRecipeUrl.title),
        has_thumbnail: Boolean(parsedRecipeUrl.thumbnail_url),
        has_duration: typeof parsedRecipeUrl.duration_seconds === 'number',
      })
      router.push('/recipe/preview')
    } catch {
      track('metadata_fetch_failed', {
        platform,
        metadata_status: 'failed',
        requires_manual_caption: true,
      })
      setParseError(null)
      setDraft({
        source_url: validationResult.data,
        normalized_url: validationResult.data,
        platform,
        title: null,
        description: null,
        thumbnail_url: null,
        author_username: null,
        duration_seconds: null,
        metadata_status: 'failed',
        requires_manual_caption: true,
        created_at: new Date().toISOString(),
      })
      router.push('/recipe/preview')
    } finally {
      setIsParsing(false)
    }
  }

  return (
    <Screen compact>
      <AppHeader
        eyebrow="Save"
        title="Save Recipe"
        subtitle="Paste a Reel, TikTok, Short, or recipe video link."
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm }}
      >
        {['Instagram', 'TikTok', 'YouTube', 'Facebook', 'Other'].map((label) => (
          <AppBadge key={label} label={label} />
        ))}
      </ScrollView>

      <Card tone="warm">
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
          Paste a public recipe link. Captions and notes come next.
        </Text>
        {shouldShowError && validationMessage ? (
          <Text selectable style={[typography.caption, { color: colors.danger }]}>
            {validationMessage}
          </Text>
        ) : null}
        {validationResult.success ? (
          <View style={{ gap: spacing.sm }}>
            <PlatformBadge platform={detectRecipePlatform(trimmedSourceUrl)} />
            <Text selectable style={[typography.caption, { color: colors.primary }]}>
              Looks good. Detected as{' '}
              {getPlatformLabel(detectRecipePlatform(trimmedSourceUrl))}.
            </Text>
          </View>
        ) : null}
      </Card>

      <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
        We save links and recipe cards, not videos.
      </Text>

      {typeof savedLinksRemaining === 'number' ? (
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
          Saved recipe links left: {savedLinksRemaining}
        </Text>
      ) : null}

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
