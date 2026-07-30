import {
  EditorialHeader,
  EditorialScreen,
  EmptySectionCard,
  OutlinePillButton,
  SectionHeading,
} from '@/features/home/editorial-layout'
import { HomeLoadingState } from '@/features/home/home-loading-state'
import { EmptyRecipeLibraryCard } from '@/features/home/empty-recipe-library-card'
import {
  getRecipeCreatorLabel,
  getRecipeDisplayTitle,
} from '@/features/home/recipe-display-metadata'
import { EditorialRecipeCard } from '@/features/home/editorial-recipe-card'
import {
  getMediaJobProcessingStage,
  getMetadataProcessingStage,
} from '@/features/media-jobs/processing-stage'
import {
  formatRecipeDurationMinutes,
  selectRecipeDisplayDuration,
} from '@/features/media-jobs/duration-policy'
import {
  compareActiveMediaJobs,
  getActiveMediaJobStatusLabel,
  isCanonicalActiveMediaJobStatus,
  selectHomeRecentItems,
} from '@/features/media-jobs/media-job-list-policy'
import { getPaywallHref } from '@/features/paywall/paywall-model'
import { useSaveRecipeModal } from '@/features/save-recipe/save-recipe-modal'
import { useAiAccessQuery } from '@/lib/query/ai-access-query'
import { getAiAccessQuotaPresentation } from '@/features/ai-access/ai-access-state'
import { getFriendlyApiErrorMessage } from '@/lib/api/errors'
import {
  ActiveMediaJob,
  RecipeLibraryItem,
  getActiveMediaJobs,
  getRecipeLibrary,
  isMediaJobActive,
  shouldPollRecipeMetadata,
  toggleFavorite,
} from '@/lib/api/recipes'
import { useRefetchOnAppForeground } from '@/lib/query/use-refetch-on-app-foreground'
import { getRecipeCardThumbnail } from '@/lib/recipe-thumbnails'
import { useAuth } from '@/providers/auth-provider'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, radius, spacing, typography } from '@/theme'
import { ErrorState } from '@/ui/error-state'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, Text, View } from 'react-native'

