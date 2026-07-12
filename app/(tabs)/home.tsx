import {
  EditorialHeader,
  EditorialScreen,
  EmptySectionCard,
  OutlinePillButton,
  SectionHeading,
} from '@/features/home/editorial-layout'
import {
  getRecipeCreatorLabel,
  getRecipeDisplayTitle,
} from '@/features/home/recipe-display-metadata'
import { EditorialRecipeCard } from '@/features/home/editorial-recipe-card'
import {
  getMediaJobProcessingStage,
  getMetadataProcessingStage,
} from '@/features/media-jobs/processing-stage'
import { useSaveRecipeModal } from '@/features/save-recipe/save-recipe-modal'
import { getAiAccessState } from '@/lib/api/ai-access'
import { getFriendlyApiErrorMessage } from '@/lib/api/errors'
import {
  RecipeLibraryItem,
  getRecipeLibrary,
  isMediaJobActive,
  shouldRefreshRecipeLibraryItem,
} from '@/lib/api/recipes'
import { useRefetchOnAppForeground } from '@/lib/query/use-refetch-on-app-foreground'
import { getRecipeCardThumbnail } from '@/lib/recipe-thumbnails'
import { useAuth } from '@/providers/auth-provider'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, radius, spacing, typography } from '@/theme'
import { ErrorState } from '@/ui/error-state'
import { LoadingState } from '@/ui/loading-state'
import { useQuery } from '@tanstack/react-query'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo } from 'react'
import { Text, View } from 'react-native'

export default function HomeRoute() {
  const router = useRouter()
  const { user } = useAuth()
  const { track } = usePostHog()
  const { openSaveRecipeModal } = useSaveRecipeModal()
  const libraryQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ['recipe-library', user?.id],
    queryFn: () => getRecipeLibrary(),
    refetchInterval: (query) =>
      query.state.data?.some((recipe) => shouldRefreshRecipeLibraryItem(recipe))
        ? 5000
        : false,
  })
  const aiAccessQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ['ai-access-state', 'home'],
    queryFn: getAiAccessState,
  })
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
    () => Promise.all([libraryQuery.refetch(), aiAccessQuery.refetch()]),
    [aiAccessQuery.refetch, libraryQuery.refetch]
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
    router.push('/library')
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
    router.push('/paywall')
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

  const usageLabel = getUsageLabel(aiAccessQuery.data)

  return (
    <EditorialScreen>
      <EditorialHeader
        usageLabel={usageLabel}
        isUsageLoading={aiAccessQuery.isLoading && !aiAccessQuery.data}
        onUsagePress={openPaywall}
      />

      {libraryQuery.isLoading && !libraryQuery.data ? (
        <LoadingState message="Loading your recipes..." />
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
          <HomeSection title="Recent">
            {recentRecipe ? (
              <>
                <EditorialRecipeCard
                  title={getRecipeDisplayTitle(recentRecipe)}
                  thumbnailUrl={getRecipeCardThumbnail(recentRecipe)}
                  badge={getRecentBadge(recentRecipe)}
                  creatorLabel={getRecipeCreatorLabel(recentRecipe)}
                  metadata={getRecentMetadata(recentRecipe)}
                  isProcessing={isRecipeProcessing(recentRecipe)}
                  onPress={() => openRecipe(recentRecipe, 'recent')}
                />
                <OutlinePillButton
                  label="View Library"
                  onPress={() => openLibrary('recent')}
                />
              </>
            ) : (
              <EmptySectionCard
                title="Save a recipe reel to see it here"
                message="Your latest saved links and AI recipes will appear here."
                actionLabel="Add Recipe"
                onActionPress={() => openSaveRecipe('recent_empty')}
              />
            )}
          </HomeSection>

          {favoriteRecipe ? (
            <HomeSection title="Favorites">
              <EditorialRecipeCard
                title={getRecipeDisplayTitle(favoriteRecipe)}
                thumbnailUrl={getRecipeCardThumbnail(favoriteRecipe)}
                badge="♡ Favorite"
                creatorLabel={getRecipeCreatorLabel(favoriteRecipe)}
                metadata={getFavoriteMetadata(favoriteRecipe)}
                onPress={() => openRecipe(favoriteRecipe, 'favorites')}
              />
            </HomeSection>
          ) : null}

          {latestAiRecipe || !hasAiRecipes ? (
            <HomeSection title="AI Generated">
              {latestAiRecipe ? (
                <>
                  <EditorialRecipeCard
                    title={getRecipeDisplayTitle(latestAiRecipe)}
                    thumbnailUrl={getRecipeCardThumbnail(latestAiRecipe)}
                    badge="✦ AI Recipe"
                    creatorLabel={getRecipeCreatorLabel(latestAiRecipe)}
                    metadata={getAiMetadata(latestAiRecipe)}
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

function getFavoriteMetadata(recipe: RecipeLibraryItem) {
  return [getPlatformLabel(recipe.platform), formatDate(getLatestActivityAt(recipe))]
}

function getAiMetadata(recipe: RecipeLibraryItem) {
  const context = recipe.meal_type?.trim() || getPlatformLabel(recipe.platform)
  const createdAt = recipe.latest_card?.created_at ?? recipe.created_at

  return ['AI Generated', context, formatDate(createdAt)]
}

function getRecentBadge(recipe: RecipeLibraryItem) {
  if (hasAiRecipe(recipe)) {
    return '✦ AI Recipe'
  }

  if (isRecipeProcessing(recipe)) {
    return `⧖ ${getProcessingLabel(recipe)}`
  }

  return getPlatformLabel(recipe.platform)
}

function getRecentMetadata(recipe: RecipeLibraryItem) {
  let status = 'Saved Link'

  if (hasAiRecipe(recipe)) {
    status = 'AI Recipe'
  } else if (isRecipeProcessing(recipe)) {
    status = getProcessingLabel(recipe)
  } else if (recipe.metadata_status === 'failed') {
    status = 'Preview unavailable'
  }

  return [
    getPlatformLabel(recipe.platform),
    status,
    formatDate(getLatestActivityAt(recipe)),
  ]
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

function getUsageLabel(access: Awaited<ReturnType<typeof getAiAccessState>> | undefined) {
  if (!access) {
    return null
  }

  const remaining =
    access.plan === 'premium' || access.premiumActive
      ? access.premiumMonthlyRemainingToStart
      : access.freeRemainingToStart

  return `${Math.max(0, remaining)} left`
}
