import { RecipePlatform } from '@/features/recipe-draft/types'
import { RecipeLibraryItem, getRecipeLibrary } from '@/lib/api/recipes'
import { useAuth } from '@/providers/auth-provider'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, spacing, typography } from '@/theme'
import { Button } from '@/ui/button'
import { EmptyState } from '@/ui/empty-state'
import { ErrorState } from '@/ui/error-state'
import { FilterChip } from '@/ui/filter-chip'
import { Input } from '@/ui/input'
import { LoadingState } from '@/ui/loading-state'
import { VisualRecipeCard } from '@/ui/visual-recipe-card'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type StatusFilter = 'all' | 'recipe_cards' | 'saved_links'
type PlatformFilter =
  | 'all'
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'facebook'
  | 'other'
type SortMode = 'newest' | 'oldest'

const statusFilters: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'AI Cards', value: 'recipe_cards' },
  { label: 'Saved Links', value: 'saved_links' },
]

const platformFilters: { label: string; value: PlatformFilter }[] = [
  { label: 'Instagram', value: 'instagram' },
  { label: 'TikTok', value: 'tiktok' },
  { label: 'YouTube', value: 'youtube' },
  { label: 'Facebook', value: 'facebook' },
  { label: 'Other', value: 'other' },
]

const sortModes: { label: string; value: SortMode }[] = [
  { label: 'Newest', value: 'newest' },
  { label: 'Oldest', value: 'oldest' },
]

export default function LibraryRoute() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { track } = usePostHog()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const didTrackView = useRef(false)
  const didTrackSearch = useRef(false)
  const libraryQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ['recipe-library', user?.id],
    queryFn: () => getRecipeLibrary(),
  })
  const libraryItems = libraryQuery.data ?? []
  const filteredItems = useMemo(
    () =>
      getFilteredLibraryItems({
        items: libraryItems,
        query: searchQuery,
        statusFilter,
        platformFilter,
        sortMode,
      }),
    [libraryItems, platformFilter, searchQuery, sortMode, statusFilter]
  )
  const hasQuery = searchQuery.trim().length > 0

  useEffect(() => {
    if (didTrackView.current || !libraryQuery.data) {
      return
    }

    didTrackView.current = true
    track('library_viewed', {
      result_count: libraryQuery.data.length,
      filter_status: statusFilter,
      filter_platform: platformFilter,
      has_query: false,
    })
  }, [libraryQuery.data, platformFilter, statusFilter, track])

  useEffect(() => {
    if (!hasQuery || didTrackSearch.current) {
      return
    }

    didTrackSearch.current = true
    track('library_search_used', {
      result_count: filteredItems.length,
      filter_status: statusFilter,
      filter_platform: platformFilter,
      has_query: true,
    })
  }, [filteredItems.length, hasQuery, platformFilter, statusFilter, track])

  const trackFilterChange = ({
    nextStatusFilter = statusFilter,
    nextPlatformFilter = platformFilter,
  }: {
    nextStatusFilter?: StatusFilter
    nextPlatformFilter?: PlatformFilter
  }) => {
    track('library_filter_changed', {
      result_count: filteredItems.length,
      filter_status: nextStatusFilter,
      filter_platform: nextPlatformFilter,
      has_query: hasQuery,
    })
  }

  const openLibraryItem = (item: RecipeLibraryItem) => {
    track('library_item_opened', {
      opened_item_type: item.latest_card ? 'recipe_card' : 'saved_link',
    })

    if (item.latest_card) {
      router.push(`/recipe-card/${item.latest_card.id}`)
      return
    }

    router.push(`/recipe/${item.id}`)
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={libraryQuery.error ? [] : filteredItems}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: colors.background }}
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={{
          flexGrow: 1,
          gap: spacing.md,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.lg,
          paddingBottom: 124 + insets.bottom,
        }}
        refreshControl={
          <RefreshControl
            refreshing={libraryQuery.isRefetching}
            onRefresh={() => {
              void libraryQuery.refetch()
            }}
          />
        }
        ListHeaderComponent={
          <LibraryHeader
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            platformFilter={platformFilter}
            sortMode={sortMode}
            resultCount={filteredItems.length}
            onSearchChange={setSearchQuery}
            onStatusFilterChange={(nextStatusFilter) => {
              setStatusFilter(nextStatusFilter)
              trackFilterChange({ nextStatusFilter })
            }}
            onPlatformFilterChange={(nextPlatformFilter) => {
              setPlatformFilter(nextPlatformFilter)
              trackFilterChange({ nextPlatformFilter })
            }}
            onSortModeChange={(nextSortMode) => {
              setSortMode(nextSortMode)
              trackFilterChange({})
            }}
            onSaveRecipe={() => router.push('/save-recipe')}
          />
        }
        ListEmptyComponent={
          <LibraryEmptyState
            isLoading={libraryQuery.isLoading}
            error={libraryQuery.error}
            hasItems={libraryItems.length > 0}
            onRetry={() => {
              void libraryQuery.refetch()
            }}
            onSaveRecipe={() => router.push('/save-recipe')}
          />
        }
        renderItem={({ item }) => (
          <View style={{ width: '47.8%' }}>
            <VisualRecipeCard
              title={
                item.latest_card?.recipe_title?.trim() ||
                item.title?.trim() ||
                'Untitled recipe'
              }
              subtitle={getLibrarySubtitle(item)}
              platform={getRecipePlatform(item.platform)}
              status={item.latest_card ? 'ai_card' : getSavedLinkStatus(item)}
              thumbnailUrl={item.thumbnail_url}
              sourceUrl={item.source_url}
              hasGroceryList={Boolean(item.latest_card)}
              hasNotes={hasNotes(item)}
              confidence={item.latest_card?.confidence}
              createdAt={item.created_at}
              onPress={() => openLibraryItem(item)}
            />
          </View>
        )}
      />
    </View>
  )
}

