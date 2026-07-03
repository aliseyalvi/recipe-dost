import { RecipePlatform } from '@/features/recipe-draft/types'
import {
  RecipeLibraryItem,
  getRecipeLibrary,
  isMediaJobActive,
  isMediaJobAttentionRequired,
} from '@/lib/api/recipes'
import { getFriendlyApiErrorMessage } from '@/lib/api/errors'
import { getRecipeCardThumbnail } from '@/lib/recipe-thumbnails'
import { useAuth } from '@/providers/auth-provider'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { useSaveRecipeModal } from '@/features/save-recipe/save-recipe-modal'
import { colors, spacing, typography } from '@/theme'
import { EmptyState } from '@/ui/empty-state'
import { ErrorState } from '@/ui/error-state'
import { FilterChip } from '@/ui/filter-chip'
import { LoadingState } from '@/ui/loading-state'
import { Screen } from '@/ui/screen'
import { SectionHeader } from '@/ui/section-header'
import {
  VisualRecipeCard,
  VisualRecipeStatus,
} from '@/ui/visual-recipe-card'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

type HomeFilter =
  | 'ai_cards'
  | 'saved_links'
  | 'grocery'
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'facebook'
  | 'other'
type HomeChip = HomeFilter | 'all'

const homeChips: { label: string; value: HomeChip }[] = [
  { label: 'All', value: 'all' },
  { label: 'AI Cards', value: 'ai_cards' },
  { label: 'Saved Links', value: 'saved_links' },
  { label: 'Grocery', value: 'grocery' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'TikTok', value: 'tiktok' },
  { label: 'YouTube', value: 'youtube' },
  { label: 'Facebook', value: 'facebook' },
  { label: 'Other', value: 'other' },
]

