import { getPlatformLabel } from '@/features/recipe-draft/platform'
import { PlatformBadge } from '@/features/recipe-draft/platform-badge'
import { RecipePlatform } from '@/features/recipe-draft/types'
import { useUserProfileQuery } from '@/features/onboarding/use-user-profile-query'
import {
  getNormalizedSubscriptionStatus,
  getRecipeSubscriptionAvailabilityText,
} from '@/features/subscription/normalized-subscription-status'
import {
  DEFAULT_SECONDARY_RECIPE_LANGUAGE_CODE,
  getSecondaryRecipeLanguage,
} from '@/features/settings/secondary-recipe-language'
import { getAiAccessState } from '@/lib/api/ai-access'
import { getFriendlyApiErrorMessage } from '@/lib/api/errors'
import {
  type MediaJob,
  RecipeApiError,
  createMediaJob,
  getLatestMediaJobForRecipe,
  getRecipeCard,
  getSavedRecipeItem,
  isMediaJobActive,
  refreshRecipeMetadata,
} from '@/lib/api/recipes'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { useRevenueCat } from '@/providers/revenuecat-provider'
import { colors, radius, spacing, typography } from '@/theme'
import { AppBadge } from '@/ui/app-badge'
import { AppHeader } from '@/ui/app-header'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { EmptyState } from '@/ui/empty-state'
import { ErrorState } from '@/ui/error-state'
import { LoadingState } from '@/ui/loading-state'
import { Screen } from '@/ui/screen'
import {
  NestedHeaderIconButton,
  NestedScreenHeader,
} from '@/ui/screen-header'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  useFocusEffect,
  useLocalSearchParams,
  useRootNavigationState,
  useRouter,
} from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Image, InteractionManager, Linking, Text, View } from 'react-native'

const MAX_AI_VIDEO_DURATION_SECONDS = 120
const LONG_VIDEO_MESSAGE =
  'This video is longer than 2 minutes. Recipe Dost currently supports videos up to 2 minutes in beta.'

