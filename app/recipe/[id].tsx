import { getPlatformLabel, getReadableSource } from '@/features/recipe-draft/platform'
import { PlatformBadge } from '@/features/recipe-draft/platform-badge'
import { RecipePlatform } from '@/features/recipe-draft/types'
import { MediaJobCard } from '@/features/media-jobs/media-job-card'
import { UpgradePlaceholder } from '@/features/usage/upgrade-placeholder'
import { UsagePill } from '@/features/usage/usage-limit-card'
import {
  RecipeApiError,
  createMediaJob,
  generateRecipeCard,
  getLatestMediaJobForRecipe,
  getRecipeCard,
  getSavedRecipeItem,
  isMediaJobActive,
  updateSavedRecipeCaption,
} from '@/lib/api/recipes'
import { getUsageSummary } from '@/lib/api/usage'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, radius, spacing, typography } from '@/theme'
import { AppBadge } from '@/ui/app-badge'
import { AppHeader } from '@/ui/app-header'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { EmptyState } from '@/ui/empty-state'
import { ErrorState } from '@/ui/error-state'
import { LoadingState } from '@/ui/loading-state'
import { Screen } from '@/ui/screen'
import { TextArea } from '@/ui/text-area'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Image, Linking, Text, View } from 'react-native'

export default function SavedRecipeRoute() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { track } = usePostHog()
  const { id } = useLocalSearchParams<{ id?: string }>()
  const recipeId = Array.isArray(id) ? id[0] : id
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<Error | null>(null)
  const [isCreatingMediaJob, setIsCreatingMediaJob] = useState(false)
  const [mediaJobError, setMediaJobError] = useState<Error | null>(null)
  const [isCaptionEditorOpen, setIsCaptionEditorOpen] = useState(false)
  const [captionDraft, setCaptionDraft] = useState('')
  const [isSavingCaption, setIsSavingCaption] = useState(false)
  const didTrackUsageSummary = useRef(false)
  const didTrackLimitReached = useRef(false)
  const didTrackAccuracyWarning = useRef(false)
  const lastTrackedMediaJobStatus = useRef<string | null>(null)
  const recipeQuery = useQuery({
    enabled: Boolean(recipeId),
    queryKey: ['recipe-item', recipeId],
    queryFn: () => getSavedRecipeItem(recipeId ?? ''),
  })
  const usageSummaryQuery = useQuery({
    queryKey: ['usage-summary', 'recipe-detail'],
    queryFn: getUsageSummary,
  })
  const mediaJobQuery = useQuery({
    enabled: Boolean(recipeId),
    queryKey: ['media-job', 'recipe', recipeId],
    queryFn: () => getLatestMediaJobForRecipe(recipeId ?? ''),
    refetchInterval: (query) =>
      isMediaJobActive(query.state.data) ? 5000 : false,
  })
  const usageSummary = usageSummaryQuery.data

  useEffect(() => {
    if (!usageSummary || didTrackUsageSummary.current) {
      return
    }

    didTrackUsageSummary.current = true
    track('usage_summary_viewed', {
      limit_type: 'recipe_cards',
      used: usageSummary.recipeCardsUsed,
      limit: usageSummary.limits.recipeCards,
    })
  }, [track, usageSummary])

  useEffect(() => {
    setCaptionDraft(recipeQuery.data?.pasted_caption ?? '')
  }, [recipeQuery.data?.pasted_caption])

  useEffect(() => {
    const mediaJob = mediaJobQuery.data

    if (
      !mediaJob ||
      lastTrackedMediaJobStatus.current === mediaJob.status
    ) {
      return
    }

    lastTrackedMediaJobStatus.current = mediaJob.status
    track('media_job_status_viewed', {
      platform: getRecipePlatform(mediaJob.platform),
      status: mediaJob.status,
      progress: mediaJob.progress,
    })
  }, [mediaJobQuery.data, track])

  useEffect(() => {
    const recipeCardId = mediaJobQuery.data?.result_recipe_card_id

    if (!recipeCardId) {
      return
    }

    void queryClient.prefetchQuery({
      queryKey: ['recipe-card', recipeCardId],
      queryFn: () => getRecipeCard(recipeCardId),
    })
    void queryClient.invalidateQueries({
      queryKey: ['recent-recipes'],
    })
    void queryClient.invalidateQueries({
      queryKey: ['recipe-library'],
    })
  }, [mediaJobQuery.data?.result_recipe_card_id, queryClient])

  useEffect(() => {
    const recipe = recipeQuery.data

    if (!recipe || didTrackAccuracyWarning.current) {
      return
    }

    const platform = getRecipePlatform(recipe.platform)
    const needsAccuracyInput =
      isUnsupportedVideoPlatform(platform) &&
      !recipe.pasted_caption &&
      !recipe.manual_ingredients

    if (!needsAccuracyInput) {
      return
    }

    didTrackAccuracyWarning.current = true
    track('ai_accuracy_warning_viewed', {
      platform,
      source: 'saved_recipe_detail',
    })
  }, [recipeQuery.data, track])

  useEffect(() => {
    if (
      !usageSummary ||
      usageSummary.canGenerateRecipeCard ||
      didTrackLimitReached.current
    ) {
      return
    }

    didTrackLimitReached.current = true
    track('usage_limit_reached', {
      limit_type: 'recipe_cards',
      used: usageSummary.recipeCardsUsed,
      limit: usageSummary.limits.recipeCards,
    })
  }, [track, usageSummary])

  if (!recipeId) {
    return (
      <Screen>
        <EmptyState
          title="Recipe link not found"
          message="Go back home and open a saved recipe link again."
          actionLabel="Back to Home"
          onActionPress={() => router.replace('/home')}
        />
      </Screen>
    )
  }

  if (recipeQuery.isLoading) {
    return (
      <Screen>
        <LoadingState message="Loading saved recipe link..." />
      </Screen>
    )
  }

  if (recipeQuery.error) {
    return (
      <Screen>
        <ErrorState
          title="Could not load saved link"
          message={recipeQuery.error.message}
          retryLabel="Retry"
          onRetry={() => {
            void recipeQuery.refetch()
          }}
          secondaryActionLabel="Back to Home"
          onSecondaryAction={() => router.replace('/home')}
        />
      </Screen>
    )
  }

  if (!recipeQuery.data) {
    return (
      <Screen>
        <EmptyState
          title="Recipe link not found"
          message="Go back home and open a saved recipe link again."
          actionLabel="Back to Home"
          onActionPress={() => router.replace('/home')}
        />
      </Screen>
    )
  }

  const recipe = recipeQuery.data
  const platform = getRecipePlatform(recipe.platform)
  const hasNote = Boolean(recipe.user_note)
  const hasCaption = Boolean(recipe.pasted_caption)
  const hasManualIngredients = Boolean(recipe.manual_ingredients)
  const sourceModeHint = getSourceModeHint(
    platform,
    hasCaption,
    hasManualIngredients
  )
  const needsAccuracyInput = sourceModeHint === 'unsupported_video_link'
  const mediaJob = mediaJobQuery.data
  const liveSourceTitle =
    mediaJob?.source_metadata.title?.trim() || recipe.title?.trim()
  const liveThumbnailUrl =
    mediaJob?.thumbnail_url ??
    mediaJob?.source_metadata.uploaded_thumbnail_url ??
    recipe.thumbnail_url
  const liveDurationSeconds = mediaJob?.source_metadata.duration_seconds
  const isOverDurationLimit =
    typeof liveDurationSeconds === 'number' && liveDurationSeconds > 120

  const openOriginalVideo = async () => {
    const canOpenUrl = await Linking.canOpenURL(recipe.source_url)

    if (canOpenUrl) {
      await Linking.openURL(recipe.source_url)
      track('original_source_opened', {
        platform,
        source: 'saved_recipe_detail',
      })
    }
  }

  const handleGenerateRecipeCard = async () => {
    if (!recipeId || isGenerating) {
      return
    }

    if (usageSummary && !usageSummary.canGenerateRecipeCard) {
      return
    }

    setIsGenerating(true)
    setGenerationError(null)
    track('ai_recipe_started', {
      platform,
      source_mode: sourceModeHint,
    })

    try {
      const response = await generateRecipeCard(recipeId)

      track('ai_recipe_completed', {
        platform,
        confidence: response.data.confidence,
        source_mode: response.data.source_mode ?? sourceModeHint,
        model_used: response.data.model_used ?? 'unknown',
      })
      void queryClient.invalidateQueries({
        queryKey: ['usage-summary'],
      })
      router.push(`/recipe-card/${response.data.recipe_card_id}`)
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error
          ? caughtError
          : new Error('Something went wrong while creating your recipe card.')

      setGenerationError(nextError)
      track('ai_recipe_failed', {
        platform,
        error_code:
          caughtError instanceof RecipeApiError
            ? caughtError.code
            : 'generation_failed',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCreateMediaJob = async (source: 'new' | 'retry') => {
    if (isCreatingMediaJob) {
      return
    }

    setIsCreatingMediaJob(true)
    setMediaJobError(null)

    if (source === 'retry') {
      track('media_job_retry_clicked', {
        platform,
        previous_status: mediaJob?.status ?? 'unknown',
      })
    }

    try {
      const createdJob = await createMediaJob({
        recipeItemId: recipe.id,
        sourceUrl: recipe.source_url,
        platform,
      })

      track('media_job_created', {
        platform,
        status: createdJob.status,
        source,
      })
      await mediaJobQuery.refetch()
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error
          ? caughtError
          : new Error('Could not queue video analysis. Please try again.')

      setMediaJobError(getFriendlyMediaJobError(caughtError, nextError))
      track('media_job_create_failed', {
        platform,
        source,
        error_code:
          caughtError instanceof RecipeApiError
            ? caughtError.code
            : 'media_job_failed',
      })
    } finally {
      setIsCreatingMediaJob(false)
    }
  }

  const handleSaveCaptionAndRetry = async () => {
    const nextCaption = captionDraft.trim()

    if (!nextCaption || isSavingCaption) {
      return
    }

    setIsSavingCaption(true)
    setMediaJobError(null)

    try {
      await updateSavedRecipeCaption({
        recipeItemId: recipe.id,
        pastedCaption: nextCaption,
      })
      await recipeQuery.refetch()
      setIsCaptionEditorOpen(false)
      track('media_job_caption_added', {
        platform,
        previous_status: mediaJob?.status ?? 'unknown',
      })
      await handleCreateMediaJob('retry')
    } catch (caughtError) {
      setMediaJobError(
        caughtError instanceof Error
          ? caughtError
          : new Error('Could not save the caption. Please try again.')
      )
    } finally {
      setIsSavingCaption(false)
    }
  }

  return (
    <Screen compact>
      <AppHeader
        eyebrow="Saved link"
        title="Recipe link saved"
        subtitle="Your link, caption, and notes are saved. AI can turn them into a clean recipe card."
      />

      <Card tone="warm">
        <View
          style={{
            overflow: 'hidden',
            aspectRatio: 1.55,
            borderRadius: radius.lg,
            backgroundColor: colors.surfaceMuted,
          }}
        >
          {liveThumbnailUrl ? (
            <Image
              source={{ uri: liveThumbnailUrl }}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <View
              style={{
                flex: 1,
                justifyContent: 'flex-end',
                gap: spacing.sm,
                padding: spacing.lg,
              }}
            >
              <Text
                selectable={false}
                style={{
                  color: colors.text,
                  fontSize: 44,
                  lineHeight: 48,
                  fontWeight: '900',
                }}
              >
                RD
              </Text>
              <View
                style={{
                  width: '64%',
                  height: 8,
                  borderRadius: radius.pill,
                  backgroundColor: colors.primary,
                }}
              />
              <View
                style={{
                  width: '42%',
                  height: 8,
                  borderRadius: radius.pill,
                  backgroundColor: colors.accent,
                }}
              />
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <PlatformBadge platform={platform} />
          <AppBadge label="Saved Link" />
        </View>
        <Text selectable style={[typography.heading, { color: colors.text }]}>
          {liveSourceTitle ?? 'Saved recipe link'}
        </Text>
        <Button
          label="Open Original Video"
          fullWidth
          variant="accent"
          onPress={() => {
            void openOriginalVideo()
          }}
        />
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
          Recipe Dost saves the link and recipe card, not the video file.
        </Text>
        <Text
          selectable
          style={[
            typography.caption,
            { color: isOverDurationLimit ? colors.warning : colors.textMuted },
          ]}
        >
          Video analysis supports clips up to 2 minutes.
        </Text>
        <View style={{ gap: spacing.xs }}>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Platform
          </Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            {getPlatformLabel(platform)}
          </Text>
        </View>
        <View style={{ gap: spacing.xs }}>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Source link
          </Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            {getReadableSource(recipe.source_url)}
          </Text>
        </View>
        <View style={{ gap: spacing.xs }}>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Notes
          </Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            {getRecipeInputSummary(hasNote, hasCaption, hasManualIngredients)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {hasNote ? <AppBadge label="Note added" /> : null}
          {hasCaption ? <AppBadge label="Caption added" /> : null}
          {hasManualIngredients ? <AppBadge label="Ingredients added" /> : null}
        </View>
      </Card>

      {needsAccuracyInput ? (
        <Card tone="muted">
          <Text selectable style={[typography.heading, { color: colors.warning }]}>
            More recipe details needed
          </Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            For accurate AI results, paste the recipe caption or visible
            ingredients before generating.
          </Text>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Recipe Dost cannot watch or download this social video from its link.
            A generated card will stay low-confidence, and generation may ask for
            more input.
          </Text>
        </Card>
      ) : null}

      {mediaJobQuery.isLoading ? (
        <LoadingState message="Checking video analysis status..." />
      ) : null}

      {mediaJobQuery.error ? (
        <ErrorState
          title="Could not load video analysis"
          message={mediaJobQuery.error.message}
          retryLabel="Retry"
          onRetry={() => {
            void mediaJobQuery.refetch()
          }}
        />
      ) : null}

      {mediaJob ? (
        <MediaJobCard
          job={mediaJob}
          fallbackThumbnailUrl={recipe.thumbnail_url}
          onOpenResult={
            mediaJob.result_recipe_card_id
              ? () => router.push(`/recipe-card/${mediaJob.result_recipe_card_id}`)
              : undefined
          }
          onRetry={() => {
            void handleCreateMediaJob('retry')
          }}
          onPasteCaption={() => {
            setIsCaptionEditorOpen(true)
            track('media_job_caption_requested', {
              platform,
              status: mediaJob.status,
            })
          }}
        />
      ) : !mediaJobQuery.isLoading && !mediaJobQuery.error ? (
        <Card tone="warm">
          <View style={{ gap: spacing.xs }}>
            <Text selectable style={[typography.heading, { color: colors.text }]}>
              Analyze the video
            </Text>
            <Text selectable style={[typography.body, { color: colors.textMuted }]}>
              Create a media job for future worker processing. This milestone only
              queues the job and does not download or store the video.
            </Text>
          </View>
          <Button
            label="Analyze Video"
            fullWidth
            disabled={isCreatingMediaJob || isOverDurationLimit}
            onPress={() => {
              void handleCreateMediaJob('new')
            }}
          />
          {isOverDurationLimit ? (
            <Text selectable style={[typography.caption, { color: colors.warning }]}>
              This source appears longer than 2 minutes. Save the link or paste
              the caption instead.
            </Text>
          ) : null}
        </Card>
      ) : null}

      {isCaptionEditorOpen ? (
        <Card>
          <Text selectable style={[typography.heading, { color: colors.text }]}>
            Paste recipe caption
          </Text>
          <TextArea
            label="Recipe caption"
            placeholder="Paste the recipe caption or visible ingredients."
            value={captionDraft}
            onChangeText={setCaptionDraft}
          />
          <Button
            label="Save Caption & Retry"
            fullWidth
            disabled={!captionDraft.trim() || isSavingCaption}
            onPress={() => {
              void handleSaveCaptionAndRetry()
            }}
          />
          <Button
            label="Cancel"
            fullWidth
            variant="secondary"
            disabled={isSavingCaption}
            onPress={() => setIsCaptionEditorOpen(false)}
          />
        </Card>
      ) : null}

      {isCreatingMediaJob || isSavingCaption ? (
        <LoadingState
          message={
            isSavingCaption
              ? 'Saving caption...'
              : 'Queueing video analysis...'
          }
        />
      ) : null}

      {mediaJobError ? (
        <ErrorState
          title="Could not update video analysis"
          message={mediaJobError.message}
          retryLabel="Retry"
          onRetry={() => {
            void handleCreateMediaJob(mediaJob ? 'retry' : 'new')
          }}
        />
      ) : null}

      {usageSummary ? (
        <UsagePill
          label="Free AI tries remaining"
          value={`${usageSummary.recipeCardsRemaining}`}
        />
      ) : null}

      <Card tone="warm">
        <View style={{ gap: spacing.xs }}>
          <Text selectable style={[typography.heading, { color: colors.text }]}>
            AI uses your saved details
          </Text>
          <Text selectable style={[typography.body, { color: colors.textMuted }]}>
            For best accuracy, paste the recipe caption or ingredients before
            generating. If only the source link exists, Recipe Dost can try, but
            confidence should stay low.
          </Text>
        </View>
        <Button
          label="Generate Recipe Card"
          fullWidth
          disabled={
            isGenerating ||
            usageSummaryQuery.isLoading ||
            Boolean(usageSummary && !usageSummary.canGenerateRecipeCard)
          }
          onPress={() => {
            void handleGenerateRecipeCard()
          }}
        />
      </Card>

      {isGenerating ? (
        <LoadingState message="Creating your recipe card..." />
      ) : null}

      {usageSummary && !usageSummary.canGenerateRecipeCard ? (
        <UpgradePlaceholder
          limitType="recipe_cards"
          used={usageSummary.recipeCardsUsed}
          limit={usageSummary.limits.recipeCards}
          actionLabel="View Library"
          onActionPress={() => router.replace('/library')}
        />
      ) : null}

      {generationError ? (
        <ErrorState
          title="Could not create recipe card"
          message={getGenerationErrorMessage(generationError)}
          retryLabel="Retry"
          onRetry={() => {
            void handleGenerateRecipeCard()
          }}
        />
      ) : null}

      <Button
        label="Back to Home"
        fullWidth
        onPress={() => router.replace('/home')}
      />
    </Screen>
  )
}

function getRecipeInputSummary(
  hasNote: boolean,
  hasCaption: boolean,
  hasManualIngredients: boolean
) {
  const detailsCount = [hasNote, hasCaption, hasManualIngredients].filter(
    Boolean
  ).length

  if (detailsCount > 1) {
    return 'Extra details added for better AI results'
  }

  if (hasNote) {
    return 'Note added'
  }

  if (hasCaption) {
    return 'Caption added'
  }

  if (hasManualIngredients) {
    return 'Manual ingredients added'
  }

  return 'No note, caption, or ingredients added yet'
}

function getRecipePlatform(platform: string | null): RecipePlatform {
  if (
    platform === 'instagram' ||
    platform === 'tiktok' ||
    platform === 'youtube' ||
    platform === 'facebook' ||
    platform === 'other'
  ) {
    return platform
  }

  return 'other'
}

function getGenerationErrorMessage(error: Error) {
  const code =
    error instanceof RecipeApiError
      ? error.code
      : 'unexpected_generate_card_error'
  const message = getFriendlyGenerateCardErrorMessage(code)

  if (__DEV__) {
    return `${message}\nDebug code: ${code}`
  }

  return message
}

function getFriendlyGenerateCardErrorMessage(code: string) {
  switch (code) {
    case 'missing_openai_key':
      return 'AI generation is not configured yet.'
    case 'missing_gemini_key':
      return 'Gemini generation is not configured yet.'
    case 'gemini_request_failed':
      return 'Gemini could not create the recipe card right now.'
    case 'gemini_rate_limited':
      return 'Gemini is busy right now. Please try again in a few minutes.'
    case 'gemini_bad_request':
      return 'Gemini could not use this request. Please try again.'
    case 'gemini_invalid_key_or_forbidden':
      return 'Gemini generation is not allowed with the current key.'
    case 'gemini_model_not_found':
      return 'Gemini model is not available.'
    case 'openai_request_failed':
      return 'AI service could not create the recipe card right now.'
    case 'openai_rate_limited':
      return 'AI service is busy right now. Please try again in a few minutes.'
    case 'openai_insufficient_quota':
      return 'OpenAI quota is not available for this project.'
    case 'openai_invalid_api_key':
      return 'OpenAI key is invalid or unavailable.'
    case 'openai_model_forbidden':
      return 'OpenAI model is not allowed for this key.'
    case 'openai_model_not_found':
      return 'OpenAI model is not available.'
    case 'openai_bad_request':
      return 'OpenAI could not use this request. Please try again.'
    case 'missing_openrouter_key':
      return 'OpenRouter generation is not configured yet.'
    case 'openrouter_request_failed':
      return 'OpenRouter could not create the recipe card right now.'
    case 'openrouter_rate_limited':
      return 'OpenRouter is busy right now. Please try again in a few minutes.'
    case 'openrouter_bad_request':
      return 'OpenRouter could not use this request. Please try again.'
    case 'openrouter_invalid_key_or_forbidden':
      return 'OpenRouter generation is not allowed with the current key.'
    case 'openrouter_model_not_found':
      return 'OpenRouter model is not available.'
    case 'missing_kimi_key':
      return 'Kimi generation is not configured yet.'
    case 'kimi_request_failed':
      return 'Kimi could not create the recipe card right now.'
    case 'kimi_rate_limited':
      return 'Kimi is busy right now. Please try again in a few minutes.'
    case 'kimi_bad_request':
      return 'Kimi could not use this request. Please try again.'
    case 'kimi_invalid_key_or_forbidden':
      return 'Kimi generation is not allowed with the current key.'
    case 'kimi_model_not_found':
      return 'Kimi model is not available.'
    case 'missing_anthropic_key':
      return 'Anthropic generation is not configured yet.'
    case 'missing_anthropic_model':
      return 'Anthropic model is not configured yet.'
    case 'anthropic_not_implemented':
      return 'Anthropic generation is not available right now.'
    case 'unsupported_ai_provider':
      return 'AI provider is not supported.'
    case 'invalid_ai_output':
      return 'Recipe card could not be generated. Please add more details and try again.'
    case 'insufficient_recipe_input':
      return 'Paste the caption or visible ingredients so AI can create an accurate recipe card.'
    case 'db_insert_failed':
      return 'Recipe card was created but could not be saved.'
    case 'recipe_not_found':
      return 'Recipe link not found.'
    case 'free_limit_reached':
      return 'You have used your free recipe cards.'
    case 'unauthorized':
      return 'Please restart the app and try again.'
    default:
      return 'Something went wrong while creating your recipe card.'
  }
}

function getFriendlyMediaJobError(caughtError: unknown, fallback: Error) {
  if (
    caughtError instanceof RecipeApiError &&
    caughtError.code === 'video_duration_exceeded'
  ) {
    return new Error(
      'This video is over the 2-minute analysis limit. Save the link or paste the caption instead.'
    )
  }

  return fallback
}

function isUnsupportedVideoPlatform(platform: RecipePlatform) {
  return (
    platform === 'instagram' ||
    platform === 'tiktok' ||
    platform === 'facebook'
  )
}

function getSourceModeHint(
  platform: RecipePlatform,
  hasCaption: boolean,
  hasManualIngredients: boolean
) {
  if (platform === 'youtube') {
    return 'youtube_url'
  }

  if (
    isUnsupportedVideoPlatform(platform) &&
    !hasCaption &&
    !hasManualIngredients
  ) {
    return 'unsupported_video_link'
  }

  return 'text_only'
}
