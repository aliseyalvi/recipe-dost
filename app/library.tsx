import { MetadataStatusBadge } from '@/features/home/metadata-status-badge'
import { getPlatformLabel } from '@/features/recipe-draft/platform'
import { PlatformBadge } from '@/features/recipe-draft/platform-badge'
import { RecipePlatform } from '@/features/recipe-draft/types'
import {
  RecipeLibraryItem,
  getRecipeLibrary,
} from '@/lib/api/recipes'
import { useAuth } from '@/providers/auth-provider'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, radius, spacing, typography } from '@/theme'
import { Button } from '@/ui/button'
import { EmptyState } from '@/ui/empty-state'
import { ErrorState } from '@/ui/error-state'
import { Input } from '@/ui/input'
import { LoadingState } from '@/ui/loading-state'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native'

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
  { label: 'Recipe Cards', value: 'recipe_cards' },
  { label: 'Saved Links', value: 'saved_links' },
]

const platformFilters: { label: string; value: PlatformFilter }[] = [
  { label: 'All Platforms', value: 'all' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'TikTok', value: 'tiktok' },
  { label: 'YouTube', value: 'youtube' },
  { label: 'Facebook', value: 'facebook' },
  { label: 'Other', value: 'other' },
]

const sortModes: { label: string; value: SortMode }[] = [
  { label: 'Newest first', value: 'newest' },
  { label: 'Oldest first', value: 'oldest' },
]

export default function LibraryRoute() {
  const router = useRouter()
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
    const openedItemType = item.latest_card ? 'recipe_card' : 'saved_link'

    track('library_item_opened', {
      opened_item_type: openedItemType,
    })

    if (item.latest_card) {
      router.push(`/recipe-card/${item.latest_card.id}`)
      return
    }

    router.push(`/recipe/${item.id}`)
  }

  return (
    <FlatList
      data={libraryQuery.error ? [] : filteredItems}
      keyExtractor={(item) => item.id}
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        flexGrow: 1,
        gap: spacing.lg,
        padding: spacing.xl,
        paddingBottom: spacing.xxl,
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
        <LibraryItemCard item={item} onPress={() => openLibraryItem(item)} />
      )}
    />
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
}) {
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.sm }}>
        <Text selectable style={[typography.title, { color: colors.text }]}>
          Library
        </Text>
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          Browse saved links and generated recipe cards.
        </Text>
      </View>

      <Input
        label="Search"
        value={searchQuery}
        placeholder="Search recipes, ingredients, or notes"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onChangeText={onSearchChange}
      />

      <FilterGroup title="Status">
        {statusFilters.map((filter) => (
          <FilterChip
            key={filter.value}
            label={filter.label}
            selected={statusFilter === filter.value}
            onPress={() => onStatusFilterChange(filter.value)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Platform">
        {platformFilters.map((filter) => (
          <FilterChip
            key={filter.value}
            label={filter.label}
            selected={platformFilter === filter.value}
            onPress={() => onPlatformFilterChange(filter.value)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Sort">
        {sortModes.map((mode) => (
          <FilterChip
            key={mode.value}
            label={mode.label}
            selected={sortMode === mode.value}
            onPress={() => onSortModeChange(mode.value)}
          />
        ))}
      </FilterGroup>

      <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
        {resultCount} {resultCount === 1 ? 'recipe' : 'recipes'}
      </Text>
    </View>
  )
}

function FilterGroup({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
        {title}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {children}
      </View>
    </View>
  )
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
        borderRadius: radius.pill,
        backgroundColor: selected ? colors.primary : colors.surface,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        opacity: pressed ? 0.84 : 1,
      })}
    >
      <Text
        selectable
        style={[
          typography.caption,
          { color: selected ? colors.primaryText : colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
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
        message="Try a different keyword or clear filters."
      />
    )
  }

  return (
    <EmptyState
      title="No recipes saved yet"
      message="Save your first recipe Reel, TikTok, Short, or food video link."
      actionLabel="Save Recipe Link"
      onActionPress={onSaveRecipe}
    />
  )
}

function LibraryItemCard({
  item,
  onPress,
}: {
  item: RecipeLibraryItem
  onPress: () => void
}) {
  const platform = getRecipePlatform(item.platform)
  const hasRecipeCard = Boolean(item.latest_card)
  const title =
    item.latest_card?.recipe_title?.trim() ||
    item.title?.trim() ||
    'Untitled recipe link'
  const hasNotes = Boolean(
    item.user_note?.trim() ||
      item.pasted_caption?.trim() ||
      item.manual_ingredients?.trim()
  )

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        gap: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        backgroundColor: colors.surface,
        padding: spacing.md,
        opacity: pressed ? 0.86 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        {item.thumbnail_url ? (
          <Image
            source={{ uri: item.thumbnail_url }}
            style={{
              width: 76,
              height: 76,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceMuted,
            }}
          />
        ) : (
          <View
            style={{
              width: 76,
              height: 76,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.md,
              borderCurve: 'continuous',
              backgroundColor: colors.surfaceMuted,
            }}
          >
            <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
              Link
            </Text>
          </View>
        )}

        <View style={{ flex: 1, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <PlatformBadge platform={platform} />
            <StatusBadge label={hasRecipeCard ? 'Recipe Card' : 'Saved Link'} />
          </View>
          <Text
            selectable
            numberOfLines={2}
            style={[typography.body, { color: colors.text, fontWeight: '700' }]}
          >
            {title}
          </Text>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            {getPlatformLabel(platform)} ·{' '}
            {hasRecipeCard ? 'Recipe Card' : 'Saved Link'} ·{' '}
            {formatDate(item.created_at)}
          </Text>
        </View>
      </View>

      {item.latest_card?.short_summary ? (
        <Text
          selectable
          numberOfLines={3}
          style={[typography.body, { color: colors.textMuted }]}
        >
          {item.latest_card.short_summary}
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {item.metadata_status ? (
          <MetadataStatusBadge status={item.metadata_status} />
        ) : null}
        {hasNotes ? <StatusBadge label="Has notes" /> : null}
        {item.cuisine ? <StatusBadge label={titleCase(item.cuisine)} /> : null}
        {item.meal_type ? <StatusBadge label={titleCase(item.meal_type)} /> : null}
      </View>
    </Pressable>
  )
}

function StatusBadge({ label }: { label: string }) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceMuted,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
      }}
    >
      <Text selectable style={[typography.caption, { color: colors.primary }]}>
        {label}
      </Text>
    </View>
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

      return getSearchableText(item).includes(normalizedQuery)
    })
    .sort((left, right) => {
      const leftTime = new Date(left.created_at).getTime()
      const rightTime = new Date(right.created_at).getTime()
      const normalizedLeftTime = Number.isNaN(leftTime) ? 0 : leftTime
      const normalizedRightTime = Number.isNaN(rightTime) ? 0 : rightTime

      return sortMode === 'newest'
        ? normalizedRightTime - normalizedLeftTime
        : normalizedLeftTime - normalizedRightTime
    })
}

function getSearchableText(item: RecipeLibraryItem) {
  return [
    item.latest_card?.recipe_title,
    item.title,
    item.user_note,
    item.pasted_caption,
    item.manual_ingredients,
    item.platform,
    item.cuisine,
    item.meal_type,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
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

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