export default function SavedRecipeRoute() {
  const router = useRouter()
  const rootNavigationState = useRootNavigationState()
  const queryClient = useQueryClient()
  const { track } = usePostHog()
  const { isPremium, syncPremiumEntitlement } = useRevenueCat()
  const { id, returnTo } = useLocalSearchParams<{
    id?: string
    returnTo?: string | string[]
  }>()
  const recipeId = Array.isArray(id) ? id[0] : id
  const sourceReturnToRoute = getSafeReturnToRoute(returnTo)
  const [isCreatingMediaJob, setIsCreatingMediaJob] = useState(false)
  const [isRefreshingMetadata, setIsRefreshingMetadata] = useState(false)
  const [mediaJobError, setMediaJobError] = useState<Error | null>(null)
  const [showCreditLimitState, setShowCreditLimitState] = useState(false)
  const [isSyncingPremiumAccess, setIsSyncingPremiumAccess] = useState(false)
  const [isStartLocked, setIsStartLocked] = useState(false)
  const [lastKnownMediaJob, setLastKnownMediaJob] =
    useState<MediaJob | null>(null)
  const didTrackUsageSummary = useRef(false)
  const lastTrackedMediaJobStatus = useRef<string | null>(null)
  const shouldAutoOpenResultRef = useRef(false)
  const hasAutoOpenedResultRef = useRef(false)
  const mountedRef = useRef(false)
  const autoOpenTaskRef =
    useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(
      null
    )
  const recipeQuery = useQuery({
    enabled: Boolean(recipeId),
    queryKey: ['recipe-item', recipeId],
    queryFn: () => getSavedRecipeItem(recipeId ?? ''),
    refetchInterval: (query) =>
      isMetadataRefreshActive(query.state.data?.metadata_status) ? 2000 : false,
  })
  const aiAccessQuery = useQuery({
    queryKey: ['ai-access-state', 'recipe-detail'],
    queryFn: getAiAccessState,
  })
  const mediaJobQuery = useQuery({
    enabled: Boolean(recipeId),
    queryKey: ['media-job', 'recipe', recipeId],
    queryFn: () => getLatestMediaJobForRecipe(recipeId ?? ''),
    placeholderData: (previousData) =>
      previousData ?? (isMediaJobActive(lastKnownMediaJob) ? lastKnownMediaJob : undefined),
    refetchInterval: (query) =>
      isMediaJobActive(query.state.data) ? 2500 : false,
  })
  const mediaJob = mediaJobQuery.data
  const displayMediaJob =
    mediaJob ?? (isMediaJobActive(lastKnownMediaJob) ? lastKnownMediaJob : null)
  const resultRecipeCardId = displayMediaJob?.result_recipe_card_id
  const activeMediaJob = isMediaJobActive(displayMediaJob)
    ? displayMediaJob
    : null
  const userProfileQuery = useUserProfileQuery()
  const secondaryRecipeLanguage = getSecondaryRecipeLanguage(
    userProfileQuery.data?.secondary_recipe_language_code ??
      DEFAULT_SECONDARY_RECIPE_LANGUAGE_CODE
  )
  const recipeCardQuery = useQuery({
    enabled: Boolean(resultRecipeCardId),
    queryKey: ['recipe-card', resultRecipeCardId],
    queryFn: () => getRecipeCard(resultRecipeCardId ?? ''),
  })
  const aiAccess = aiAccessQuery.data
  const subscriptionStatus = getNormalizedSubscriptionStatus({
    aiAccess,
    isAiAccessLoading: aiAccessQuery.isLoading,
    revenueCatState: {
      isPremium,
    },
  })
  const isAiLimitReached =
    aiAccess?.canStartAiJob === false || aiAccess?.reason === 'limit_reached'
  const isNavigationReady = Boolean(rootNavigationState?.key)

  useEffect(() => {
    if (!isStartLocked) {
      return
    }

    if (
      displayMediaJob &&
      (isMediaJobActive(displayMediaJob) || isTerminalMediaJob(displayMediaJob))
    ) {
      setIsStartLocked(false)
      return
    }

    if (!isCreatingMediaJob && !displayMediaJob) {
      setIsStartLocked(false)
    }
  }, [
    displayMediaJob?.id,
    displayMediaJob?.status,
    isCreatingMediaJob,
    isStartLocked,
  ])

  useEffect(() => {
    if (activeMediaJob) {
      shouldAutoOpenResultRef.current = true
    }
  }, [activeMediaJob?.id, activeMediaJob?.status])

  useEffect(() => {
    if (!mediaJob) {
      return
    }

    if (isMediaJobActive(mediaJob)) {
      setLastKnownMediaJob(mediaJob)
      shouldAutoOpenResultRef.current = true
      return
    }

    if (isTerminalMediaJob(mediaJob)) {
      setLastKnownMediaJob(null)
    }
  }, [
    mediaJob?.id,
    mediaJob?.progress,
    mediaJob?.result_recipe_card_id,
    mediaJob?.status,
  ])

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      autoOpenTaskRef.current?.cancel()
      autoOpenTaskRef.current = null
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      if (recipeId) {
        void recipeQuery.refetch()
        void mediaJobQuery.refetch()
      }
    }, [mediaJobQuery, recipeId, recipeQuery])
  )

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
    const mediaJob = displayMediaJob

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
      void queryClient.invalidateQueries({
        queryKey: ['ai-access-state'],
      })
      void queryClient.invalidateQueries({
        queryKey: ['media-job', 'recipe', recipeId],
      })
      void queryClient.invalidateQueries({
        queryKey: ['recipe-item', recipeId],
      })
      if (mediaJob.result_recipe_card_id) {
        void queryClient.invalidateQueries({
          queryKey: ['recipe-card', mediaJob.result_recipe_card_id],
        })
      }
    }
  }, [
    displayMediaJob,
    displayMediaJob?.status,
    queryClient,
    recipeId,
    track,
  ])

  useEffect(() => {
    if (!resultRecipeCardId) {
      return
    }

    void queryClient.invalidateQueries({
      queryKey: ['recent-recipes'],
    })
    void queryClient.invalidateQueries({
      queryKey: ['recipe-library'],
    })
    void queryClient.invalidateQueries({
      queryKey: ['recipe-item', recipeId],
    })
    void queryClient.invalidateQueries({
      queryKey: ['recipe-card', resultRecipeCardId],
    })
    void queryClient.invalidateQueries({
      queryKey: ['media-job', 'recipe', recipeId],
    })
    void queryClient.invalidateQueries({
      queryKey: ['ai-access-state'],
    })

    if (
      shouldAutoOpenResultRef.current &&
      !hasAutoOpenedResultRef.current &&
      isNavigationReady
    ) {
      hasAutoOpenedResultRef.current = true
      shouldAutoOpenResultRef.current = false
      autoOpenTaskRef.current?.cancel()
      autoOpenTaskRef.current = InteractionManager.runAfterInteractions(() => {
        if (!mountedRef.current) {
          return
        }

        router.replace(
          `/recipe-card/${resultRecipeCardId}?returnTo=${encodeURIComponent(
            sourceReturnToRoute ?? '/'
          )}`
        )
      })
    }
  }, [
    isNavigationReady,
    queryClient,
    recipeId,
    resultRecipeCardId,
    router,
    sourceReturnToRoute,
  ])

  if (!recipeId) {
    return (
      <Screen>
        <NestedScreenHeader
          title="Saved Recipe"
          fallbackRoute="/"
        />
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
        <NestedScreenHeader
          title="Saved Recipe"
          fallbackRoute="/"
        />
        <LoadingState message="Loading saved recipe link..." />
      </Screen>
    )
  }

  if (recipeQuery.error) {
    return (
      <Screen>
        <NestedScreenHeader
          title="Saved Recipe"
          fallbackRoute="/"
        />
        <ErrorState
          title="Could not load saved link"
          message={getFriendlyApiErrorMessage(
            recipeQuery.error,
            recipeQuery.error.message
          )}
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
        <NestedScreenHeader
          title="Saved Recipe"
          fallbackRoute="/"
        />
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
  const recipeCard = recipeCardQuery.data
  const liveSourceTitle =
    displayMediaJob?.source_metadata.title?.trim() || recipe.title?.trim()
  const displaySourceTitle =
    recipeCard?.recipe_title?.trim() ||
    (recipe.metadata_status === 'pending'
      ? 'Fetching details...'
      : liveSourceTitle)
  const displaySourceSubtitle = recipeCard?.short_summary?.trim()
  const liveThumbnailUrl =
    displayMediaJob?.thumbnail_url ??
    displayMediaJob?.source_metadata.uploaded_thumbnail_url ??
    recipe.thumbnail_url
  const liveDurationSeconds =
    displayMediaJob?.source_metadata.duration_seconds ?? recipe.duration_seconds
  const isMetadataPending = isMetadataRefreshActive(recipe.metadata_status)
  const durationBlockMessage = getDurationBlockMessage(recipe, displayMediaJob)
  const mediaJobFailureCopy = getMediaJobFailureCopy(displayMediaJob)
  const isBackendAccessBlocked =
    Boolean(aiAccess && !aiAccess.canStartAiJob && !subscriptionStatus.needsSync) ||
    Boolean(aiAccessQuery.error)
  const isGenerateDisabled =
    isCreatingMediaJob ||
    isStartLocked ||
    Boolean(activeMediaJob) ||
    isMetadataPending ||
    isBackendAccessBlocked ||
    Boolean(durationBlockMessage)
  const shouldShowAiActionCard =
    !activeMediaJob &&
    !isStartLocked &&
    !resultRecipeCardId &&
    !(mediaJobQuery.isLoading && !displayMediaJob) &&
    !mediaJobQuery.error
  const shouldShowUpgradeCard =
    shouldShowAiActionCard &&
    !isMetadataPending &&
    !durationBlockMessage &&
    !subscriptionStatus.isPremium &&
    (showCreditLimitState || isAiLimitReached)
  const backendPremiumActive =
    subscriptionStatus.sourceOfTruth === 'backend' &&
    subscriptionStatus.isPremium

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

  const handleMaybeLater = () => {
    if (router.canGoBack()) {
      router.back()
      return
    }

    router.replace(sourceReturnToRoute ?? '/home')
  }

  const handleCreateMediaJob = async () => {
    if (isGenerateDisabled) {
      if (durationBlockMessage) {
        setMediaJobError(new Error(durationBlockMessage))
      }
      return
    }

    if (
      subscriptionStatus.needsSync &&
      aiAccess &&
      !aiAccess.canStartAiJob &&
      !backendPremiumActive
    ) {
      setIsSyncingPremiumAccess(true)
      setMediaJobError(null)
      await syncPremiumEntitlement()
      await aiAccessQuery.refetch()
      setIsSyncingPremiumAccess(false)
      setMediaJobError(new Error('Premium access synced. Please try again.'))
      return
    }

    if (isAiLimitReached && !subscriptionStatus.isPremium) {
      setShowCreditLimitState(true)
      track('ai_credit_limit_reached', {
        platform,
      })
      return
    }

    setIsCreatingMediaJob(true)
    setIsStartLocked(true)
    setMediaJobError(null)
    setShowCreditLimitState(false)

    track('generate_ai_recipe_tapped', {
      platform,
      secondary_recipe_language_code: secondaryRecipeLanguage.code,
    })

    try {
      const createdJob = await createMediaJob({
        recipeItemId: recipe.id,
        secondaryRecipeLanguageCode: secondaryRecipeLanguage.code,
      })

      if (!mountedRef.current) {
        return
      }

      shouldAutoOpenResultRef.current = true
      if (createdJob.media_job) {
        const attachedJob = buildAttachedMediaJob({
          job: createdJob.media_job,
          recipeItemId: recipe.id,
          platform,
        })

        queryClient.setQueryData(
          ['media-job', 'recipe', recipe.id],
          attachedJob
        )
        setLastKnownMediaJob(attachedJob)
        setIsStartLocked(false)
      }

      track('media_job_created', {
        platform,
        status: createdJob.status,
        duplicate_active_job: createdJob.duplicate_active_job === true,
      })
      await aiAccessQuery.refetch()
      void queryClient.invalidateQueries({
        queryKey: ['recipe-item', recipe.id],
      })
      if (createdJob.media_job?.result_recipe_card_id) {
        void queryClient.invalidateQueries({
          queryKey: ['recent-recipes'],
        })
        void queryClient.invalidateQueries({
          queryKey: ['recipe-library'],
        })
        void queryClient.invalidateQueries({
          queryKey: ['recipe-card', createdJob.media_job.result_recipe_card_id],
        })
      }
      await mediaJobQuery.refetch()
      if (!createdJob.media_job) {
        setIsStartLocked(false)
      }
    } catch (caughtError) {
      if (!mountedRef.current) {
        return
      }

      if (
        caughtError instanceof RecipeApiError &&
        (
          caughtError.code === 'ai_credit_limit_or_active_queue_full' ||
          caughtError.code === 'ai_credit_limit_reached' ||
          caughtError.code === 'free_ai_limit_reached'
        )
      ) {
        track('ai_credit_limit_reached', {
          platform,
        })
        setShowCreditLimitState(true)
        setIsStartLocked(false)
        router.push('/paywall')
        return
      }

      if (
        caughtError instanceof RecipeApiError &&
        caughtError.code === 'premium_sync_required'
      ) {
        setIsSyncingPremiumAccess(true)
        await syncPremiumEntitlement()
        await aiAccessQuery.refetch()
        setIsSyncingPremiumAccess(false)
        setIsStartLocked(false)
        setMediaJobError(new Error('Premium access synced. Please try again.'))
        return
      }

      if (
        caughtError instanceof RecipeApiError &&
        caughtError.code === 'premium_monthly_limit_reached'
      ) {
        setMediaJobError(
          new Error("You've used your 100 Premium AI recipes this month.")
        )
        await aiAccessQuery.refetch()
        setIsStartLocked(false)
        return
      }

      if (
        caughtError instanceof RecipeApiError &&
        caughtError.code === 'active_ai_job_limit_reached'
      ) {
        setMediaJobError(
          new Error('An AI recipe is already being generated. Please wait for it to finish.')
        )
        await mediaJobQuery.refetch()
        setIsStartLocked(false)
        return
      }

      const nextError =
        caughtError instanceof Error
          ? caughtError
          : new Error('Could not generate AI recipe. Please try again.')

      setMediaJobError(getFriendlyMediaJobError(caughtError, nextError))
      setIsStartLocked(false)
      track('media_job_failed', {
        platform,
        error_code:
          caughtError instanceof RecipeApiError
            ? caughtError.code
            : 'media_job_failed',
      })
      track('media_job_create_failed', {
        platform,
        error_code:
          caughtError instanceof RecipeApiError
            ? caughtError.code
            : 'media_job_failed',
      })
    } finally {
      void queryClient.invalidateQueries({
        queryKey: ['ai-access-state'],
      })
      if (mountedRef.current) {
        setIsCreatingMediaJob(false)
      }
    }
  }

  const handleRetryMetadata = async () => {
    if (isRefreshingMetadata) {
      return
    }

    setIsRefreshingMetadata(true)
    track('metadata_refresh_started', {
      source: 'saved_recipe_detail',
      platform,
    })

    try {
      const result = await refreshRecipeMetadata(recipe.id)

      track('metadata_refresh_completed', {
        source: 'saved_recipe_detail',
        metadata_status: result.metadata_status,
        worker_status: result.worker_status,
        error_code: result.error_code,
        title_present: result.title_present,
        thumbnail_present: result.thumbnail_present,
      })
      await recipeQuery.refetch()
    } catch {
      track('metadata_refresh_completed', {
        source: 'saved_recipe_detail',
        metadata_status: 'failed',
        error_code: 'client_error',
      })
    } finally {
      void queryClient.invalidateQueries({ queryKey: ['recipe-item', recipe.id] })
      void queryClient.invalidateQueries({ queryKey: ['recent-recipes'] })
      void queryClient.invalidateQueries({ queryKey: ['recipe-library'] })
      if (mountedRef.current) {
        setIsRefreshingMetadata(false)
      }
    }
  }

  return (
    <Screen compact>
      <NestedScreenHeader
        title="Saved Recipe"
        fallbackRoute="/"
        rightActions={
          <NestedHeaderIconButton
            accessibilityLabel="Open original video"
            icon="↗"
            onPress={() => {
              void openOriginalVideo()
            }}
          />
        }
      />
      <AppHeader
        eyebrow="Saved link"
        title="Recipe source"
        subtitle="Generate an AI recipe card whenever you are ready."
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
          <AppBadge label={recipeCard ? 'AI Recipe' : 'Saved Link'} />
        </View>
        <Text selectable style={[typography.heading, { color: colors.text }]}>
          {displaySourceTitle ?? 'Saved recipe link'}
        </Text>
        {displaySourceSubtitle ? (
          <Text selectable style={[typography.body, { color: colors.textMuted }]}>
            {displaySourceSubtitle}
          </Text>
        ) : null}
        {typeof liveDurationSeconds === 'number' ? (
          <Text selectable style={[typography.body, { color: colors.textMuted }]}>
            Duration: {formatDuration(liveDurationSeconds)}
          </Text>
        ) : null}
        <Button
          label="Open Original Video"
          fullWidth
          variant="outline"
          onPress={() => {
            void openOriginalVideo()
          }}
        />
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
          Recipe Dost saves the link and recipe card, not the video file.
        </Text>
        <View style={{ gap: spacing.xs }}>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Platform
          </Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            {getPlatformLabel(platform)}
          </Text>
        </View>
      </Card>

      {recipe.metadata_status === 'failed' ? (
        <Card tone="muted">
          <Text selectable style={[typography.heading, { color: colors.text }]}>
            Details unavailable
          </Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            Details unavailable. You can retry details or generate the AI recipe.
          </Text>
          <Button
            label={isRefreshingMetadata ? 'Retrying details...' : 'Retry details'}
            fullWidth
            variant="secondary"
            disabled={isRefreshingMetadata}
            onPress={() => {
              void handleRetryMetadata()
            }}
          />
        </Card>
      ) : null}

      {recipe.metadata_status === 'pending' ? (
        <Card tone="muted">
          <Text selectable style={[typography.body, { color: colors.textMuted }]}>
            Fetching details...
          </Text>
        </Card>
      ) : null}

      {mediaJobQuery.isLoading && !displayMediaJob ? (
        <LoadingState message="Checking AI recipe status..." />
      ) : null}

      {mediaJobQuery.error ? (
        <ErrorState
          title="Could not load AI recipe status"
          message={getFriendlyApiErrorMessage(
            mediaJobQuery.error,
            mediaJobQuery.error.message
          )}
          retryLabel="Retry"
          onRetry={() => {
            void mediaJobQuery.refetch()
          }}
        />
      ) : null}

      {activeMediaJob ? (
        <Card tone="warm">
          <Text selectable style={[typography.heading, { color: colors.text }]}>
            Analyzing
          </Text>
          <Text selectable style={[typography.body, { color: colors.textMuted }]}>
            Recipe Dost is generating your AI recipe card.
          </Text>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: activeMediaJob.progress }}
            style={{
              overflow: 'hidden',
              height: 8,
              borderRadius: radius.pill,
              backgroundColor: colors.border,
            }}
          >
            <View
              style={{
                width: `${activeMediaJob.progress}%`,
                height: '100%',
                backgroundColor: colors.primary,
              }}
            />
          </View>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            {activeMediaJob.progress}% complete
          </Text>
        </Card>
      ) : resultRecipeCardId ? (
        <Card tone="warm">
          <AppBadge label="AI Recipe ready" tone="accent" />
          <Text selectable style={[typography.heading, { color: colors.text }]}>
            {recipeCard?.recipe_title?.trim() || 'AI recipe ready'}
          </Text>
          {recipeCard?.short_summary?.trim() ? (
            <Text selectable style={[typography.body, { color: colors.textMuted }]}>
              {recipeCard.short_summary.trim()}
            </Text>
          ) : null}
          <Button
            label="Open AI Recipe"
            fullWidth
            variant="accent"
            onPress={() =>
              router.push(
                `/recipe-card/${resultRecipeCardId}?returnTo=${encodeURIComponent(
                  `/recipe/${recipeId}`
                )}`
              )
            }
          />
        </Card>
      ) : shouldShowAiActionCard ? (
        <Card tone="warm">
          {shouldShowUpgradeCard ? (
            <View style={{ gap: spacing.xs }}>
              <AppBadge label="AI recipes left: 0" tone="warning" />
              <Text selectable style={[typography.heading, { color: colors.text }]}>
                Free AI recipes used
              </Text>
              <Text selectable style={[typography.body, { color: colors.textMuted }]}>
                You've used your 3 free AI recipes. Upgrade to create up to 100 AI recipe cards/month.
              </Text>
              <Button
                label="Upgrade to Premium"
                fullWidth
                variant="accent"
                onPress={() => router.push('/paywall')}
              />
              <Button
                label="Maybe later"
                fullWidth
                variant="ghost"
                onPress={handleMaybeLater}
              />
            </View>
          ) : mediaJobFailureCopy ? (
            <View style={{ gap: spacing.xs }}>
              <Text selectable style={[typography.heading, { color: colors.text }]}>
                {mediaJobFailureCopy.title}
              </Text>
              <Text selectable style={[typography.body, { color: colors.textMuted }]}>
                {mediaJobFailureCopy.body}
              </Text>
              {!isMetadataPending && !durationBlockMessage ? (
                <Button
                  label="Try again"
                  variant="secondary"
                  disabled={isGenerateDisabled || isSyncingPremiumAccess}
                  onPress={() => {
                    void handleCreateMediaJob()
                  }}
                />
              ) : null}
            </View>
          ) : (
            <>
              <View style={{ gap: spacing.xs }}>
                <Text selectable style={[typography.heading, { color: colors.text }]}>
                  Generate AI Recipe
                </Text>
                <Text selectable style={[typography.body, { color: colors.textMuted }]}>
                  AI turns this saved link and available details into a recipe card.
                </Text>
              </View>
              {!isMetadataPending && !durationBlockMessage ? (
                <Button
                  label={
                    isSyncingPremiumAccess
                      ? 'Syncing Premium access...'
                      : isCreatingMediaJob
                        ? 'Starting AI Recipe...'
                        : 'Generate AI Recipe'
                  }
                  fullWidth
                  variant="accent"
                  disabled={isGenerateDisabled || isSyncingPremiumAccess}
                  onPress={() => {
                    void handleCreateMediaJob()
                  }}
                />
              ) : null}
            </>
          )}
          {isMetadataPending && !shouldShowUpgradeCard ? (
            <View style={{ gap: spacing.xs }}>
              <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
                Preparing video details...
              </Text>
              <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
                You can generate the AI recipe once the preview check finishes.
              </Text>
            </View>
          ) : null}
          {durationBlockMessage && !shouldShowUpgradeCard ? (
            <Text selectable style={[typography.caption, { color: colors.warning }]}>
              {durationBlockMessage}
            </Text>
          ) : null}
          {!shouldShowUpgradeCard && !isMetadataPending && !durationBlockMessage && subscriptionStatus.isPremium ? (
            <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
              {getRecipeSubscriptionAvailabilityText(subscriptionStatus)}
            </Text>
          ) : null}
          {!shouldShowUpgradeCard && !isMetadataPending && !durationBlockMessage && !subscriptionStatus.isPremium && aiAccess ? (
            <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
              {getAiAvailabilityText(aiAccess)}
            </Text>
          ) : null}
        </Card>
      ) : null}

      {isCreatingMediaJob || isStartLocked ? (
        <LoadingState message="Starting AI recipe..." />
      ) : null}

      {mediaJobError ? (
        <Card tone="muted">
          <Text selectable style={[typography.heading, { color: colors.warning }]}>
            Could not generate AI recipe
          </Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            {mediaJobError.message}
          </Text>
        </Card>
      ) : null}

      {aiAccessQuery.error ? (
        <Card tone="muted">
          <Text selectable style={[typography.heading, { color: colors.text }]}>
            Could not load AI availability
          </Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            {getFriendlyApiErrorMessage(
              aiAccessQuery.error,
              aiAccessQuery.error.message
            )}
          </Text>
          <Button
            label="Retry"
            fullWidth
            variant="secondary"
            onPress={() => {
              void aiAccessQuery.refetch()
            }}
          />
        </Card>
      ) : null}
    </Screen>
  )
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