function LibraryHeader({
  searchQuery,
  statusFilter,
  platformFilter,
  sortMode,
  resultCount,
  onSearchChange,
  onStatusFilterChange,
  onPlatformFilterChange,
  onSortModeChange,
  onSaveRecipe,
}: {
  searchQuery: string
  statusFilter: StatusFilter
  platformFilter: PlatformFilter
  sortMode: SortMode
  resultCount: number
  onSearchChange: (value: string) => void
  onStatusFilterChange: (value: StatusFilter) => void
  onPlatformFilterChange: (value: PlatformFilter) => void
  onSortModeChange: (value: SortMode) => void
  onSaveRecipe: () => void
}) {
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text selectable style={[typography.title, { color: colors.text }]}>
            Library
          </Text>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Saved recipe links and AI cards
          </Text>
        </View>
        <Button label="Save" variant="accent" onPress={onSaveRecipe} />
      </View>

      <Input
        label="Search"
        value={searchQuery}
        placeholder="Search recipes, ingredients, notes"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onChangeText={onSearchChange}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm }}
      >
        {statusFilters.map((filter) => (
          <FilterChip
            key={filter.value}
            label={filter.label}
            selected={statusFilter === filter.value}
            onPress={() => onStatusFilterChange(filter.value)}
          />
        ))}
        {platformFilters.map((filter) => (
          <FilterChip
            key={filter.value}
            label={filter.label}
            selected={platformFilter === filter.value}
            onPress={() => onPlatformFilterChange(filter.value)}
          />
        ))}
        {sortModes.map((mode) => (
          <FilterChip
            key={mode.value}
            label={mode.label}
            selected={sortMode === mode.value}
            onPress={() => onSortModeChange(mode.value)}
          />
        ))}
      </ScrollView>

      <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
        {resultCount} {resultCount === 1 ? 'recipe' : 'recipes'}
      </Text>
    </View>
  )
}

function LibraryEmptyState({
  isLoading,
  error,
  hasItems,
  onRetry,
  onSaveRecipe,
}: {
  isLoading: boolean
  error: Error | null
  hasItems: boolean
  onRetry: () => void
  onSaveRecipe: () => void
}) {
  if (isLoading) {
    return <LoadingState message="Loading library..." />
  }

  if (error) {
    return (
      <ErrorState
        title="Could not load library"
        message={error.message}
        retryLabel="Retry"
        onRetry={onRetry}
      />
    )
  }

  if (hasItems) {
    return (
      <EmptyState
        title="No matching recipes"
        message="Try another chip or search term."
      />
    )
  }

  return (
    <EmptyState
      title="Your recipe library is waiting"
      message="Save your first recipe Reel, TikTok, Short, or food video link."
      actionLabel="Save Recipe"
      onActionPress={onSaveRecipe}
    />
  )
}

function getFilteredLibraryItems({
  items,
  query,
  statusFilter,
  platformFilter,
  sortMode,
}: {
  items: RecipeLibraryItem[]
  query: string
  statusFilter: StatusFilter
  platformFilter: PlatformFilter
  sortMode: SortMode
}) {
  const normalizedQuery = query.trim().toLowerCase()

  return [...items]
    .filter((item) => {
      if (statusFilter === 'recipe_cards' && !item.latest_card) {
        return false
      }

      if (statusFilter === 'saved_links' && item.latest_card) {
        return false
      }

      if (
        platformFilter !== 'all' &&
        getRecipePlatform(item.platform) !== platformFilter
      ) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      return [
        item.title,
        item.latest_card?.recipe_title,
        item.latest_card?.short_summary,
        item.user_note,
        item.pasted_caption,
        item.manual_ingredients,
        item.cuisine,
        item.meal_type,
        item.platform,
      ].some((value) => value?.toLowerCase().includes(normalizedQuery))
    })
    .sort((firstItem, secondItem) => {
      const firstTime = new Date(firstItem.created_at).getTime()
      const secondTime = new Date(secondItem.created_at).getTime()

      return sortMode === 'newest'
        ? secondTime - firstTime
        : firstTime - secondTime
    })
}

function getLibrarySubtitle(item: RecipeLibraryItem) {
  const platform = getRecipePlatform(item.platform)
  const source = getPlatformLabel(platform)

  return item.latest_card ? `${source} · AI ready` : `${source} · saved link`
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

function getSavedLinkStatus(recipe: RecipeLibraryItem) {
  return recipe.metadata_status === 'failed' ? 'failed' : 'saved_link'
}

function hasNotes(recipe: RecipeLibraryItem) {
  return Boolean(
    recipe.user_note?.trim() ||
      recipe.pasted_caption?.trim() ||
      recipe.manual_ingredients?.trim()
  )
}
