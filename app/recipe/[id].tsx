import { getPlatformLabel, getReadableSource } from '@/features/recipe-draft/platform'
import { PlatformBadge } from '@/features/recipe-draft/platform-badge'
import { RecipePlatform } from '@/features/recipe-draft/types'
import { MediaJobCard } from '@/features/media-jobs/media-job-card'
import { UsagePill } from '@/features/usage/usage-limit-card'
import { getAiAccessState } from '@/lib/api/ai-access'
import {
  RecipeApiError,
  createMediaJob,
  getLatestMediaJobForRecipe,
  getRecipeCard,
  getSavedRecipeItem,
  isMediaJobActive,
  updateSavedRecipeCaption,
} from '@/lib/api/recipes'
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
  const [isCreatingMediaJob, setIsCreatingMediaJob] = useState(false)
  const [mediaJobError, setMediaJobError] = useState<Error | null>(null)
  const [showCreditLimitState, setShowCreditLimitState] = useState(false)
  const [isCaptionEditorOpen, setIsCaptionEditorOpen] = useState(false)
  const [captionDraft, setCaptionDraft] = useState('')
  const [isSavingCaption, setIsSavingCaption] = useState(false)
  const didTrackUsageSummary = useRef(false)
  const didTrackAccuracyWarning = useRef(false)
  const lastTrackedMediaJobStatus = useRef<string | null>(null)
  const recipeQuery = useQuery({
    enabled: Boolean(recipeId),
    queryKey: ['recipe-item', recipeId],
    queryFn: () => getSavedRecipeItem(recipeId ?? ''),
  })
  const aiAccessQuery = useQuery({
    queryKey: ['ai-access-state', 'recipe-detail'],
    queryFn: getAiAccessState,
  })
  const mediaJobQuery = useQuery({
    enabled: Boolean(recipeId),
    queryKey: ['media-job', 'recipe', recipeId],
    queryFn: () => getLatestMediaJobForRecipe(recipeId ?? ''),
    refetchInterval: (query) =>
      isMediaJobActive(query.state.data) ? 5000 : false,
  })
  const aiAccess = aiAccessQuery.data

  useEffect(() => {
    if (!aiAccess || didTrackUsageSummary.current) {
      return
    }

    didTrackUsageSummary.current = true
    track('usage_summary_viewed', {
      limit_type: 'ai_recipe_cards',
      used: aiAccess.usedSuccessfulGenerations,
      limit: aiAccess.freeLimit,
      role: aiAccess.role,
      reason: aiAccess.reason,
    })
  }, [aiAccess, track])

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
    if (mediaJob.status === 'failed') {
      track('media_job_failed', {
        platform: getRecipePlatform(mediaJob.platform),
        error_code: mediaJob.error_code ?? 'unknown',
      })
    }
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

  const handleCreateMediaJob = async (source: 'new' | 'retry') => {
    if (isCreatingMediaJob) {
      return
    }

    setIsCreatingMediaJob(true)
    setMediaJobError(null)
    setShowCreditLimitState(false)

    track('generate_ai_recipe_tapped', {
      platform,
      source,
      source_mode: sourceModeHint,
    })

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
      await aiAccessQuery.refetch()
      await mediaJobQuery.refetch()
    } catch (caughtError) {
      if (
        caughtError instanceof RecipeApiError &&
        caughtError.code === 'ai_credit_limit_reached'
      ) {
        setShowCreditLimitState(true)
        track('ai_credit_limit_reached', {
          platform,
          source,
        })
        track('upgrade_placeholder_shown', {
          limit_type: 'ai_recipe_cards',
          source: 'saved_recipe_detail',
        })
        return
      }

      const nextError =
        caughtError instanceof Error
          ? caughtError
          : new Error('Could not queue video analysis. Please try again.')

      setMediaJobError(getFriendlyMediaJobError(caughtError, nextError))
      track('media_job_failed', {
        platform,
        source,
        error_code:
          caughtError instanceof RecipeApiError
            ? caughtError.code
            : 'media_job_failed',
      })
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
              Generate AI Recipe
            </Text>
            <Text selectable style={[typography.body, { color: colors.textMuted }]}>
              AI turns this saved link and any caption or notes into a recipe
              card. Recipe Dost saves links and recipe cards, not videos.
            </Text>
          </View>
          <Button
            label="Generate AI Recipe"
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
          title="Could not generate AI recipe"
          message={mediaJobError.message}
          retryLabel="Retry"
          onRetry={() => {
            void handleCreateMediaJob(mediaJob ? 'retry' : 'new')
          }}
        />
      ) : null}

      {showCreditLimitState ? (
        <Card tone="muted">
          <Text selectable style={[typography.heading, { color: colors.warning }]}>
            Free AI recipes used
          </Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            You have used your 3 free AI recipe generations. Upgrade to generate
            more recipe cards.
          </Text>
          <Button
            label="Unlock Pro"
            fullWidth
            variant="accent"
            onPress={() => router.push('/paywall')}
          />
          <Button
            label="Maybe later"
            fullWidth
            variant="secondary"
            onPress={() => setShowCreditLimitState(false)}
          />
        </Card>
      ) : null}

      {aiAccess ? (
        <UsagePill
          label="AI recipes left"
          value={getAiRecipesLeftValue(aiAccess)}
        />
      ) : aiAccessQuery.isLoading ? (
        <UsagePill label="AI recipes left" value="-" />
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

function getAiRecipesLeftValue(access: {
  role: string
  isTestUser: boolean
  premiumActive: boolean
  remaining: number | null
  reason: string
}) {
  if (access.role === 'admin') {
    return 'Admin'
  }

  if (access.isTestUser || access.role === 'tester') {
    return 'Tester'
  }

  if (access.premiumActive) {
    return 'Pro'
  }

  if (access.reason === 'limit_reached') {
    return '0'
  }

  return access.remaining === null ? '-' : `${access.remaining}`
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