function isMetadataRefreshActive(status: string | null | undefined) {
  return (
    status === 'pending' ||
    status === 'saving' ||
    status === 'loading' ||
    status === 'fetching'
  )
}

function isTerminalMediaJob(mediaJob: MediaJob | null | undefined) {
  return (
    mediaJob?.status === 'completed' ||
    mediaJob?.status === 'failed' ||
    mediaJob?.status === 'cancelled' ||
    mediaJob?.status === 'needs_caption'
  )
}

function buildAttachedMediaJob({
  job,
  recipeItemId,
  platform,
}: {
  job: {
    id: string
    recipe_item_id: string | null
    status: MediaJob['status']
    progress: number
    result_recipe_card_id: string | null
    error_code: string | null
    created_at: string
    updated_at: string
  }
  recipeItemId: string
  platform: RecipePlatform
}): MediaJob {
  return {
    id: job.id,
    recipe_item_id: job.recipe_item_id ?? recipeItemId,
    platform,
    ai_provider: null,
    status: job.status,
    source_mode: 'unsupported_video_link',
    source_metadata: {},
    progress: job.progress,
    error_code: job.error_code,
    error_message: null,
    thumbnail_url: null,
    result_recipe_card_id: job.result_recipe_card_id,
    created_at: job.created_at,
    updated_at: job.updated_at,
  }
}

