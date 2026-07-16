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
  RecipeAnalyzingState,
  RecipeDetailScaffold,
  RecipeFailedState,
  RecipeMetadataState,
  RecipeStatGrid,
} from '@/features/recipe-detail/detail-presentation'
import { getRecipeDetailViewState } from '@/features/recipe-detail/recipe-detail-view-state'
import { getPaywallHref } from '@/features/paywall/paywall-model'
import {
  getMediaJobProcessingStage,
  getMetadataProcessingStage,
} from '@/features/media-jobs/processing-stage'
import { ProcessingStatusPanel } from '@/features/media-jobs/processing-status-panel'
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
  toggleFavorite,
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
  const [isCheckingProcessing, setIsCheckingProcessing] = useState(false)
  const [mediaJobError, setMediaJobError] = useState<Error | null>(null)
  const [showCreditLimitState, setShowCreditLimitState] = useState(false)
  const [isSyncingPremiumAccess, setIsSyncingPremiumAccess] = useState(false)
  const [isStartLocked, setIsStartLocked] = useState(false)
  const [isUpdatingFavorite, setIsUpdatingFavorite] = useState(false)
  const [isDeletingRecipe, setIsDeletingRecipe] = useState(false)
  const [recipeManagementError, setRecipeManagementError] = useState<Error | null>(
    null
  )
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
    if (mediaJob.status === 'failed') {
      if (didTransitionFromActive) {
        track('media_job_failed', {
          platform: getRecipePlatform(mediaJob.platform),
          error_code: mediaJob.error_code ?? 'unknown',
        })
      }
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
  const detailUsageLabel = getDetailUsageLabel(aiAccess)

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
        router.push(getPaywallHref('generation_access_blocked'))
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

  const managementHeaderActions = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <HeaderIconButton
        label={
          recipe.is_favorite
            ? 'Remove recipe from favorites'
            : 'Add recipe to favorites'
        }
        icon={recipe.is_favorite ? 'heart' : 'heart-outline'}
        selected={recipe.is_favorite === true}
        disabled={isUpdatingFavorite || isDeletingRecipe}
        onPress={() => {
          void handleToggleFavorite()
        }}
      />
      <HeaderIconButton
        label="Open original video"
        icon="external"
        onPress={() => {
          void openOriginalVideo()
        }}
      />
    </View>
  )
  const usageHeaderAction = detailUsageLabel ? (
    <DetailUsagePill
      label={detailUsageLabel}
      onPress={() => router.push(getPaywallHref('recipe_usage_pill'))}
    />
  ) : undefined

  const redesignedDetail = (() => {
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
          canRetry={!durationBlockMessage}
          onRetry={() => {
            if (isAiFailure) {
              void handleCreateMediaJob()
            } else {
              void handleRetryMetadata()
            }
          }}
          onOpenOriginal={() => {
            void openOriginalVideo()
          }}
          onGoToLibrary={() => router.replace('/library')}
        />
      </RecipeDetailScaffold>
    )
  }

  if (detailViewState === 'ai_ready' && resultRecipeCardId) {
    const readyStats = recipeCard
      ? getReadyRecipeStats(recipeCard)
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

  const availabilityText = subscriptionStatus.isPremium
    ? getRecipeSubscriptionAvailabilityText(subscriptionStatus)
    : aiAccess
      ? getAiAvailabilityText(aiAccess)
      : null
  const generateOpensPaywall = shouldShowUpgradeCard
  const generateLabel = generateOpensPaywall
    ? 'Upgrade to Premium'
    : isSyncingPremiumAccess
      ? 'Syncing Premium access…'
      : isCreatingMediaJob
        ? 'Starting AI Recipe…'
        : 'Generate AI Recipe'

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
        durationLabel={
          typeof liveDurationSeconds === 'number'
            ? formatDuration(liveDurationSeconds)
            : null
        }
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

          void handleCreateMediaJob()
        }}
        onOpenOriginal={() => {
          void openOriginalVideo()
        }}
        onToggleFavorite={() => {
          void handleToggleFavorite()
        }}
      />
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
    return redesignedDetail
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
            Duration: {formatDuration(liveDurationSeconds)}
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

function getDetailUsageLabel(
  access: Awaited<ReturnType<typeof getAiAccessState>> | undefined
) {
  if (!access) {
    return null
  }

  if (access.plan === 'premium' || access.premiumActive) {
    return `${Math.max(0, access.premiumMonthlyRemainingToStart)} left`
  }

  return `${Math.max(0, access.freeRemainingToStart)} left`
}

function getReadyRecipeStats(
  recipeCard: Awaited<ReturnType<typeof getRecipeCard>>
) {
  const stats: { icon: AppIconName; label: string; value: string }[] = []

  if (recipeCard.time.prep_time_minutes) {
    stats.push({
      icon: 'clock',
      label: 'Prep time',
      value: `${recipeCard.time.prep_time_minutes} min`,
    })
  }

  if (recipeCard.time.cook_time_minutes) {
    stats.push({
      icon: 'flame',
      label: 'Cook time',
      value: `${recipeCard.time.cook_time_minutes} min`,
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

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes === 0) {
    return `${seconds}s`
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