export default function HomeRoute() {
  const router = useRouter()
  const { user } = useAuth()
  const { track } = usePostHog()
  const { openSaveRecipeModal } = useSaveRecipeModal()
  const [selectedFilters, setSelectedFilters] = useState<HomeFilter[]>([])
  const recentRecipesQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ['recent-recipes', user?.id],
    queryFn: () => getRecipeLibrary({ limit: 6 }),
    refetchInterval: (query) =>
      query.state.data?.some((recipe) =>
          isMediaJobActive(recipe.latest_media_job)
        )
        ? 5000
        : false,
  })
  const filteredRecipes = useMemo(
    () => filterHomeRecipes(recentRecipesQuery.data ?? [], selectedFilters),
    [recentRecipesQuery.data, selectedFilters]
  )

  useEffect(() => {
    track('home_viewed')
  }, [track])

  const openSaveRecipe = () => {
    track('home_primary_cta_clicked')
    openSaveRecipeModal()
  }

  const openRecipe = (recipe: RecipeLibraryItem) => {
    track('recent_recipe_clicked', {
      platform: recipe.platform,
      metadata_status: recipe.metadata_status,
    })
    track('saved_recipe_card_opened', {
      opened_item_type:
        recipe.latest_card || recipe.latest_media_job?.result_recipe_card_id
          ? 'recipe_card'
          : 'saved_link',
      platform: recipe.platform ?? 'other',
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

  const toggleFilter = (chip: HomeChip) => {
    const nextFilters =
      chip === 'all'
        ? []
        : selectedFilters.includes(chip)
          ? selectedFilters.filter((filter) => filter !== chip)
          : [...selectedFilters, chip]

    setSelectedFilters(nextFilters)
    track('home_filter_changed', {
      selected_count: nextFilters.length,
      selected_filters: nextFilters.join(','),
    })
  }

  return (
    <Screen compact tabBarPadding>
      <View style={{ gap: spacing.xs }}>
        <Text selectable style={[typography.title, { color: colors.text }]}>
          Recipe Dost
        </Text>
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          Save food reels. Cook them later.
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm }}
      >
        {homeChips.map((chip) => (
          <FilterChip
            key={chip.value}
            label={chip.label}
            selected={
              chip.value === 'all'
                ? selectedFilters.length === 0
                : selectedFilters.includes(chip.value)
            }
            onPress={() => toggleFilter(chip.value)}
          />
        ))}
      </ScrollView>

      <View style={{ gap: spacing.md }}>
        <SectionHeader title="Recent" subtitle="Saved links and AI recipes." />
        {recentRecipesQuery.isLoading && !recentRecipesQuery.data ? (
          <LoadingState message="Loading recent recipes..." />
        ) : null}
        {recentRecipesQuery.error ? (
          <ErrorState
            title="Could not load recent recipes"
            message={getFriendlyApiErrorMessage(
              recentRecipesQuery.error,
              recentRecipesQuery.error.message
            )}
            retryLabel="Retry"
            onRetry={() => {
              void recentRecipesQuery.refetch()
            }}
          />
        ) : null}
        {recentRecipesQuery.data?.length === 0 ? (
          <EmptyState
            title="Your recipe library is waiting"
            message="Save a Reel, TikTok, Short, or recipe video link."
            actionLabel="Save Recipe"
            onActionPress={openSaveRecipe}
          />
        ) : null}
        {recentRecipesQuery.data && filteredRecipes.length === 0 ? (
          <EmptyState
            title="No recipes in this filter"
            message="Try All or save a new recipe link."
            actionLabel="Save Recipe"
            onActionPress={openSaveRecipe}
          />
        ) : null}
        {filteredRecipes.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            {filteredRecipes.map((recipe) => (
              <View key={recipe.id} style={{ width: '47.8%' }}>
                <VisualRecipeCard
                  title={getHomeRecipeTitle(recipe)}
                  subtitle={getHomeRecipeSubtitle(recipe)}
                  platform={getRecipePlatform(recipe.platform)}
                  status={getRecipeVisualStatus(recipe)}
                  thumbnailUrl={getRecipeCardThumbnail(recipe)}
                  sourceUrl={recipe.source_url}
                  hasGroceryList={hasAiRecipe(recipe)}
                  progress={recipe.latest_media_job?.progress}
                  createdAt={recipe.created_at}
                  onPress={() => openRecipe(recipe)}
                />
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
        We save links and recipe cards, not videos.
      </Text>
    </Screen>
  )
}

function filterHomeRecipes(items: RecipeLibraryItem[], selectedFilters: HomeFilter[]) {
  if (selectedFilters.length === 0) {
    return items
  }

  return items.filter((item) => {
    const itemPlatform = getRecipePlatform(item.platform)

    return selectedFilters.some((filter) => {
      switch (filter) {
        case 'ai_cards':
          return hasAiRecipe(item)
        case 'saved_links':
          return !hasAiRecipe(item)
        case 'grocery':
          return hasAiRecipe(item)
        case 'instagram':
        case 'tiktok':
        case 'youtube':
        case 'facebook':
        case 'other':
          return itemPlatform === filter
      }
    })
  })
}

function hasAiRecipe(recipe: RecipeLibraryItem) {
  return Boolean(
    recipe.latest_card || recipe.latest_media_job?.result_recipe_card_id
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

function getSavedLinkStatus(recipe: RecipeLibraryItem) {
  if (recipe.metadata_status === 'saving') {
    return 'saving'
  }

  if (recipe.metadata_status === 'pending') {
    return 'fetching_details'
  }

  return 'saved_link'
}

function getRecipeVisualStatus(
  recipe: RecipeLibraryItem
): VisualRecipeStatus {
  if (
    recipe.latest_card ||
    recipe.latest_media_job?.result_recipe_card_id
  ) {
    return 'ai_card'
  }

  if (isMediaJobActive(recipe.latest_media_job)) {
    return 'processing'
  }

  if (isMediaJobAttentionRequired(recipe.latest_media_job)) {
    return 'ai_failed'
  }

  return getSavedLinkStatus(recipe)
}

function getHomeRecipeSubtitle(recipe: RecipeLibraryItem) {
  if (recipe.latest_card) {
    return recipe.latest_card.short_summary?.trim() || 'AI Recipe'
  }

  if (recipe.latest_media_job?.result_recipe_card_id) {
    return 'AI Recipe'
  }

  if (isMediaJobActive(recipe.latest_media_job)) {
    return `Analyzing${typeof recipe.latest_media_job?.progress === 'number' ? ` · ${recipe.latest_media_job.progress}%` : ''}`
  }

  if (recipe.latest_media_job?.status === 'needs_caption') {
    return 'Caption needed'
  }

  if (recipe.latest_media_job?.status === 'failed') {
    return 'AI failed'
  }

  if (recipe.metadata_status === 'saving') {
    return getPlatformLabel(getRecipePlatform(recipe.platform))
  }

  if (recipe.metadata_status === 'pending') {
    return getPlatformLabel(getRecipePlatform(recipe.platform))
  }

  if (recipe.metadata_status === 'failed') {
    return 'Details unavailable'
  }

  return getPlatformLabel(getRecipePlatform(recipe.platform))
}

function getHomeRecipeTitle(recipe: RecipeLibraryItem) {
  if (recipe.latest_card?.recipe_title?.trim()) {
    return recipe.latest_card.recipe_title.trim()
  }

  if (recipe.latest_media_job?.source_metadata.title?.trim()) {
    return recipe.latest_media_job.source_metadata.title.trim()
  }

  if (recipe.metadata_status === 'saving') {
    return 'Saving recipe link...'
  }

  if (recipe.metadata_status === 'pending') {
    return 'Fetching details...'
  }

  if (recipe.metadata_status === 'failed') {
    return `${getPlatformLabel(getRecipePlatform(recipe.platform))} recipe link`
  }

  return recipe.title?.trim() || 'Saved recipe link'
}

function getPlatformLabel(platform: RecipePlatform) {
  switch (platform) {
    case 'instagram':
      return 'Instagram'
    case 'tiktok':
      return 'TikTok'
    case 'youtube':
      return 'YouTube'
    case 'facebook':
      return 'Facebook'
    case 'other':
      return 'Link'
  }
}
