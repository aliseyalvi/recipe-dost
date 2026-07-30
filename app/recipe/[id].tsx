import { getPlatformLabel } from '@/features/recipe-draft/platform'
import { PlatformBadge } from '@/features/recipe-draft/platform-badge'
import { RecipePlatform } from '@/features/recipe-draft/types'
import {
  getRecipeCreatorLabel,
  getRecipeDisplayTitle,
} from '@/features/home/recipe-display-metadata'
import {
  AiRecipeHero,
  DetailUsagePill,
  EditorialButton,
  HeaderIconButton,
  InlineAiFailureCard,
  RecipeAnalyzingState,
  RecipeDetailScaffold,
  RecipeFailedState,
  RecipeMetadataState,
  RecipeStatGrid,
} from '@/features/recipe-detail/detail-presentation'
import { getRecipeDetailViewState } from '@/features/recipe-detail/recipe-detail-view-state'
import { getFailedJobPresentation } from '@/features/recipe-detail/failed-job-presentation'
import { RecipeDetailActionMenu } from '@/features/recipe-detail/recipe-detail-action-menu'
import { getPaywallHref } from '@/features/paywall/paywall-model'
import {
  getMediaJobProcessingStage,
  getMetadataProcessingStage,
} from '@/features/media-jobs/processing-stage'
import { ProcessingStatusPanel } from '@/features/media-jobs/processing-status-panel'
import {
  formatSourceDurationSeconds,
  formatDurationWords,
  formatRecipeDurationMinutes,
  getDurationLimitMessage,
  getEffectiveSourceDurationLimitSeconds,
  getSafeRetryBlockMessage,
  resolveDurationSemantics,
  selectMediaCtaState,
} from '@/features/media-jobs/duration-policy'
import { shouldRefreshAiAccessForTerminalJob } from '@/features/media-jobs/terminal-ai-access-refresh'
import {
  MediaJobStartGuard,
} from '@/features/media-jobs/media-job-start-guard'
import { useUserProfileQuery } from '@/features/onboarding/use-user-profile-query'
import {
  getNormalizedSubscriptionStatus,
  getRecipeSubscriptionAvailabilityText,
} from '@/features/subscription/normalized-subscription-status'
import type { SubscriptionState } from '@/features/subscription/subscription-state'
import {
  DEFAULT_SECONDARY_RECIPE_LANGUAGE_CODE,
  getSecondaryRecipeLanguage,
} from '@/features/settings/secondary-recipe-language'
import {
  aiAccessQueryKey,
  fetchAuthoritativeAiAccess,
  useAiAccessQuery,
} from '@/lib/query/ai-access-query'
import {
  getAiAccessQuotaPresentation,
  reserveAiAccessForCreatedJob,
} from '@/features/ai-access/ai-access-state'
import { getFriendlyApiErrorMessage } from '@/lib/api/errors'
import type { AiAccessState } from '@/lib/api/ai-access'
import { reportError } from '@/lib/observability/sentry'
import { isUnexpectedTechnicalFailureCode } from '@/lib/observability/sentry-policy'
import { useRefetchOnAppForeground } from '@/lib/query/use-refetch-on-app-foreground'
import {
  type MediaJob,
  type RecipeLibraryItem,
  RecipeApiError,
  createMediaJob,
  deleteRecipe,
  getLatestMediaJobForRecipe,
  getRecipeCard,
  getSavedRecipeItem,
  isMediaJobActive,
  refreshRecipeMetadata,
  retryMediaJob,
  toggleFavorite,
} from '@/lib/api/recipes'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { useAuth } from '@/providers/auth-provider'
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
import type { AppIconName } from '@/ui/app-icon'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  useFocusEffect,
  useLocalSearchParams,
  useRootNavigationState,
  useRouter,
} from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Image, InteractionManager, Linking, Text, View } from 'react-native'