export default function HomeRoute() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { track } = usePostHog()
  const { openSaveRecipeModal } = useSaveRecipeModal()
  const [favoriteMutationId, setFavoriteMutationId] = useState<string | null>(
    null
  )
  const [favoriteActionError, setFavoriteActionError] = useState<string | null>(
    null
  )
  const recentQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ['recent-recipes', user?.id],
    queryFn: () => getRecipeLibrary(),
    refetchInterval: (query) =>
      query.state.data?.some((recipe) =>
        shouldPollRecipeMetadata({
          status: recipe.metadata_status,
          updatedAt: recipe.updated_at,
        })
      )
        ? 5000
        : false,
  })
  const activeJobsQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ['active-media-jobs', user?.id],
    queryFn: () => getActiveMediaJobs(10),
    refetchInterval: (query) =>
      (query.state.data?.length ?? 0) > 0 ? 5000 : false,
  })
  const aiAccessQuery = useAiAccessQuery(user?.id)
  const items = recentQuery.data ?? []
  const activeJobs = useMemo(
    () => [...(activeJobsQuery.data ?? [])].sort(compareActiveMediaJobs),
    [activeJobsQuery.data]
  )
  const activeRecipeIds = useMemo(
    () =>
      new Set(
        activeJobs
          .map((job) => job.recipe_item_id)
          .filter((id): id is string => Boolean(id))
      ),
    [activeJobs]
  )
  const itemsById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items]
  )
  const recentItems = useMemo(
    () => selectHomeRecentItems(items, activeJobs),
    [activeJobs, items]
  )
  const recentRecipe = useMemo(
    () => recentItems[0] ?? null,
    [recentItems]
  )
  const favoriteRecipe = useMemo(
    () =>
      getMostRecentlyActiveRecipe(
        items.filter(
          (item) =>
            item.is_favorite &&
            item.id !== recentRecipe?.id &&
            !activeRecipeIds.has(item.id)
        )
      ),
    [activeRecipeIds, items, recentRecipe?.id]
  )
  const hasAiRecipes = useMemo(() => items.some(hasAiRecipe), [items])
  const latestAiRecipe = useMemo(
    () =>
      getLatestAiRecipe(
        items.filter(
          (item) =>
            item.id !== recentRecipe?.id && !activeRecipeIds.has(item.id)
        )
      ),
    [activeRecipeIds, items, recentRecipe?.id]
  )
  const hasLibraryItems = items.length > 0
  const hasHomeItems = hasLibraryItems || activeJobs.length > 0
  const previousActiveJobsRef = useRef<ActiveMediaJob[]>([])

  useEffect(() => {
    track('home_viewed', {
      layout: 'editorial',
    })
  }, [track])

  const refetchHome = useCallback(
    () => Promise.all([recentQuery.refetch(), activeJobsQuery.refetch()]),
    [activeJobsQuery.refetch, recentQuery.refetch]
  )

  useFocusEffect(
    useCallback(() => {
      if (user?.id && !recentQuery.isLoading) {
        void refetchHome()
      }
    }, [recentQuery.isLoading, refetchHome, user?.id])
  )

  useRefetchOnAppForeground({
    enabled: Boolean(user?.id),
    refetch: refetchHome,
  })

  useEffect(() => {
    if (!activeJobsQuery.data) {
      return
    }

    const currentIds = new Set(activeJobsQuery.data.map((job) => job.id))
    const terminalJobs = previousActiveJobsRef.current.filter(
      (job) => !currentIds.has(job.id)
    )
    previousActiveJobsRef.current = activeJobsQuery.data

    if (terminalJobs.length === 0) {
      return
    }

    void queryClient.invalidateQueries({ queryKey: ['recent-recipes'] })
    void queryClient.invalidateQueries({ queryKey: ['recipe-library'] })

    for (const job of terminalJobs) {
      if (job.recipe_item_id) {
        void queryClient.invalidateQueries({
          queryKey: ['recipe-item', job.recipe_item_id],
        })
      }
      if (job.result_recipe_card_id) {
        void queryClient.invalidateQueries({
          queryKey: ['recipe-card', job.result_recipe_card_id],
        })
      }
    }
  }, [activeJobsQuery.data, queryClient])

  const openLibrary = (source: 'recent' | 'favorites' | 'ai_recipes') => {
    track('home_section_opened', { section: source, destination: 'library' })
    router.push(`/library?tab=${source}`)
  }

  const openPaywall = () => {
    track('home_usage_pill_tapped', {
      plan:
        aiAccessQuery.data?.plan === 'premium' || aiAccessQuery.data?.premiumActive
          ? 'premium'
          : aiAccessQuery.data
            ? 'free'
            : 'unknown',
    })
    router.push(getPaywallHref('home_usage_pill'))
  }

  const openSaveRecipe = (source: 'recent_empty' | 'ai_generated_empty') => {
    track('home_primary_cta_clicked', { source })
    openSaveRecipeModal()
  }

  const openRecipe = (
    recipe: RecipeLibraryItem,
    section: 'recent' | 'favorites' | 'ai_generated'
  ) => {
    track('home_editorial_card_opened', {
      section,
      platform: recipe.platform ?? 'other',
      item_type: hasAiRecipe(recipe) ? 'recipe_card' : 'saved_link',
    })

    if (recipe.latest_card) {
      router.push(`/recipe-card/${recipe.latest_card.id}?returnTo=/home`)
      return
    }

    if (recipe.latest_media_job?.result_recipe_card_id) {
      router.push(
        `/recipe-card/${recipe.latest_media_job.result_recipe_card_id}?returnTo=/home`
      )
      return
    }

    router.push(`/recipe/${recipe.id}?returnTo=/home`)
  }

  const openActiveJob = (job: ActiveMediaJob) => {
    track('home_editorial_card_opened', {
      section: 'in_progress',
      platform: job.platform ?? 'other',
      item_type: 'media_job',
    })

    if (job.recipe_item_id) {
      router.push(`/recipe/${job.recipe_item_id}?returnTo=/home`)
    }
  }

  const handleToggleFavorite = useCallback(
    async (recipe: RecipeLibraryItem) => {
      if (favoriteMutationId) {
        return
      }

      setFavoriteMutationId(recipe.id)
      setFavoriteActionError(null)

      try {
        const isFavorite = await toggleFavorite(
          recipe.id,
          recipe.is_favorite === true
        )

        queryClient.setQueryData<RecipeLibraryItem[]>(
          ['recipe-library', user?.id],
          (items) =>
            items?.map((item) =>
              item.id === recipe.id
                ? { ...item, is_favorite: isFavorite }
                : item
            )
        )
        void queryClient.invalidateQueries({ queryKey: ['recipe-library'] })
        void queryClient.invalidateQueries({ queryKey: ['recipe-item', recipe.id] })
        void queryClient.invalidateQueries({ queryKey: ['recipe-card'] })
        track('recipe_favorite_toggled', {
          platform: recipe.platform ?? 'other',
          is_favorite: isFavorite,
          source: 'home_card',
        })
      } catch {
        setFavoriteActionError(
          'Could not update this favorite. Please try again.'
        )
        track('recipe_favorite_toggle_failed', {
          platform: recipe.platform ?? 'other',
          source: 'home_card',
        })
      } finally {
        setFavoriteMutationId(null)
      }
    },
    [favoriteMutationId, queryClient, track, user?.id]
  )

  const usage = getAiAccessQuotaPresentation(aiAccessQuery.data, {
    isPending: aiAccessQuery.isPending,
    isFetching: aiAccessQuery.isFetching,
    hasError: aiAccessQuery.isError,
  })

  return (
    <EditorialScreen>
      <EditorialHeader
        usageLabel={usage.label}
        isUsageLoading={usage.isInitialLoading}
        isUsageRefreshing={usage.isRefreshing}
        hasUsageWarning={usage.hasRefreshWarning}
        onUsagePress={openPaywall}
      />

      {recentQuery.isLoading && !recentQuery.data ? (
        <HomeLoadingState />
      ) : null}

      {recentQuery.error && !hasHomeItems ? (
        <ErrorState
          title="Could not load Home"
          message={getFriendlyApiErrorMessage(
            recentQuery.error,
            'Could not load your recipes. Please try again.'
          )}
          retryLabel="Retry"
          onRetry={() => {
            void refetchHome()
          }}
        />
      ) : null}

      {recentQuery.error && hasHomeItems ? (
        <BackgroundRefreshNotice
          message={getFriendlyApiErrorMessage(
            recentQuery.error,
            'Could not refresh Home. Showing your last loaded recipes.'
          )}
        />
      ) : null}

      {activeJobsQuery.error ? (
        <BackgroundRefreshNotice
          message={getFriendlyApiErrorMessage(
            activeJobsQuery.error,
            'Could not refresh active AI recipes.'
          )}
          onRetry={() => {
            void activeJobsQuery.refetch()
          }}
        />
      ) : null}

      {!recentQuery.isLoading && (recentQuery.data || recentQuery.error) ? (
        <>
          {favoriteActionError ? (
            <BackgroundRefreshNotice message={favoriteActionError} />
          ) : null}
          {activeJobs.length > 0 ? (
            <HomeSection title="In progress">
              <InProgressGallery
                jobs={activeJobs}
                itemsById={itemsById}
                favoriteMutationId={favoriteMutationId}
                onFavoritePress={(recipe) => {
                  void handleToggleFavorite(recipe)
                }}
                onPress={openActiveJob}
              />
            </HomeSection>
          ) : null}
          {recentRecipe ? (
            <HomeSection title="Recent">
              <>
                <EditorialRecipeCard
                  title={getRecipeDisplayTitle(recentRecipe)}
                  thumbnailUrl={getRecipeCardThumbnail(recentRecipe)}
                  platform={recentRecipe.platform}
                  platformLabel={getPlatformLabel(recentRecipe.platform)}
                  creatorLabel={getRecipeCreatorLabel(recentRecipe)}
                  durationLabel={getRecipeDurationLabel(recentRecipe)}
                  dateLabel={formatDate(getLatestActivityAt(recentRecipe))}
                  {...getHomeStatusProps(recentRecipe)}
                  isAiRecipe={hasAiRecipe(recentRecipe)}
                  isFavorite={recentRecipe.is_favorite === true}
                  isFavoriteUpdating={favoriteMutationId === recentRecipe.id}
                  isProcessing={isRecipeProcessing(recentRecipe)}
                  onFavoritePress={() => {
                    void handleToggleFavorite(recentRecipe)
                  }}
                  onPress={() => openRecipe(recentRecipe, 'recent')}
                />
                <OutlinePillButton
                  label="View Recent Recipes"
                  onPress={() => openLibrary('recent')}
                />
              </>
            </HomeSection>
          ) : (
            <EmptyRecipeLibraryCard
              onSaveRecipe={() => openSaveRecipe('recent_empty')}
            />
          )}

          {favoriteRecipe ? (
            <HomeSection title="Favorites">
              <>
                <EditorialRecipeCard
                  title={getRecipeDisplayTitle(favoriteRecipe)}
                  thumbnailUrl={getRecipeCardThumbnail(favoriteRecipe)}
                  platform={favoriteRecipe.platform}
                  platformLabel={getPlatformLabel(favoriteRecipe.platform)}
                  creatorLabel={getRecipeCreatorLabel(favoriteRecipe)}
                  durationLabel={getRecipeDurationLabel(favoriteRecipe)}
                  dateLabel={formatDate(getLatestActivityAt(favoriteRecipe))}
                  {...getHomeStatusProps(favoriteRecipe)}
                  isAiRecipe={hasAiRecipe(favoriteRecipe)}
                  isFavorite={favoriteRecipe.is_favorite === true}
                  isFavoriteUpdating={favoriteMutationId === favoriteRecipe.id}
                  onFavoritePress={() => {
                    void handleToggleFavorite(favoriteRecipe)
                  }}
                  onPress={() => openRecipe(favoriteRecipe, 'favorites')}
                />
                <OutlinePillButton
                  label="View Favorite Recipes"
                  onPress={() => openLibrary('favorites')}
                />
              </>
            </HomeSection>
          ) : null}

          {hasLibraryItems && (latestAiRecipe || !hasAiRecipes) ? (
            <HomeSection title="AI Generated">
              {latestAiRecipe ? (
                <>
                  <EditorialRecipeCard
                    title={getRecipeDisplayTitle(latestAiRecipe)}
                    thumbnailUrl={getRecipeCardThumbnail(latestAiRecipe)}
                    platform={latestAiRecipe.platform}
                    platformLabel={getPlatformLabel(latestAiRecipe.platform)}
                    creatorLabel={getRecipeCreatorLabel(latestAiRecipe)}
                    durationLabel={getRecipeDurationLabel(latestAiRecipe)}
                    dateLabel={formatDate(
                      latestAiRecipe.latest_card?.created_at ??
                        latestAiRecipe.created_at
                    )}
                    {...getHomeStatusProps(latestAiRecipe)}
                    isAiRecipe
                    isFavorite={latestAiRecipe.is_favorite === true}
                    isFavoriteUpdating={
                      favoriteMutationId === latestAiRecipe.id
                    }
                    onFavoritePress={() => {
                      void handleToggleFavorite(latestAiRecipe)
                    }}
                    onPress={() => openRecipe(latestAiRecipe, 'ai_generated')}
                  />
                  <OutlinePillButton
                    label="View All AI Recipes"
                    onPress={() => openLibrary('ai_recipes')}
                  />
                </>
              ) : (
                <EmptySectionCard
                  title="Your first AI recipe is waiting"
                  message="Save a recipe link, then create an AI recipe card from its details."
                  actionLabel="Add Recipe"
                  onActionPress={() => openSaveRecipe('ai_generated_empty')}
                />
              )}
            </HomeSection>
          ) : null}

          {!hasLibraryItems ? (
            <Text selectable style={[typography.caption, { color: colors.onSurfaceVariant }]}>
              Recipe Dost saves links and recipe cards, not videos.
            </Text>
          ) : null}
        </>
      ) : null}
    </EditorialScreen>
  )
}

function HomeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.lg }}>
      <SectionHeading title={title} />
      {children}
    </View>
  )
}

function InProgressGallery({
  jobs,
  itemsById,
  favoriteMutationId,
  onFavoritePress,
  onPress,
}: {
  jobs: ActiveMediaJob[]
  itemsById: Map<string, RecipeLibraryItem>
  favoriteMutationId: string | null
  onFavoritePress: (recipe: RecipeLibraryItem) => void
  onPress: (job: ActiveMediaJob) => void
}) {
  return (
    <FlatList
      horizontal
      accessibilityLabel={`${jobs.length} AI recipes in progress`}
      data={jobs}
      keyExtractor={(job) => job.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.md }}
      renderItem={({ item: job }) => {
        if (!isCanonicalActiveMediaJobStatus(job.status)) {
          return null
        }

        const recipe = job.recipe_item_id
          ? itemsById.get(job.recipe_item_id)
          : undefined
        const title =
          recipe
            ? getRecipeDisplayTitle(recipe)
            : job.source_metadata.title?.trim() || 'AI recipe'
        const creator =
          recipe
            ? getRecipeCreatorLabel(recipe)
            : job.source_metadata.author_username?.trim() ?? null

        return (
          <View style={{ width: 286 }}>
            <EditorialRecipeCard
              title={title}
              thumbnailUrl={
                job.thumbnail_url ??
                job.source_metadata.uploaded_thumbnail_url ??
                (recipe ? getRecipeCardThumbnail(recipe) : null)
              }
              platform={job.platform}
              platformLabel={getPlatformLabel(job.platform)}
              creatorLabel={creator}
              durationLabel={recipe ? getRecipeDurationLabel(recipe) : null}
              dateLabel={formatDate(job.created_at)}
              statusLabel={getActiveMediaJobStatusLabel(job.status)}
              statusIcon="hourglass"
              isAiRecipe={false}
              isFavorite={recipe?.is_favorite === true}
              isFavoriteUpdating={favoriteMutationId === recipe?.id}
              isProcessing
              showFavoriteAction={Boolean(recipe)}
              onFavoritePress={() => {
                if (recipe) {
                  onFavoritePress(recipe)
                }
              }}
              onPress={() => onPress(job)}
            />
          </View>
        )
      }}
    />
  )
}

