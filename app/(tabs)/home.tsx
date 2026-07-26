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
import { getPaywallHref } from '@/features/paywall/paywall-model'
import { useSaveRecipeModal } from '@/features/save-recipe/save-recipe-modal'
import { useAiAccessQuery } from '@/lib/query/ai-access-query'
import { getAiAccessQuotaPresentation } from '@/features/ai-access/ai-access-state'
import { getFriendlyApiErrorMessage } from '@/lib/api/errors'
import {
  RecipeLibraryItem,
  getRecipeLibrary,
  isMediaJobActive,
  shouldRefreshRecipeLibraryItem,
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
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Text, View } from 'react-native'

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
  const libraryQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ['recipe-library', user?.id],
    queryFn: () => getRecipeLibrary(),
    refetchInterval: (query) =>
      query.state.data?.some((recipe) => shouldRefreshRecipeLibraryItem(recipe))
        ? 5000
        : false,
  })
  const aiAccessQuery = useAiAccessQuery(user?.id)
  const items = libraryQuery.data ?? []
  const recentRecipe = useMemo(
    () => getMostRecentlyActiveRecipe(items),
    [items]
  )
  const favoriteRecipe = useMemo(
    () =>
      getMostRecentlyActiveRecipe(
        items.filter(
          (item) => item.is_favorite && item.id !== recentRecipe?.id
        )
      ),
    [items, recentRecipe?.id]
  )
  const hasAiRecipes = useMemo(() => items.some(hasAiRecipe), [items])
  const latestAiRecipe = useMemo(
    () => getLatestAiRecipe(items.filter((item) => item.id !== recentRecipe?.id)),
    [items, recentRecipe?.id]
  )
  const hasLibraryItems = items.length > 0

  useEffect(() => {
    track('home_viewed', {
      layout: 'editorial',
    })
  }, [track])

  const refetchHome = useCallback(
    () => libraryQuery.refetch(),
    [libraryQuery.refetch]
  )

  useFocusEffect(
    useCallback(() => {
      if (user?.id && !libraryQuery.isLoading) {
        void refetchHome()
      }
    }, [libraryQuery.isLoading, refetchHome, user?.id])
  )

  useRefetchOnAppForeground({
    enabled: Boolean(user?.id),
    refetch: refetchHome,
  })

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

      {libraryQuery.isLoading && !libraryQuery.data ? (
        <HomeLoadingState />
      ) : null}

      {libraryQuery.error && !hasLibraryItems ? (
        <ErrorState
          title="Could not load Home"
          message={getFriendlyApiErrorMessage(
            libraryQuery.error,
            'Could not load your recipes. Please try again.'
          )}
          retryLabel="Retry"
          onRetry={() => {
            void refetchHome()
          }}
        />
      ) : null}

      {libraryQuery.error && hasLibraryItems ? (
        <BackgroundRefreshNotice
          message={getFriendlyApiErrorMessage(
            libraryQuery.error,
            'Could not refresh Home. Showing your last loaded recipes.'
          )}
        />
      ) : null}

      {!libraryQuery.isLoading && (libraryQuery.data || libraryQuery.error) ? (
        <>
          {favoriteActionError ? (
            <BackgroundRefreshNotice message={favoriteActionError} />
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
                  durationLabel={getSourceDurationLabel(recentRecipe)}
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
                  durationLabel={getSourceDurationLabel(favoriteRecipe)}
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
                    durationLabel={getSourceDurationLabel(latestAiRecipe)}
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

function BackgroundRefreshNotice({ message }: { message: string }) {
  return (
    <View
      style={{
        borderRadius: radius.md,
        backgroundColor: colors.surfaceContainerLow,
        padding: spacing.md,
      }}
    >
      <Text selectable style={[typography.caption, { color: colors.onSurfaceVariant }]}>
        {message}
      </Text>
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

function getSourceDurationLabel(recipe: RecipeLibraryItem) {
  if (
    typeof recipe.duration_seconds !== 'number' ||
    !Number.isFinite(recipe.duration_seconds) ||
    recipe.duration_seconds <= 0
  ) {
    return null
  }

  const totalSeconds = Math.round(recipe.duration_seconds)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return minutes > 0
    ? `${minutes}m${seconds > 0 ? ` ${seconds}s` : ''}`
    : `${seconds}s`
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