export default function SavedRecipeRoute() {
  const router = useRouter()
  const rootNavigationState = useRootNavigationState()
  const queryClient = useQueryClient()
  const { track } = usePostHog()
  const { user } = useAuth()
  const { reconcileSubscription, subscriptionState } = useRevenueCat()
  const { id, returnTo } = useLocalSearchParams<{
    id?: string
    returnTo?: string | string[]
  }>()
  const recipeId = Array.isArray(id) ? id[0] : id
  const sourceReturnToRoute = getSafeReturnToRoute(returnTo)
  const [isCreatingMediaJob, setIsCreatingMediaJob] = useState(false)
  const [isRefreshingMetadata, setIsRefreshingMetadata] = useState(false)
  const [isCheckingProcessing, setIsCheckingProcessing] = useState(false)
  const [mediaJobError, setMediaJobError] = useState<Error | null>(null)
  const [showCreditLimitState, setShowCreditLimitState] = useState(false)
  const [isSyncingPremiumAccess, setIsSyncingPremiumAccess] = useState(false)
  const [isStartLocked, setIsStartLocked] = useState(false)
  const [isUpdatingFavorite, setIsUpdatingFavorite] = useState(false)
  const [isDeletingRecipe, setIsDeletingRecipe] = useState(false)
  const [isOptionsOpen, setIsOptionsOpen] = useState(false)
  const [failedAttemptPresentationId, setFailedAttemptPresentationId] =
    useState<string | null>(null)
  const [dismissedInlineFailureJobId, setDismissedInlineFailureJobId] =
    useState<string | null>(null)
  const [recipeManagementError, setRecipeManagementError] = useState<Error | null>(
    null
  )
  const [lastKnownMediaJob, setLastKnownMediaJob] =
    useState<MediaJob | null>(null)
  const didTrackUsageSummary = useRef(false)
  const lastTrackedMediaJobStatus = useRef<MediaJob['status'] | null>(null)
  const reportedTerminalMediaJobId = useRef<string | null>(null)
  const watchedMediaJobIdRef = useRef<string | null>(null)
  const presentedFailureJobIdsRef = useRef(new Set<string>())
  const refreshedTerminalJobsRef = useRef(new Set<string>())
  const mediaJobStartGuardRef = useRef(new MediaJobStartGuard())
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
  const aiAccessQuery = useAiAccessQuery(user?.id)
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
  const subscriptionStatus = getNormalizedSubscriptionStatus(subscriptionState)
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
      watchedMediaJobIdRef.current = activeMediaJob.id
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

  const refetchDetailState = useCallback(
    () => Promise.all([recipeQuery.refetch(), mediaJobQuery.refetch()]),
    [mediaJobQuery.refetch, recipeQuery.refetch]
  )

  useRefetchOnAppForeground({
    enabled: Boolean(recipeId),
    refetch: refetchDetailState,
  })

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

    const previousStatus = lastTrackedMediaJobStatus.current
    const didTransitionFromActive =
      previousStatus !== null &&
      !['completed', 'failed', 'cancelled', 'needs_caption'].includes(
        previousStatus
      )

    lastTrackedMediaJobStatus.current = mediaJob.status
    track('media_job_status_viewed', {
      platform: getRecipePlatform(mediaJob.platform),
      status: mediaJob.status,
      progress: mediaJob.progress,
    })
    if (mediaJob.status === 'completed' && didTransitionFromActive) {
      track('media_job_completed', {
        platform: getRecipePlatform(mediaJob.platform),
        status: mediaJob.status,
      })
    }
    const failurePresentation = getFailedJobPresentation({
      jobId: mediaJob.id,
      status: mediaJob.status,
      previousStatus,
      watchedJobId: watchedMediaJobIdRef.current,
      wasPresented: presentedFailureJobIdsRef.current.has(mediaJob.id),
    })
    if (failurePresentation === 'full') {
      presentedFailureJobIdsRef.current.add(mediaJob.id)
      setFailedAttemptPresentationId(mediaJob.id)
      setDismissedInlineFailureJobId(null)
    }
    if (mediaJob.status === 'failed') {
      if (didTransitionFromActive) {
        track('media_job_failed', {
          platform: getRecipePlatform(mediaJob.platform),
          error_code: mediaJob.error_code ?? 'unknown',
        })
      }
      if (
        reportedTerminalMediaJobId.current !== mediaJob.id &&
        isUnexpectedTechnicalFailureCode(mediaJob.error_code)
      ) {
        reportedTerminalMediaJobId.current = mediaJob.id
        const terminalError = new Error('AI generation terminal technical failure')
        terminalError.name = 'AiGenerationTerminalError'
        reportError(terminalError)
      }
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

    if (
      user?.id &&
      shouldRefreshAiAccessForTerminalJob(
        refreshedTerminalJobsRef.current,
        mediaJob
      )
    ) {
      void fetchAuthoritativeAiAccess(queryClient, user.id, true).catch(() => {
        // React Query preserves the last authoritative snapshot on refresh error.
      })
    }
  }, [
    displayMediaJob,
    displayMediaJob?.status,
    queryClient,
    recipeId,
    track,
    user?.id,
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
  const durationSemantics = resolveDurationSemantics(recipe, {
    actual_duration_seconds:
      displayMediaJob?.source_metadata.actual_duration_seconds,
    media_duration_seconds: displayMediaJob?.media_duration_seconds,
  })
  const liveDurationSeconds = durationSemantics.sourceVideoDurationSeconds
  const mediaCtaState = selectMediaCtaState({
    jobId: displayMediaJob?.id,
    jobStatus: displayMediaJob?.status,
    retryable: displayMediaJob?.source_metadata.retryable,
    retryBlockReason: displayMediaJob?.source_metadata.retry_block_reason,
    sourceVideoDurationSeconds: liveDurationSeconds,
    maxDurationSeconds: displayMediaJob?.source_metadata.max_duration_seconds,
    maxSourceVideoDurationSeconds:
      displayMediaJob?.source_metadata.max_source_video_duration_seconds,
    hasRecipeCard: Boolean(recipeCard || resultRecipeCardId),
  })
  const isMetadataPending = isMetadataRefreshActive(recipe.metadata_status)
  const durationBlockMessage =
    mediaCtaState.kind === 'duration_blocked'
      ? mediaCtaState.message
      : null
  const mediaJobFailureCopy = getMediaJobFailureCopy(displayMediaJob)
  const aiAccessPresentation = getAiAccessQuotaPresentation(aiAccess, {
    isPending: aiAccessQuery.isPending,
    isFetching: aiAccessQuery.isFetching,
    hasError: aiAccessQuery.isError,
  })
  const isBackendAccessBlocked =
    Boolean(aiAccess && !aiAccess.canStartAiJob && !subscriptionStatus.needsSync) ||
    Boolean(aiAccessQuery.error && !aiAccess)
  const isGenerateDisabled =
    isCreatingMediaJob ||
    isStartLocked ||
    Boolean(activeMediaJob) ||
    isMetadataPending ||
    isBackendAccessBlocked ||
    !mediaCtaState.enabled
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
  const detailViewState = getRecipeDetailViewState({
    metadataStatus: recipe.metadata_status,
    mediaJob: displayMediaJob,
    hasRecipeCard: Boolean(recipeCard || resultRecipeCardId),
  })
  const displayRecipeItem = {
    ...recipe,
    is_favorite: recipe.is_favorite === true,
    latest_card: recipeCard,
    latest_media_job: displayMediaJob,
  } as RecipeLibraryItem
  const normalizedDisplayTitle = getRecipeDisplayTitle(displayRecipeItem)
  const creatorLabel = getRecipeCreatorLabel(displayRecipeItem)
  const platformLabel = getPlatformLabel(platform)
  const displayCreator =
    creatorLabel.toLocaleLowerCase() === platformLabel.toLocaleLowerCase()
      ? null
      : creatorLabel
  const detailUsageLabel = aiAccessPresentation.label
  const showOneTimeAiFailure =
    failedAttemptPresentationId !== null &&
    failedAttemptPresentationId === displayMediaJob?.id &&
    (
      displayMediaJob.status === 'failed' ||
      displayMediaJob.status === 'cancelled' ||
      displayMediaJob.status === 'needs_caption'
    )
  const showInlineAiFailure =
    Boolean(mediaJobFailureCopy) &&
    dismissedInlineFailureJobId !== displayMediaJob?.id

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

  const invalidateRecipeManagement = () => {
    void queryClient.invalidateQueries({ queryKey: ['recent-recipes'] })
    void queryClient.invalidateQueries({ queryKey: ['recipe-library'] })
    void queryClient.invalidateQueries({ queryKey: ['recipe-item', recipe.id] })
    void queryClient.invalidateQueries({ queryKey: ['recipe-card'] })
    void queryClient.invalidateQueries({ queryKey: ['recipe-grocery-list'] })
    void queryClient.invalidateQueries({ queryKey: ['recipe-grocery-lists'] })
  }

  const handleToggleFavorite = async () => {
    if (isUpdatingFavorite || isDeletingRecipe) {
      return
    }

    setIsUpdatingFavorite(true)
    setRecipeManagementError(null)

    try {
      const isFavorite = await toggleFavorite(recipe.id, recipe.is_favorite === true)

      queryClient.setQueryData(['recipe-item', recipe.id], {
        ...recipe,
        is_favorite: isFavorite,
      })
      invalidateRecipeManagement()
      track('recipe_favorite_toggled', {
        platform,
        is_favorite: isFavorite,
        source: 'saved_recipe_detail',
      })
    } catch {
      setRecipeManagementError(new Error('Could not update this favorite. Please try again.'))
      track('recipe_favorite_toggle_failed', {
        platform,
        source: 'saved_recipe_detail',
      })
    } finally {
      if (mountedRef.current) {
        setIsUpdatingFavorite(false)
      }
    }
  }

  const handleDeleteRecipe = async () => {
    if (isDeletingRecipe) {
      return
    }

    setIsDeletingRecipe(true)
    setRecipeManagementError(null)

    try {
      await deleteRecipe(recipe.id)
      queryClient.removeQueries({ queryKey: ['recipe-item', recipe.id] })
      invalidateRecipeManagement()
      track('recipe_deleted', {
        platform,
        source: 'saved_recipe_detail',
      })
      router.replace(sourceReturnToRoute ?? '/library')
    } catch {
      setRecipeManagementError(new Error('Could not delete this saved recipe. Please try again.'))
      track('recipe_delete_failed', {
        platform,
        source: 'saved_recipe_detail',
      })
    } finally {
      if (mountedRef.current) {
        setIsDeletingRecipe(false)
      }
    }
  }

  const confirmDeleteRecipe = () => {
    Alert.alert(
      'Delete this saved recipe?',
      'This removes the saved link and recipe card from your library. It does not affect the original video.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete recipe',
          style: 'destructive',
          onPress: () => {
            void handleDeleteRecipe()
          },
        },
      ]
    )
  }

  const handleMaybeLater = () => {
    if (router.canGoBack()) {
      router.back()
      return
    }

    router.replace(sourceReturnToRoute ?? '/home')
  }

  const handleLeaveProcessing = () => {
    track('processing_leave_tapped', {
      platform,
      destination: '/library',
      status: activeMediaJob?.status ?? 'metadata_pending',
    })
    router.replace('/library')
  }

  const handleWaitHere = async () => {
    track('processing_wait_here_tapped', {
      platform,
      status: activeMediaJob?.status ?? 'metadata_pending',
    })
    setIsCheckingProcessing(true)

    try {
      await Promise.all([mediaJobQuery.refetch(), recipeQuery.refetch()])
    } finally {
      if (mountedRef.current) {
        setIsCheckingProcessing(false)
      }
    }
  }

  const handleCreateMediaJob = async () => {
    await mediaJobStartGuardRef.current.run(async () => {
      if (isGenerateDisabled) {
        if (durationBlockMessage) {
          setMediaJobError(new Error(durationBlockMessage))
        }
        return
      }

      if (
        subscriptionState.kind === 'store_premium_backend_pending' &&
        aiAccess &&
        !aiAccess.canStartAiJob
      ) {
        setIsSyncingPremiumAccess(true)
        setMediaJobError(null)
        const reconciliation = await reconcileSubscription('generate')
        setIsSyncingPremiumAccess(false)
        if (!reconciliation.backendAccess?.canStartAiJob) {
          setMediaJobError(new Error(getGenerateAccessMessage(subscriptionState.kind)))
          return
        }
      }

      if (
        isAiLimitReached &&
        !subscriptionStatus.isPremium
      ) {
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
        retry_attempt: false,
      })

      try {
        const submitMediaJob = () => createMediaJob({
          recipeItemId: recipe.id,
          secondaryRecipeLanguageCode: secondaryRecipeLanguage.code,
        })
        const createdJob = await submitMediaJob()

        if (!mountedRef.current) {
          return
        }

        shouldAutoOpenResultRef.current = true
        if (failedAttemptPresentationId) {
          setFailedAttemptPresentationId(null)
        }
        setDismissedInlineFailureJobId(null)

        if (
          user?.id &&
          !createdJob.duplicate_active_job &&
          !createdJob.existing_job
        ) {
          queryClient.setQueryData<AiAccessState>(
            aiAccessQueryKey(user.id),
            reserveAiAccessForCreatedJob
          )
        }

        if (createdJob.media_job) {
          const attachedJob = buildAttachedMediaJob({
            job: createdJob.media_job,
            recipeItemId: recipe.id,
            platform,
          })

          watchedMediaJobIdRef.current = attachedJob.id
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
          retry_attempt: false,
        })
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
          router.push(getPaywallHref('generation_access_blocked'))
          return
        }

        if (
          caughtError instanceof RecipeApiError &&
          caughtError.code === 'premium_sync_required'
        ) {
          setIsSyncingPremiumAccess(true)
          const reconciliation = await reconcileSubscription('generate')
          setIsSyncingPremiumAccess(false)
          if (reconciliation.backendAccess?.canStartAiJob) {
            try {
              const retriedJob = await createMediaJob({
                recipeItemId: recipe.id,
                secondaryRecipeLanguageCode: secondaryRecipeLanguage.code,
              })
              shouldAutoOpenResultRef.current = true
              if (
                user?.id &&
                !retriedJob.duplicate_active_job &&
                !retriedJob.existing_job
              ) {
                queryClient.setQueryData<AiAccessState>(
                  aiAccessQueryKey(user.id),
                  reserveAiAccessForCreatedJob
                )
              }
              if (retriedJob.media_job) {
                const attachedJob = buildAttachedMediaJob({
                  job: retriedJob.media_job,
                  recipeItemId: recipe.id,
                  platform,
                })
                watchedMediaJobIdRef.current = attachedJob.id
                queryClient.setQueryData(['media-job', 'recipe', recipe.id], attachedJob)
                setLastKnownMediaJob(attachedJob)
              }
              await mediaJobQuery.refetch()
            } catch (retryError) {
              reportError(retryError)
              setMediaJobError(getFriendlyMediaJobError(
                retryError,
                new Error('Could not generate AI recipe. Please try again.')
              ))
            }
          } else {
            setMediaJobError(new Error(getGenerateAccessMessage(subscriptionState.kind)))
          }
          setIsStartLocked(false)
          return
        }

        if (
          caughtError instanceof RecipeApiError &&
          caughtError.code === 'premium_monthly_limit_reached'
        ) {
          setMediaJobError(
            new Error("You've used your 100 Premium AI recipes this month.")
          )
          if (user?.id) {
            await fetchAuthoritativeAiAccess(queryClient, user.id, true).catch(
              () => undefined
            )
          }
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

        reportError(caughtError)
        setMediaJobError(getFriendlyMediaJobError(caughtError, nextError))
        setIsStartLocked(false)
        track('media_job_create_failed', {
          platform,
          error_code:
            caughtError instanceof RecipeApiError
              ? caughtError.code
              : 'media_job_failed',
        })
      } finally {
        if (mountedRef.current) {
          setIsCreatingMediaJob(false)
        }
      }
    })
  }

  const handleRetryMediaJob = async () => {
    if (mediaCtaState.kind !== 'retry' || !displayMediaJob) {
      return
    }

    await mediaJobStartGuardRef.current.run(async () => {
      setIsCreatingMediaJob(true)
      setMediaJobError(null)
      track('generate_ai_recipe_tapped', {
        platform,
        retry_attempt: true,
      })

      try {
        const retryResult = await retryMediaJob(mediaCtaState.jobId)
        const isQueued =
          retryResult.retry_accepted ||
          retryResult.retry_block_reason === 'already_queued' ||
          retryResult.next_state === 'queued'

        if (retryResult.job_id !== mediaCtaState.jobId || !isQueued) {
          setMediaJobError(
            new Error(
              getSafeRetryBlockMessage(retryResult.retry_block_reason)
            )
          )
          return
        }

        const queuedJob: MediaJob = {
          ...displayMediaJob,
          id: mediaCtaState.jobId,
          status: 'queued',
          progress: 0,
          error_code: null,
          error_message: null,
          retry_requested_at: new Date().toISOString(),
          user_retry_count: retryResult.retry_count,
          source_metadata: {
            ...displayMediaJob.source_metadata,
            retryable: true,
            retry_block_reason: retryResult.retry_block_reason ?? undefined,
          },
        }

        watchedMediaJobIdRef.current = queuedJob.id
        shouldAutoOpenResultRef.current = true
        setFailedAttemptPresentationId(null)
        setDismissedInlineFailureJobId(null)
        setLastKnownMediaJob(queuedJob)
        queryClient.setQueryData(
          ['media-job', 'recipe', recipe.id],
          queuedJob
        )

        track('media_job_created', {
          platform,
          status: 'queued',
          retry_attempt: true,
        })

        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ['media-job', 'recipe', recipe.id],
          }),
          queryClient.invalidateQueries({
            queryKey: ['recipe-item', recipe.id],
          }),
          queryClient.invalidateQueries({ queryKey: ['recipe-card'] }),
          queryClient.invalidateQueries({ queryKey: ['recipe-library'] }),
          queryClient.invalidateQueries({ queryKey: ['recent-recipes'] }),
          queryClient.invalidateQueries({ queryKey: ['ai-access-state'] }),
          queryClient.invalidateQueries({ queryKey: ['usage-summary'] }),
        ])
        await Promise.all([mediaJobQuery.refetch(), recipeQuery.refetch()])
      } catch (caughtError) {
        reportError(caughtError)
        setMediaJobError(
          getFriendlyMediaJobError(
            caughtError,
            new Error('Could not retry this AI recipe. Please try again.')
          )
        )
        track('media_job_create_failed', {
          platform,
          error_code:
            caughtError instanceof RecipeApiError
              ? caughtError.code
              : 'media_job_retry_failed',
        })
      } finally {
        if (mountedRef.current) {
          setIsCreatingMediaJob(false)
        }
      }
    })
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

      if (
        result.metadata_status === 'failed' &&
        isUnexpectedTechnicalFailureCode(result.error_code)
      ) {
        const terminalError = new Error('Metadata terminal technical failure')
        terminalError.name = 'MetadataTerminalError'
        reportError(terminalError)
      }

      track('metadata_refresh_completed', {
        source: 'saved_recipe_detail',
        metadata_status: result.metadata_status,
        worker_status: result.worker_status,
        error_code: result.error_code,
        title_present: result.title_present,
        thumbnail_present: result.thumbnail_present,
      })
      await recipeQuery.refetch()
    } catch (caughtError) {
      reportError(caughtError)
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

  const managementHeaderActions = (
    <HeaderIconButton
      label="Recipe options"
      icon="more-vertical"
      onPress={() => setIsOptionsOpen(true)}
    />
  )
  const usageHeaderAction = detailUsageLabel ? (
    <DetailUsagePill
      label={detailUsageLabel}
      onPress={() => router.push(getPaywallHref('recipe_usage_pill'))}
    />
  ) : undefined

  const redesignedDetail = (() => {
  if (showOneTimeAiFailure) {
    return (
      <RecipeDetailScaffold
        title="AI Recipe"
        fallbackRoute={sourceReturnToRoute ?? '/library'}
        rightActions={managementHeaderActions}
      >
        <RecipeFailedState
          kind="ai"
          message={
            mediaJobFailureCopy?.body ??
            'Recipe Dost could not create this AI recipe. Review the source and try again.'
          }
          canRetry={mediaCtaState.kind === 'retry'}
          retryLabel="Retry AI Recipe Generation"
          secondaryActionLabel="Continue viewing metadata"
          onRetry={() => {
            setFailedAttemptPresentationId(null)
            void handleRetryMediaJob()
          }}
          onOpenOriginal={() => {
            void openOriginalVideo()
          }}
          onSecondaryAction={() => setFailedAttemptPresentationId(null)}
        />
      </RecipeDetailScaffold>
    )
  }

  if (detailViewState === 'metadata_loading') {
    const metadataStage = getMetadataProcessingStage(recipe.metadata_status)

    return (
      <RecipeDetailScaffold
        title="Recipe Dost"
        fallbackRoute={sourceReturnToRoute ?? '/library'}
        rightActions={usageHeaderAction}
      >
        <RecipeAnalyzingState
          kind="metadata"
          statusLabel={metadataStage.label}
          platformLabel={platformLabel}
          isChecking={isCheckingProcessing}
          onGoToLibrary={handleLeaveProcessing}
          onWaitHere={() => {
            void handleWaitHere()
          }}
          onOpenOriginal={() => {
            void openOriginalVideo()
          }}
        />
      </RecipeDetailScaffold>
    )
  }

  if (detailViewState === 'ai_processing' && activeMediaJob) {
    const aiStage = getMediaJobProcessingStage(activeMediaJob.status)

    return (
      <RecipeDetailScaffold
        title="AI Recipe"
        fallbackRoute={sourceReturnToRoute ?? '/library'}
        rightActions={usageHeaderAction}
      >
        <RecipeAnalyzingState
          kind="ai"
          statusLabel={aiStage.label}
          progress={activeMediaJob.progress}
          platformLabel={platformLabel}
          isChecking={isCheckingProcessing}
          onGoToLibrary={handleLeaveProcessing}
          onWaitHere={() => {
            void handleWaitHere()
          }}
        />
      </RecipeDetailScaffold>
    )
  }

  if (detailViewState === 'failed') {
    const isAiFailure = Boolean(
      displayMediaJob &&
        (displayMediaJob.status === 'failed' ||
          displayMediaJob.status === 'cancelled' ||
          displayMediaJob.status === 'needs_caption')
    )
    const failureMessage = isAiFailure
      ? mediaJobFailureCopy?.body ??
        'Recipe Dost could not create this AI recipe. Review the source and try again.'
      : 'We could not prepare the preview for this link. You can retry or open the original source.'

    return (
      <RecipeDetailScaffold
        title={isAiFailure ? 'AI Recipe' : 'Recipe Dost'}
        fallbackRoute={sourceReturnToRoute ?? '/library'}
        rightActions={managementHeaderActions}
      >
        <RecipeFailedState
          kind={isAiFailure ? 'ai' : 'metadata'}
          message={failureMessage}
          canRetry={
            isAiFailure ? mediaCtaState.kind === 'retry' : true
          }
          retryLabel={
            isAiFailure ? 'Retry AI Recipe Generation' : 'Retry'
          }
          onRetry={() => {
            if (isAiFailure) {
              void handleRetryMediaJob()
            } else {
              void handleRetryMetadata()
            }
          }}
          onOpenOriginal={() => {
            void openOriginalVideo()
          }}
          onSecondaryAction={() => router.replace('/library')}
        />
      </RecipeDetailScaffold>
    )
  }

  if (detailViewState === 'ai_ready' && resultRecipeCardId) {
    const readyStats = recipeCard
      ? getReadyRecipeStats(
          recipeCard,
          {
            prepMinutes: recipe.recipe_prep_minutes,
            cookMinutes: recipe.recipe_cook_minutes,
            totalMinutes: durationSemantics.recipeTotalMinutes,
          }
        )
      : []

    return (
      <RecipeDetailScaffold
        title="Recipe Dost"
        fallbackRoute={sourceReturnToRoute ?? '/library'}
        rightActions={managementHeaderActions}
      >
        <AiRecipeHero
          thumbnailUrl={liveThumbnailUrl}
          title={recipeCard?.recipe_title?.trim() || normalizedDisplayTitle}
          tags={recipeCard?.tags ?? []}
        />
        <RecipeStatGrid stats={readyStats} />
        {recipeCard?.short_summary?.trim() ? (
          <Text selectable style={[typography.body, { color: colors.onSurfaceVariant, textAlign: 'center' }]}>
            {recipeCard.short_summary.trim()}
          </Text>
        ) : null}
        <EditorialButton
          label="Open AI Recipe"
          icon="ai-recipe"
          variant="primary"
          onPress={() =>
            router.replace(
              `/recipe-card/${resultRecipeCardId}?returnTo=${encodeURIComponent(
                sourceReturnToRoute ?? '/library'
              )}`
            )
          }
        />
      </RecipeDetailScaffold>
    )
  }

  const availabilityText = [
    aiAccessPresentation.allowanceText,
    aiAccessPresentation.statusText,
  ].filter(Boolean).join('\n')
  const generateOpensPaywall = shouldShowUpgradeCard
  const generateLabel = generateOpensPaywall
    ? 'Upgrade to Premium'
    : isSyncingPremiumAccess
      ? 'Syncing Premium access…'
      : isCreatingMediaJob
        ? 'Starting AI Recipe…'
        : mediaCtaState.label

  return (
    <RecipeDetailScaffold
      title="Recipe Dost"
      fallbackRoute={sourceReturnToRoute ?? '/library'}
      rightActions={managementHeaderActions}
    >
      <RecipeMetadataState
        thumbnailUrl={liveThumbnailUrl}
        title={normalizedDisplayTitle}
        creator={displayCreator}
        platformLabel={platformLabel}
        durationLabel={null}
        isFavorite={recipe.is_favorite === true}
        isFavoriteUpdating={isUpdatingFavorite}
        availabilityText={
          durationBlockMessage ??
          (aiAccessQuery.error
            ? 'AI availability is temporarily unavailable.'
            : availabilityText)
        }
        generateLabel={generateLabel}
        generateDisabled={
          generateOpensPaywall
            ? false
            : isGenerateDisabled || isSyncingPremiumAccess
        }
        onGenerate={() => {
          if (generateOpensPaywall) {
            router.push(getPaywallHref('free_limit_reached'))
            return
          }

          if (mediaCtaState.kind === 'retry') {
            void handleRetryMediaJob()
            return
          }

          void handleCreateMediaJob()
        }}
        onOpenOriginal={() => {
          void openOriginalVideo()
        }}
        onToggleFavorite={() => {
          void handleToggleFavorite()
        }}
      />
      {showInlineAiFailure && mediaJobFailureCopy ? (
        <InlineAiFailureCard
          title={mediaJobFailureCopy.title}
          message={mediaJobFailureCopy.body}
          retrying={isCreatingMediaJob}
          canRetry={mediaCtaState.kind === 'retry'}
          onRetry={() => {
            void handleRetryMediaJob()
          }}
          onDismiss={() => {
            setDismissedInlineFailureJobId(displayMediaJob?.id ?? null)
          }}
        />
      ) : null}
      {mediaJobError || recipeManagementError ? (
        <View
          style={{
            gap: spacing.sm,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.error,
            backgroundColor: colors.dangerSurface,
            padding: spacing.lg,
          }}
        >
          <Text selectable style={[typography.heading, { color: colors.error }]}>
            Could not complete that action
          </Text>
          <Text selectable style={[typography.body, { color: colors.onSurface }]}>
            {(mediaJobError ?? recipeManagementError)?.message}
          </Text>
        </View>
      ) : null}
    </RecipeDetailScaffold>
  )
  })()

  if (Boolean(recipe.id)) {
    return (
      <>
        {redesignedDetail}
        <RecipeDetailActionMenu
          visible={isOptionsOpen}
          title={normalizedDisplayTitle}
          subtitle={platformLabel}
          isFavorite={recipe.is_favorite === true}
          isFavoriteUpdating={isUpdatingFavorite}
          isDeleting={isDeletingRecipe}
          canOpenOriginal={Boolean(recipe.source_url?.trim())}
          canViewSource={false}
          errorMessage={recipeManagementError?.message}
          onClose={() => setIsOptionsOpen(false)}
          onOpenOriginal={() => {
            void openOriginalVideo()
          }}
          onViewSource={() => undefined}
          onToggleFavorite={() => {
            void handleToggleFavorite()
          }}
          onDelete={() => {
            void handleDeleteRecipe()
          }}
        />
      </>
    )
  }

  return (
    <Screen compact>
      <NestedScreenHeader
        title="Saved Recipe"
        fallbackRoute="/"
        rightActions={
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            <NestedHeaderIconButton
              accessibilityLabel={
                recipe.is_favorite ? 'Remove recipe from favorites' : 'Add recipe to favorites'
              }
              icon={recipe.is_favorite ? 'heart' : 'heart-outline'}
              onPress={() => {
                void handleToggleFavorite()
              }}
            />
            <NestedHeaderIconButton
              accessibilityLabel="Open original video"
              icon="external"
              onPress={() => {
                void openOriginalVideo()
              }}
            />
          </View>
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
          {recipe.is_favorite ? <AppBadge label="Favorite" tone="accent" /> : null}
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
            Video length: {formatSourceDurationSeconds(liveDurationSeconds)}
          </Text>
        ) : null}
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
            We could not prepare the preview for this link. You can retry
            details or generate the AI recipe from the saved link.
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

      {recipe.metadata_status === 'saving' ? (
        <ProcessingStatusPanel
          stage={getMetadataProcessingStage(recipe.metadata_status)}
          isChecking={isCheckingProcessing}
          onGoToLibrary={handleLeaveProcessing}
          onWaitHere={() => {
            void handleWaitHere()
          }}
        />
      ) : null}

      {recipe.metadata_status === 'pending' ? (
        <ProcessingStatusPanel
          stage={getMetadataProcessingStage(recipe.metadata_status)}
          isChecking={isCheckingProcessing}
          onGoToLibrary={handleLeaveProcessing}
          onWaitHere={() => {
            void handleWaitHere()
          }}
        />
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
        <ProcessingStatusPanel
          stage={getMediaJobProcessingStage(activeMediaJob.status)}
          progress={activeMediaJob.progress}
          isChecking={isCheckingProcessing}
          onGoToLibrary={handleLeaveProcessing}
          onWaitHere={() => {
            void handleWaitHere()
          }}
        />
      ) : resultRecipeCardId ? (
        <Card tone="warm">
          <AppBadge label="Ready" tone="accent" />
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
                onPress={() =>
                  router.push(getPaywallHref('free_limit_reached'))
                }
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
              <AppBadge label="Failed" tone="warning" />
              <Text selectable style={[typography.heading, { color: colors.text }]}>
                {mediaJobFailureCopy.title}
              </Text>
              <Text selectable style={[typography.body, { color: colors.textMuted }]}>
                {mediaJobFailureCopy.body}
              </Text>
              {!isMetadataPending && !durationBlockMessage ? (
                <Button
                  label={mediaCtaState.label}
                  variant="secondary"
                  disabled={isGenerateDisabled || isSyncingPremiumAccess}
                  onPress={() => {
                    if (mediaCtaState.kind === 'retry') {
                      void handleRetryMediaJob()
                    }
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
                You can leave this screen while the preview finishes. Home and
                Library will refresh when details are ready.
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

      {recipeManagementError ? (
        <Card tone="muted">
          <Text selectable style={[typography.heading, { color: colors.warning }]}>
            Could not update recipe management
          </Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            {recipeManagementError.message}
          </Text>
        </Card>
      ) : null}

      <Card tone="muted">
        <Text selectable style={[typography.heading, { color: colors.danger }]}>
          Remove from Library
        </Text>
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          Remove this saved recipe and its AI card from your active library.
        </Text>
        <Button
          label={isDeletingRecipe ? 'Deleting recipe...' : 'Delete recipe'}
          fullWidth
          variant="outline"
          disabled={isDeletingRecipe}
          onPress={confirmDeleteRecipe}
        />
      </Card>

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
    media_duration_seconds: null,
    thumbnail_url: null,
    result_recipe_card_id: job.result_recipe_card_id,
    retry_requested_at: null,
    user_retry_count: 0,
    created_at: job.created_at,
    updated_at: job.updated_at,
  }
}

function getMediaJobFailureCopy(
  mediaJob:
    | MediaJob
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

  const sourceMetadata =
    'source_metadata' in mediaJob ? mediaJob.source_metadata : {}
  const mediaDurationSeconds =
    'media_duration_seconds' in mediaJob
      ? mediaJob.media_duration_seconds
      : null

  if (isDurationExceededCode(mediaJob.error_code)) {
    const actualDurationSeconds =
      sourceMetadata.actual_duration_seconds ??
      mediaDurationSeconds ??
      sourceMetadata.duration_seconds
    const maxDurationSeconds = getEffectiveSourceDurationLimitSeconds({
      maxDurationSeconds: sourceMetadata.max_duration_seconds,
      maxSourceVideoDurationSeconds:
        sourceMetadata.max_source_video_duration_seconds,
    })
    const isCurrentlyOverLimit =
      typeof actualDurationSeconds === 'number' &&
      actualDurationSeconds > maxDurationSeconds

    if (
      sourceMetadata.retryable === true &&
      !isCurrentlyOverLimit
    ) {
      return {
        title: 'AI recipe can be retried',
        body: `This video is within the current ${formatDurationWords(maxDurationSeconds)} limit. Retry to queue the same AI recipe job again.`,
      }
    }

    return getDurationLimitMessage(
      actualDurationSeconds,
      maxDurationSeconds
    )
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
    default:
      if (sourceMetadata.retryable !== true) {
        return {
          title: 'Could not retry AI recipe',
          body: getSafeRetryBlockMessage(
            sourceMetadata.retry_block_reason
          ),
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

  const remaining = access.remainingToStart

  if (remaining === null) {
    return 'Checking your AI recipe allowance…'
  }

  if (access.activeReserved > 0) {
    return `${access.activeReserved} analyzing, ${remaining} left`
  }

  if (access.reason === 'limit_reached') {
    return 'No free AI slots left. Wait for active analysis to finish or upgrade.'
  }

  return `${remaining} free AI ${remaining === 1 ? 'recipe' : 'recipes'} left`
}

function getGenerateAccessMessage(state: SubscriptionState['kind']) {
  if (state === 'expired') return 'Your previous subscription has expired.'
  if (state === 'binding_conflict') {
    return 'This purchase is linked to another app profile. Contact support for help.'
  }
  if (state === 'store_premium_backend_pending') {
    return 'Purchase found. Verifying your AI access…'
  }
  return 'AI access is still unavailable. Check your subscription status.'
}

function getReadyRecipeStats(
  recipeCard: Awaited<ReturnType<typeof getRecipeCard>>,
  duration: {
    prepMinutes: number | null
    cookMinutes: number | null
    totalMinutes: number | null
  }
) {
  const stats: { icon: AppIconName; label: string; value: string }[] = []

  if (duration.totalMinutes) {
    stats.push({
      icon: 'clock',
      label: 'Recipe time',
      value: formatRecipeDurationMinutes(duration.totalMinutes),
    })
  }

  if (duration.prepMinutes) {
    stats.push({
      icon: 'clock',
      label: 'Prep time',
      value: `${duration.prepMinutes} min`,
    })
  }

  if (duration.cookMinutes) {
    stats.push({
      icon: 'flame',
      label: 'Cook time',
      value: `${duration.cookMinutes} min`,
    })
  }

  if (recipeCard.servings?.trim()) {
    stats.push({ icon: 'servings', label: 'Servings', value: recipeCard.servings.trim() })
  }

  if (recipeCard.difficulty?.trim()) {
    stats.push({
      icon: 'ai-recipe',
      label: 'Difficulty',
      value: recipeCard.difficulty.trim(),
    })
  }

  return stats
}