function BackgroundRefreshNotice({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <View
      style={{
        gap: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceContainerLow,
        padding: spacing.md,
      }}
    >
      <Text selectable style={[typography.caption, { color: colors.onSurfaceVariant }]}>
        {message}
      </Text>
      {onRetry ? (
        <OutlinePillButton label="Retry active recipes" onPress={onRetry} />
      ) : null}
    </View>
  )
}

function isRecipeProcessing(recipe: RecipeLibraryItem) {
  return (
    recipe.metadata_status === 'saving' ||
    recipe.metadata_status === 'pending' ||
    isMediaJobActive(recipe.latest_media_job)
  )
}

function hasAiRecipe(recipe: RecipeLibraryItem) {
  return Boolean(recipe.latest_card || recipe.latest_media_job?.result_recipe_card_id)
}

function getMostRecentlyActiveRecipe(items: RecipeLibraryItem[]) {
  return (
    [...items].sort(
      (left, right) => getLatestActivityMs(right) - getLatestActivityMs(left)
    )[0] ?? null
  )
}

function getLatestAiRecipe(items: RecipeLibraryItem[]) {
  return (
    items
      .filter(hasAiRecipe)
      .sort((left, right) => getAiActivityMs(right) - getAiActivityMs(left))[0] ??
    null
  )
}