function getDurationBlockMessage(
  recipe: { duration_seconds: number | null; source_metadata: unknown },
  mediaJob:
    | {
        source_metadata: {
          duration_seconds?: number
          is_too_long?: boolean
        }
      }
    | null
    | undefined
) {
  if (
    recipe.duration_seconds !== null &&
    recipe.duration_seconds > MAX_AI_VIDEO_DURATION_SECONDS
  ) {
    return LONG_VIDEO_MESSAGE
  }

  if (
    typeof mediaJob?.source_metadata.duration_seconds === 'number' &&
    mediaJob.source_metadata.duration_seconds > MAX_AI_VIDEO_DURATION_SECONDS
  ) {
    return LONG_VIDEO_MESSAGE
  }

  if (mediaJob?.source_metadata.is_too_long === true) {
    return LONG_VIDEO_MESSAGE
  }

  const sourceMetadata = recipe.source_metadata

  if (isRecord(sourceMetadata)) {
    const durationSeconds = getNumberValue(
      sourceMetadata.duration_seconds ?? sourceMetadata.durationSeconds
    )
    const isTooLong = getBooleanValue(
      sourceMetadata.is_too_long ?? sourceMetadata.isTooLong
    )

    if (
      (durationSeconds !== null &&
        durationSeconds > MAX_AI_VIDEO_DURATION_SECONDS) ||
      isTooLong === true
    ) {
      return LONG_VIDEO_MESSAGE
    }
  }

  return null
}