function getLatestActivityMs(recipe: RecipeLibraryItem) {
  return Math.max(
    getTimestampMs(recipe.created_at),
    getTimestampMs(recipe.updated_at),
    getTimestampMs(recipe.latest_card?.created_at),
    getTimestampMs(recipe.latest_card?.updated_at),
    getTimestampMs(recipe.latest_media_job?.created_at),
    getTimestampMs(recipe.latest_media_job?.updated_at)
  )
}

function getAiActivityMs(recipe: RecipeLibraryItem) {
  return Math.max(
    getTimestampMs(recipe.latest_card?.created_at),
    getTimestampMs(recipe.latest_card?.updated_at),
    getTimestampMs(recipe.latest_media_job?.updated_at),
    getTimestampMs(recipe.created_at)
  )
}

function getLatestActivityAt(recipe: RecipeLibraryItem) {
  const candidates = [
    recipe.updated_at,
    recipe.created_at,
    recipe.latest_card?.updated_at,
    recipe.latest_card?.created_at,
    recipe.latest_media_job?.updated_at,
    recipe.latest_media_job?.created_at,
  ].filter((value): value is string => Boolean(value))

  return candidates.sort(
    (left, right) => getTimestampMs(right) - getTimestampMs(left)
  )[0] ?? recipe.created_at
}

function getTimestampMs(value: string | null | undefined) {
  if (!value) {
    return 0
  }

  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function getProcessingLabel(recipe: RecipeLibraryItem) {
  if (isMediaJobActive(recipe.latest_media_job)) {
    return getMediaJobProcessingStage(recipe.latest_media_job?.status).label
  }

  return getMetadataProcessingStage(recipe.metadata_status).label
}

function getHomeStatusProps(recipe: RecipeLibraryItem) {
  if (isRecipeProcessing(recipe)) {
    return {
      statusLabel: getProcessingLabel(recipe),
      statusIcon: 'hourglass' as const,
    }
  }

  if (recipe.metadata_status === 'failed') {
    return {
      statusLabel: 'Preview unavailable',
      statusIcon: 'warning' as const,
    }
  }

  return {
    statusLabel: hasAiRecipe(recipe) ? null : 'Saved Link',
    statusIcon: 'link' as const,
  }
}

function getRecipeDurationLabel(recipe: RecipeLibraryItem) {
  const duration = selectRecipeDisplayDuration(recipe)

  return duration.recipeDisplayMinutes === null
    ? null
    : formatRecipeDurationMinutes(duration.recipeDisplayMinutes)
}

function getPlatformLabel(platform: string | null) {
  switch (platform) {
    case 'instagram':
      return 'Instagram'
    case 'tiktok':
      return 'TikTok'
    case 'youtube':
      return 'YouTube'
    case 'facebook':
      return 'Facebook'
    default:
      return 'Saved Link'
  }
}

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Saved recently'
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}