function getMediaJobFailureCopy(
  mediaJob:
    | {
        status: string
        error_code: string | null
        error_message: string | null
      }
    | null
    | undefined
) {
  if (mediaJob?.status !== 'failed') {
    return null
  }

  switch (mediaJob.error_code) {
    case 'gemini_structured_extraction_failed':
      return {
        title: 'Could not understand this recipe video',
        body: 'Recipe Dost could not extract a clear recipe from this video. Try again, or use a shorter video with clearer cooking steps.',
      }
    case 'gemini_daily_dev_limit_reached':
      return {
        title: 'AI generation temporarily unavailable',
        body: 'AI generation is temporarily unavailable because the daily AI limit was reached. Please try again later.',
      }
    case 'video_duration_exceeded':
      return {
        title: 'Video is too long',
        body: LONG_VIDEO_MESSAGE,
      }
    default:
      if (isDurationExceededCode(mediaJob.error_code)) {
        return {
          title: 'Video is too long',
          body: LONG_VIDEO_MESSAGE,
        }
      }

      return {
        title: 'Could not generate AI recipe',
        body: 'Could not generate AI recipe. Please try again.',
      }
  }
}

function isDurationExceededCode(code: string | null | undefined) {
  return (
    code === 'video_duration_exceeded' ||
    code === 'media_duration_exceeded' ||
    code === 'video_too_long' ||
    code === 'duration_exceeded'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function getNumberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getBooleanValue(value: unknown) {
  return typeof value === 'boolean' ? value : null
}

function getSafeReturnToRoute(value: string | string[] | undefined) {
  const route = Array.isArray(value) ? value[0] : value

  if (!route || !route.startsWith('/') || route.startsWith('//')) {
    return null
  }

  return route
}

function getFriendlyMediaJobError(caughtError: unknown, fallback: Error) {
  if (caughtError instanceof RecipeApiError) {
    const failureCopy = getMediaJobFailureCopy({
      status: 'failed',
      error_code: caughtError.code,
      error_message: caughtError.message,
    })

    if (failureCopy) {
      return new Error(failureCopy.body)
    }
  }

  return new Error(getFriendlyApiErrorMessage(caughtError, fallback.message))
}

function getAiAvailabilityText(access: {
  role: string
  isTestUser: boolean
  premiumActive: boolean
  activeReserved: number
  remainingToStart: number | null
  reason: string
}) {
  if (access.role === 'admin' || access.isTestUser || access.premiumActive) {
    return 'AI recipe generation is available.'
  }

  const remaining = access.remainingToStart ?? 0

  if (access.activeReserved > 0) {
    return `${access.activeReserved} analyzing, ${remaining} left`
  }

  if (access.reason === 'limit_reached') {
    return 'No free AI slots left. Wait for active analysis to finish or upgrade.'
  }

  return `${remaining} free AI ${remaining === 1 ? 'recipe' : 'recipes'} left`
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes === 0) {
    return `${seconds}s`
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
