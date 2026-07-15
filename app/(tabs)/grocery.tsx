import {
  RecipeContentLanguage,
  useRecipeContentLanguage,
} from '@/features/language/content-language'
import { hasUrduScript } from '@/features/language/localized-text'
import {
  detectRecipePlatform,
  getPlatformLabel,
} from '@/features/recipe-draft/platform'
import type { RecipePlatform } from '@/features/recipe-draft/types'
import { UsagePill } from '@/features/home/editorial-layout'
import { getPaywallHref } from '@/features/paywall/paywall-model'
import { RecipeMetadataChip } from '@/features/recipe-card/recipe-card-chrome'
import { getAiAccessState } from '@/lib/api/ai-access'
import { getFriendlyApiErrorMessage } from '@/lib/api/errors'
import {
  getRecipeGroceryList,
  getRecipeGroceryLists,
} from '@/lib/api/recipes'
import type { GroceryItem, RecipeGroceryList } from '@/lib/api/recipes'
import { useAuth } from '@/providers/auth-provider'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import {
  borders,
  colors,
  radius,
  shadows,
  spacing,
  typography,
} from '@/theme'
import { EmptyState } from '@/ui/empty-state'
import { ErrorState } from '@/ui/error-state'
import { LoadingState } from '@/ui/loading-state'
import { UrduText } from '@/ui/urdu-text'
import { AppIcon, type AppIconName } from '@/ui/app-icon'
import { useQuery } from '@tanstack/react-query'
import Constants from 'expo-constants'
import * as Clipboard from 'expo-clipboard'
import { useLocalSearchParams, useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  SectionList,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type GroceryFilter = 'all' | 'active' | 'completed' | 'recent'
type GrocerySection = { title: string; data: GroceryItem[] }

const groceryFilters: { label: string; value: GroceryFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Recent', value: 'recent' },
]

export default function GroceryRoute() {
  const { recipeCardId: recipeCardIdParam } = useLocalSearchParams<{
    recipeCardId?: string | string[]
  }>()
  const recipeCardId = Array.isArray(recipeCardIdParam)
    ? recipeCardIdParam[0]
    : recipeCardIdParam

  return recipeCardId ? (
    <GroceryListDetail recipeCardId={recipeCardId} />
  ) : (
    <GroceryOverview />
  )
}

function GroceryOverview() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { language } = useRecipeContentLanguage()
  const { track } = usePostHog()
  const [query, setQuery] = useState('')
  const [selectedFilter, setSelectedFilter] =
    useState<GroceryFilter>('all')
  const [menuList, setMenuList] = useState<RecipeGroceryList | null>(null)
  const [menuError, setMenuError] = useState<string | null>(null)
  const didTrackOverview = useRef(false)
  const groceryListsQuery = useQuery({
    queryKey: ['recipe-grocery-lists'],
    queryFn: getRecipeGroceryLists,
  })
  const aiAccessQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ['ai-access-state', 'grocery'],
    queryFn: getAiAccessState,
  })
  const allLists = groceryListsQuery.data ?? []
  const filteredLists = useMemo(
    () => filterGroceryLists(allLists, query, selectedFilter),
    [allLists, query, selectedFilter]
  )
  const usageLabel = getUsageLabel(aiAccessQuery.data)
  const hasData = allLists.length > 0
  const topInset = insets.top || Constants.statusBarHeight || 0

  useEffect(() => {
    if (didTrackOverview.current) {
      return
    }

    didTrackOverview.current = true
    track('grocery_overview_viewed', { layout: 'editorial' })
  }, [track])

  const openList = (item: RecipeGroceryList, source: 'card' | 'menu') => {
    setMenuList(null)
    setMenuError(null)
    track('grocery_overview_card_opened', {
      source,
      item_count: item.grocery_items.length,
      platform: getGroceryPlatform(item),
    })
    router.push(`/grocery?recipeCardId=${item.id}&returnTo=/grocery`)
  }

  const openRecipe = (item: RecipeGroceryList) => {
    setMenuList(null)
    setMenuError(null)
    track('grocery_recipe_opened', { source: 'overview_menu' })
    router.push(`/recipe-card/${item.id}?returnTo=/grocery`)
  }

  const copyList = async (item: RecipeGroceryList) => {
    try {
      await Clipboard.setStringAsync(
        formatGroceryListText(getRecipeTitle(item), item.grocery_items, language)
      )
      track('grocery_list_copied', {
        ...getGroceryAnalyticsProperties(item.grocery_items, item.recipe_title),
        source: 'overview_menu',
      })
      setMenuList(null)
      setMenuError(null)
    } catch {
      setMenuError('Could not copy this shopping list. Please try again.')
      track('grocery_list_copy_failed', { source: 'overview_menu' })
    }
  }

  const shareList = async (item: RecipeGroceryList) => {
    try {
      const result = await Share.share({
        message: formatGroceryListText(
          getRecipeTitle(item),
          item.grocery_items,
          language
        ),
      })
      track('grocery_list_shared', {
        ...getGroceryAnalyticsProperties(item.grocery_items, item.recipe_title),
        source: 'overview_menu',
        completed: result.action === Share.sharedAction,
      })
      setMenuList(null)
      setMenuError(null)
    } catch {
      setMenuError('Could not open sharing. Please try again.')
      track('grocery_list_share_failed', { source: 'overview_menu' })
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        data={filteredLists}
        keyExtractor={(item) => item.id}
        refreshing={groceryListsQuery.isRefetching && !groceryListsQuery.isLoading}
        onRefresh={() => {
          void Promise.all([
            groceryListsQuery.refetch(),
            aiAccessQuery.refetch(),
          ])
        }}
        contentContainerStyle={{
          flexGrow: 1,
          gap: spacing.cardGap,
          paddingHorizontal: spacing.mobileMargin,
          paddingTop: topInset + spacing.lg,
          paddingBottom: 136 + insets.bottom,
        }}
        ListHeaderComponent={
          <GroceryOverviewHeader
            query={query}
            selectedFilter={selectedFilter}
            usageLabel={usageLabel}
            isUsageLoading={aiAccessQuery.isLoading}
            backgroundError={
              groceryListsQuery.error && hasData
                ? getFriendlyApiErrorMessage(
                    groceryListsQuery.error,
                    'Could not refresh grocery lists. Pull down to retry.'
                  )
                : null
            }
            resultCount={filteredLists.length}
            onQueryChange={setQuery}
            onQueryClear={() => {
              setQuery('')
              track('grocery_search_cleared')
            }}
            onSearchSubmit={() => {
              track('grocery_search_submitted', {
                has_query: Boolean(query.trim()),
                result_count: filteredLists.length,
              })
            }}
            onFilterChange={(filter) => {
              setSelectedFilter(filter)
              track('grocery_filter_changed', { filter })
            }}
            onUsagePress={() => {
              track('grocery_usage_pill_tapped', {
                plan:
                  aiAccessQuery.data?.plan === 'premium' ||
                  aiAccessQuery.data?.premiumActive
                    ? 'premium'
                    : aiAccessQuery.data
                      ? 'free'
                      : 'unknown',
              })
              router.push(getPaywallHref('grocery_usage_pill'))
            }}
          />
        }
        renderItem={({ item }) => (
          <GroceryListCard
            item={item}
            onPress={() => openList(item, 'card')}
            onMenuPress={() => {
              setMenuError(null)
              setMenuList(item)
              track('grocery_card_menu_opened', {
                item_count: item.grocery_items.length,
              })
            }}
          />
        )}
        ListEmptyComponent={
          <GroceryOverviewEmpty
            isLoading={groceryListsQuery.isLoading}
            error={groceryListsQuery.error}
            hasLists={hasData}
            hasQuery={Boolean(query.trim())}
            selectedFilter={selectedFilter}
            onRetry={() => {
              void groceryListsQuery.refetch()
            }}
            onClear={() => {
              setQuery('')
              setSelectedFilter('all')
            }}
            onOpenLibrary={() => router.push('/library?tab=ai_recipes')}
          />
        }
      />

      <GroceryActionMenu
        item={menuList}
        errorMessage={menuError}
        onClose={() => {
          setMenuList(null)
          setMenuError(null)
        }}
        onOpenList={openList}
        onOpenRecipe={openRecipe}
        onCopy={(item) => {
          void copyList(item)
        }}
        onShare={(item) => {
          void shareList(item)
        }}
      />
    </View>
  )
}

function GroceryOverviewHeader({
  query,
  selectedFilter,
  usageLabel,
  isUsageLoading,
  backgroundError,
  resultCount,
  onQueryChange,
  onQueryClear,
  onSearchSubmit,
  onFilterChange,
  onUsagePress,
}: {
  query: string
  selectedFilter: GroceryFilter
  usageLabel: string | null
  isUsageLoading: boolean
  backgroundError: string | null
  resultCount: number
  onQueryChange: (value: string) => void
  onQueryClear: () => void
  onSearchSubmit: () => void
  onFilterChange: (value: GroceryFilter) => void
  onUsagePress: () => void
}) {
  return (
    <View style={{ gap: spacing.card }}>
      <View
        style={{
          minHeight: 52,
          alignItems: 'center',
          justifyContent: 'center',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255, 255, 255, 0.10)',
          paddingBottom: spacing.md,
          paddingHorizontal: 82,
        }}
      >
        <Text
          selectable
          style={[typography.title, { color: colors.primary, textAlign: 'center' }]}
        >
          Grocery
        </Text>
        <UsagePill
          label={usageLabel}
          isLoading={isUsageLoading}
          onPress={onUsagePress}
        />
      </View>

      <View
        style={{
          minHeight: 56,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.10)',
          backgroundColor: 'rgba(255, 255, 255, 0.07)',
          paddingHorizontal: spacing.lg,
        }}
      >
        <AppIcon name="search" color={colors.onSurfaceVariant} size={21} />
        <TextInput
          accessibilityLabel="Search grocery lists, recipes, and ingredients"
          value={query}
          onChangeText={onQueryChange}
          onSubmitEditing={onSearchSubmit}
          placeholder="Search lists, recipes, ingredients..."
          placeholderTextColor={colors.onSurfaceVariant}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            typography.body,
            {
              minHeight: 54,
              flex: 1,
              color: colors.onSurface,
              paddingVertical: 0,
            },
          ]}
        />
        {query ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear grocery search"
            hitSlop={8}
            onPress={onQueryClear}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.pill,
              opacity: pressed ? 0.62 : 1,
            })}
          >
            <AppIcon name="close" color={colors.primary} size={23} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        horizontal
        data={groceryFilters}
        keyExtractor={(item) => item.value}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm }}
        renderItem={({ item }) => {
          const selected = selectedFilter === item.value

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Show ${item.label.toLowerCase()} grocery lists`}
              onPress={() => onFilterChange(item.value)}
              style={({ pressed }) => ({
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: selected
                  ? colors.primaryContainer
                  : 'rgba(255, 255, 255, 0.12)',
                backgroundColor: selected
                  ? colors.primaryContainer
                  : pressed
                    ? 'rgba(255, 255, 255, 0.18)'
                    : 'rgba(255, 255, 255, 0.09)',
                paddingHorizontal: spacing.lg,
                opacity: pressed ? 0.78 : 1,
              })}
            >
              <Text
                selectable={false}
                style={[
                  typography.caption,
                  {
                    color: selected
                      ? colors.onPrimaryContainer
                      : colors.onSurface,
                    fontWeight: '700',
                  },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          )
        }}
      />

      {query.trim() || selectedFilter !== 'all' ? (
        <View
          style={{
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255, 255, 255, 0.10)',
            paddingBottom: spacing.md,
          }}
        >
          <Text selectable style={[typography.caption, { color: colors.onSurfaceVariant }]}>
            {resultCount} shopping {resultCount === 1 ? 'list' : 'lists'} found
          </Text>
        </View>
      ) : null}

      {backgroundError ? <NonBlockingNetworkNotice message={backgroundError} /> : null}
    </View>
  )
}

function GroceryListCard({
  item,
  onPress,
  onMenuPress,
}: {
  item: RecipeGroceryList
  onPress: () => void
  onMenuPress: () => void
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const title = getRecipeTitle(item)
  const totalCount = item.grocery_items.length
  const checkedCount = getCheckedCount(item.grocery_items)
  const platform = getGroceryPlatform(item)
  const platformLabel = getGroceryPlatformLabel(item)
  const creator = getSafeCreator(item.creator)
  const duration = formatDuration(item.duration_seconds)

  useEffect(() => {
    setImageFailed(false)
  }, [item.thumbnail_url])

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${title} shopping list. ${checkedCount} of ${totalCount} items checked.`}
      onPress={onPress}
      style={({ pressed }) => ({
        height: 326,
        overflow: 'hidden',
        borderRadius: radius.card,
        borderCurve: 'continuous',
        ...borders.subtle,
        backgroundColor: colors.surfaceContainer,
        opacity: pressed ? 0.86 : 1,
      })}
    >
      {item.thumbnail_url && !imageFailed ? (
        <Image
          accessibilityIgnoresInvertColors
          source={{ uri: item.thumbnail_url }}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        <GroceryImagePlaceholder />
      )}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          inset: 0,
          experimental_backgroundImage:
            'linear-gradient(to top, rgba(4, 4, 5, 0.98) 0%, rgba(7, 7, 8, 0.80) 36%, rgba(8, 8, 9, 0.18) 72%, rgba(8, 8, 9, 0.10) 100%)',
        }}
      />

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: spacing.md,
          left: spacing.md,
          minHeight: 38,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: colors.primaryOutlineSoft,
          backgroundColor: 'rgba(0, 0, 0, 0.56)',
          paddingHorizontal: spacing.md,
        }}
      >
        <AppIcon name="grocery-list" color={colors.primary} size={17} />
        <Text selectable={false} style={[typography.caption, { color: colors.primary }]}>
          Shopping List
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`More options for ${title}`}
        hitSlop={4}
        onPress={(event) => {
          event.stopPropagation()
          onMenuPress()
        }}
        style={({ pressed }) => ({
          position: 'absolute',
          top: spacing.md,
          right: spacing.md,
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.pill,
          backgroundColor: 'rgba(0, 0, 0, 0.52)',
          opacity: pressed ? 0.64 : 1,
        })}
      >
        <AppIcon name="more-vertical" color={colors.onSurface} size={25} />
      </Pressable>

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: spacing.card,
          bottom: spacing.card,
          left: spacing.card,
          gap: spacing.sm,
        }}
      >
        <Text
          selectable
          numberOfLines={2}
          style={[
            typography.heading,
            { color: '#FFFFFF', fontSize: 25, lineHeight: 30 },
          ]}
        >
          {title}
        </Text>
        <Text selectable style={[typography.caption, { color: '#D3CED0' }]}>
          {totalCount} {totalCount === 1 ? 'item' : 'items'} · {checkedCount} checked
        </Text>
        <View
          style={{
            height: 4,
            overflow: 'hidden',
            borderRadius: radius.pill,
            backgroundColor: 'rgba(255, 255, 255, 0.16)',
          }}
        >
          <View
            style={{
              width: `${getProgressPercent(checkedCount, totalCount)}%`,
              height: '100%',
              borderRadius: radius.pill,
              backgroundColor: colors.primary,
            }}
          />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          <RecipeMetadataChip platform={platform} label={platformLabel} />
          {creator ? (
            <RecipeMetadataChip icon="creator" label={creator} accent />
          ) : null}
          {duration ? (
            <RecipeMetadataChip icon="clock" label={duration} />
          ) : null}
          <RecipeMetadataChip
            icon="calendar"
            label={formatDate(item.created_at)}
          />
        </View>
      </View>
    </Pressable>
  )
}

function GroceryOverviewEmpty({
  isLoading,
  error,
  hasLists,
  hasQuery,
  selectedFilter,
  onRetry,
  onClear,
  onOpenLibrary,
}: {
  isLoading: boolean
  error: Error | null
  hasLists: boolean
  hasQuery: boolean
  selectedFilter: GroceryFilter
  onRetry: () => void
  onClear: () => void
  onOpenLibrary: () => void
}) {
  if (isLoading) {
    return <LoadingState message="Loading grocery lists..." />
  }

  if (error && !hasLists) {
    return (
      <ErrorState
        title="Could not load grocery lists"
        message={getFriendlyApiErrorMessage(
          error,
          'Could not load grocery lists. Please try again.'
        )}
        retryLabel="Retry"
        onRetry={onRetry}
      />
    )
  }

  if (hasQuery || selectedFilter !== 'all') {
    return (
      <EmptyState
        title="No shopping lists found"
        message="Try another recipe or ingredient, or clear the current filter."
        actionLabel="Clear search and filters"
        onActionPress={onClear}
      />
    )
  }

  return (
    <EmptyState
      title="No grocery lists yet"
      message="Create a grocery list from an AI recipe to see it here."
      actionLabel="Browse AI Recipes"
      onActionPress={onOpenLibrary}
    />
  )
}

function GroceryListDetail({ recipeCardId }: { recipeCardId: string }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { track } = usePostHog()
  const { language: globalLanguage } = useRecipeContentLanguage()
  const [screenLanguage, setScreenLanguage] =
    useState<RecipeContentLanguage | null>(null)
  const [checkedItemIds, setCheckedItemIds] = useState<Set<string>>(
    () => new Set()
  )
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const viewedCardIdRef = useRef<string | null>(null)
  const groceryListQuery = useQuery({
    queryKey: ['recipe-grocery-list', recipeCardId],
    queryFn: () => getRecipeGroceryList(recipeCardId),
  })
  const recipeGroceryList = groceryListQuery.data
  const groceryItems = useMemo(
    () =>
      (recipeGroceryList?.grocery_items ?? []).map((item) => ({
        ...item,
        checked: checkedItemIds.has(item.id),
      })),
    [checkedItemIds, recipeGroceryList?.grocery_items]
  )
  const hasUrdu = groceryItems.some((item) => hasUrduScript(item.label_ur))
  const requestedLanguage = screenLanguage ?? globalLanguage
  const contentLanguage = hasUrdu ? requestedLanguage : 'english'
  const sections = useMemo(() => groupGroceryItems(groceryItems), [groceryItems])
  const checkedCount = getCheckedCount(groceryItems)
  const recipeTitle = getRecipeTitle(recipeGroceryList)
  const topInset = insets.top || Constants.statusBarHeight || 0

  useEffect(() => {
    setCheckedItemIds(new Set())
    setActionMessage(null)
  }, [recipeGroceryList?.id])

  useEffect(() => {
    if (
      !recipeGroceryList ||
      viewedCardIdRef.current === recipeGroceryList.id
    ) {
      return
    }

    viewedCardIdRef.current = recipeGroceryList.id
    track(
      'grocery_list_viewed',
      getGroceryAnalyticsProperties(
        recipeGroceryList.grocery_items,
        recipeGroceryList.recipe_title
      )
    )
  }, [recipeGroceryList, track])

  const backToGrocery = () => {
    track('grocery_detail_back_tapped')
    router.replace('/grocery')
  }

  if (groceryListQuery.isLoading) {
    return (
      <GroceryDetailStateScaffold onBack={backToGrocery} topInset={topInset}>
        <LoadingState message="Loading shopping list..." />
      </GroceryDetailStateScaffold>
    )
  }

  if (groceryListQuery.error && !recipeGroceryList) {
    return (
      <GroceryDetailStateScaffold onBack={backToGrocery} topInset={topInset}>
        <ErrorState
          title="Could not load shopping list"
          message={getFriendlyApiErrorMessage(
            groceryListQuery.error,
            'Could not load this shopping list.'
          )}
          retryLabel="Retry"
          onRetry={() => {
            void groceryListQuery.refetch()
          }}
          secondaryActionLabel="Back to Grocery"
          onSecondaryAction={backToGrocery}
        />
      </GroceryDetailStateScaffold>
    )
  }

  if (!recipeGroceryList) {
    return (
      <GroceryDetailStateScaffold onBack={backToGrocery} topInset={topInset}>
        <EmptyState
          title="Shopping list not found"
          message="Open a grocery list from the Grocery tab and try again."
          actionLabel="Back to Grocery"
          onActionPress={backToGrocery}
        />
      </GroceryDetailStateScaffold>
    )
  }

  const toggleItem = (item: GroceryItem) => {
    const nextCheckedItemIds = new Set(checkedItemIds)

    if (nextCheckedItemIds.has(item.id)) {
      nextCheckedItemIds.delete(item.id)
    } else {
      nextCheckedItemIds.add(item.id)
    }

    setCheckedItemIds(nextCheckedItemIds)
    setActionMessage(null)
    track('grocery_item_checked', {
      ...getGroceryAnalyticsProperties(groceryItems, recipeGroceryList.recipe_title),
      checked_count: nextCheckedItemIds.size,
      is_checked: nextCheckedItemIds.has(item.id),
    })
  }

  const uncheckAll = () => {
    setCheckedItemIds(new Set())
    setActionMessage(null)
    track('grocery_list_unchecked_all', {
      ...getGroceryAnalyticsProperties(groceryItems, recipeGroceryList.recipe_title),
      checked_count: 0,
    })
  }

  const copyList = async () => {
    try {
      await Clipboard.setStringAsync(
        formatGroceryListText(recipeTitle, groceryItems, contentLanguage)
      )
      setActionMessage('Shopping list copied.')
      track('grocery_list_copied', {
        ...getGroceryAnalyticsProperties(groceryItems, recipeGroceryList.recipe_title),
        source: 'list_detail',
      })
    } catch {
      setActionMessage('Could not copy this shopping list. Please try again.')
      track('grocery_list_copy_failed', { source: 'list_detail' })
    }
  }

  const shareList = async () => {
    try {
      const result = await Share.share({
        message: formatGroceryListText(
          recipeTitle,
          groceryItems,
          contentLanguage
        ),
      })
      setActionMessage(
        result.action === Share.sharedAction
          ? 'Shopping list shared.'
          : 'Sharing closed.'
      )
      track('grocery_list_shared', {
        ...getGroceryAnalyticsProperties(groceryItems, recipeGroceryList.recipe_title),
        source: 'list_detail',
        completed: result.action === Share.sharedAction,
      })
    } catch {
      setActionMessage('Could not open sharing. Please try again.')
      track('grocery_list_share_failed', { source: 'list_detail' })
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SectionList
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: spacing.mobileMargin,
          paddingTop: topInset + spacing.lg,
          paddingBottom: 224 + insets.bottom,
        }}
        ListHeaderComponent={
          <View style={{ gap: spacing.sectionGap, paddingBottom: spacing.lg }}>
            <GroceryDetailTopBar onBack={backToGrocery} />
            <View style={{ alignItems: 'center', gap: spacing.xs }}>
              <Text
                selectable
                style={[
                  typography.heading,
                  { color: colors.onSurface, textAlign: 'center' },
                ]}
              >
                {recipeTitle}
              </Text>
              <Text
                selectable
                style={[typography.body, { color: colors.onSurfaceVariant }]}
              >
                Shopping List
              </Text>
            </View>
            <GroceryLanguageToggle
              value={contentLanguage}
              hasUrdu={hasUrdu}
              onChange={(value) => {
                setScreenLanguage(value)
                track('grocery_language_changed', {
                  language: value,
                  has_urdu: hasUrdu,
                })
              }}
            />
            {groceryItems.length > 0 ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: spacing.md,
                  borderRadius: radius.md,
                  ...borders.subtle,
                  backgroundColor: colors.surfaceContainerLow,
                  padding: spacing.md,
                }}
              >
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text
                    selectable
                    style={[typography.caption, { color: colors.onSurface }]}
                  >
                    {checkedCount} of {groceryItems.length} checked
                  </Text>
                  <View
                    style={{
                      height: 4,
                      overflow: 'hidden',
                      borderRadius: radius.pill,
                      backgroundColor: colors.surfaceContainerHighest,
                    }}
                  >
                    <View
                      style={{
                        width: `${getProgressPercent(
                          checkedCount,
                          groceryItems.length
                        )}%`,
                        height: '100%',
                        borderRadius: radius.pill,
                        backgroundColor: colors.primary,
                      }}
                    />
                  </View>
                </View>
                {checkedCount > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Uncheck all grocery items"
                    onPress={uncheckAll}
                    style={({ pressed }) => ({
                      minHeight: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: radius.pill,
                      backgroundColor: colors.glassElevated,
                      paddingHorizontal: spacing.md,
                      opacity: pressed ? 0.68 : 1,
                    })}
                  >
                    <Text
                      selectable={false}
                      style={[typography.caption, { color: colors.primary }]}
                    >
                      Uncheck all
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text
            selectable
            style={[
              typography.label,
              {
                color: colors.tertiary,
                paddingTop: spacing.lg,
                paddingBottom: spacing.md,
                paddingHorizontal: spacing.md,
              },
            ]}
          >
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <GroceryChecklistItem
            item={item}
            language={contentLanguage}
            onPress={toggleItem}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        SectionSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          <EmptyState
            title="No grocery items here yet"
            message="This recipe does not have ingredients to turn into a shopping list."
            actionLabel="Back to Recipe"
            onActionPress={() =>
              router.push(`/recipe-card/${recipeGroceryList.id}?returnTo=/grocery`)
            }
          />
        }
        ListFooterComponent={
          actionMessage ? (
            <Text
              accessibilityLiveRegion="polite"
              selectable
              style={[
                typography.caption,
                {
                  color: colors.onSurfaceVariant,
                  textAlign: 'center',
                  paddingTop: spacing.xl,
                },
              ]}
            >
              {actionMessage}
            </Text>
          ) : null
        }
      />

      {groceryItems.length > 0 ? (
        <GroceryListActions
          bottomInset={insets.bottom}
          onCopy={() => {
            void copyList()
          }}
          onShare={() => {
            void shareList()
          }}
        />
      ) : null}
    </View>
  )
}

function GroceryDetailStateScaffold({
  onBack,
  topInset,
  children,
}: {
  onBack: () => void
  topInset: number
  children: ReactNode
}) {
  return (
    <View
      style={{
        flex: 1,
        gap: spacing.xl,
        backgroundColor: colors.background,
        paddingHorizontal: spacing.mobileMargin,
        paddingTop: topInset + spacing.lg,
      }}
    >
      <GroceryDetailTopBar onBack={onBack} />
      {children}
    </View>
  )
}

function GroceryDetailTopBar({ onBack }: { onBack: () => void }) {
  return (
    <View
      style={{
        minHeight: 52,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
        paddingBottom: spacing.sm,
        paddingHorizontal: 64,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to Grocery"
        hitSlop={8}
        onPress={onBack}
        style={({ pressed }) => ({
          position: 'absolute',
          left: 0,
          top: 0,
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.pill,
          backgroundColor: pressed ? colors.surfaceContainerHigh : 'transparent',
          opacity: pressed ? 0.72 : 1,
        })}
      >
        <AppIcon name="back" color={colors.primary} size={22} />
      </Pressable>
      <Text
        selectable
        numberOfLines={1}
        style={[typography.title, { color: colors.primary, textAlign: 'center' }]}
      >
        Recipe Dost
      </Text>
    </View>
  )
}

function GroceryLanguageToggle({
  value,
  hasUrdu,
  onChange,
}: {
  value: RecipeContentLanguage
  hasUrdu: boolean
  onChange: (value: RecipeContentLanguage) => void
}) {
  const options: { label: string; value: RecipeContentLanguage }[] = [
    { label: 'English', value: 'english' },
    { label: 'Urdu', value: 'urdu' },
    { label: 'Both', value: 'both' },
  ]

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        gap: spacing.xs,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.10)',
        backgroundColor: colors.surfaceContainerLow,
        padding: spacing.xs,
      }}
    >
      {options.map((option) => {
        const disabled = option.value !== 'english' && !hasUrdu
        const selected = value === option.value

        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={
              disabled
                ? `${option.label} is unavailable for this shopping list`
                : `Show shopping list in ${option.label}`
            }
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => ({
              minHeight: 44,
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.pill,
              backgroundColor: selected
                ? colors.surfaceContainerHighest
                : 'transparent',
              opacity: disabled ? 0.34 : pressed ? 0.68 : 1,
              paddingHorizontal: spacing.sm,
            })}
          >
            <Text
              selectable={false}
              style={[
                typography.label,
                {
                  color: selected ? colors.onSurface : colors.onSurfaceVariant,
                  textAlign: 'center',
                },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function GroceryChecklistItem({
  item,
  language,
  onPress,
}: {
  item: GroceryItem
  language: RecipeContentLanguage
  onPress: (item: GroceryItem) => void
}) {
  const text = getGroceryItemText(item, language)

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.checked }}
      accessibilityLabel={`${text.primary}${
        item.quantity ? `, ${item.quantity}` : ''
      }`}
      onPress={() => onPress(item)}
      style={({ pressed }) => ({
        minHeight: 88,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: item.checked
          ? colors.primaryOutlineSoft
          : 'rgba(255, 255, 255, 0.12)',
        backgroundColor: item.checked
          ? colors.primaryWash
          : colors.surfaceContainerLow,
        padding: spacing.lg,
        opacity: pressed ? 0.76 : item.checked ? 0.70 : 1,
      })}
    >
      <View
        style={{
          width: 26,
          height: 26,
          flexShrink: 0,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          borderWidth: 2,
          borderColor: item.checked ? colors.primary : colors.outline,
          backgroundColor: item.checked ? colors.primaryContainer : 'transparent',
        }}
      >
        {item.checked ? (
          <AppIcon name="check" color={colors.onPrimaryContainer} size={17} />
        ) : null}
      </View>

      <View style={{ minWidth: 0, flex: 1, gap: spacing.xs }}>
        {language === 'urdu' && hasUrduScript(text.primary) ? (
          <UrduText
            muted={item.checked}
            style={{
              textDecorationLine: item.checked ? 'line-through' : 'none',
            }}
          >
            {text.primary}
          </UrduText>
        ) : (
          <Text
            selectable
            style={[
              typography.body,
              {
                color: item.checked ? colors.textMuted : colors.onSurface,
                fontWeight: '700',
                textDecorationLine: item.checked ? 'line-through' : 'none',
              },
            ]}
          >
            {text.primary}
          </Text>
        )}
        {text.secondary ? (
          <UrduText
            muted={item.checked}
            style={{
              textDecorationLine: item.checked ? 'line-through' : 'none',
            }}
          >
            {text.secondary}
          </UrduText>
        ) : null}
        {text.note ? (
          <Text
            selectable
            numberOfLines={2}
            style={[
              typography.caption,
              { color: colors.onSurfaceVariant, opacity: item.checked ? 0.66 : 1 },
            ]}
          >
            {text.note}
          </Text>
        ) : null}
      </View>

      {item.quantity ? (
        <View
          style={{
            minHeight: 36,
            flexShrink: 0,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: colors.primaryOutlineSoft,
            backgroundColor: colors.surfaceContainerLowest,
            paddingHorizontal: spacing.md,
          }}
        >
          <Text
            selectable
            numberOfLines={1}
            style={[
              typography.caption,
              {
                color: item.checked ? colors.textMuted : colors.onSurface,
                fontVariant: ['tabular-nums'],
                textDecorationLine: item.checked ? 'line-through' : 'none',
              },
            ]}
          >
            {item.quantity}
          </Text>
        </View>
      ) : null}
    </Pressable>
  )
}

function GroceryListActions({
  bottomInset,
  onCopy,
  onShare,
}: {
  bottomInset: number
  onCopy: () => void
  onShare: () => void
}) {
  return (
    <View
      style={{
        position: 'absolute',
        right: spacing.mobileMargin,
        bottom: 96 + bottomInset,
        left: spacing.mobileMargin,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Copy shopping list"
        onPress={onCopy}
        style={({ pressed }) => ({
          minHeight: 54,
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: colors.primaryOutlineSoft,
          ...shadows.floating,
          backgroundColor: colors.primaryContainer,
          opacity: pressed ? 0.76 : 1,
        })}
      >
        <AppIcon name="copy" color={colors.onPrimaryContainer} size={19} />
        <Text selectable={false} style={[typography.label, { color: '#FFFFFF' }]}>
          Copy List
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Share shopping list"
        onPress={onShare}
        style={({ pressed }) => ({
          width: 54,
          height: 54,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.pill,
          ...borders.subtle,
          ...shadows.floating,
          backgroundColor: colors.surfaceContainerHighest,
          opacity: pressed ? 0.72 : 1,
        })}
      >
        <AppIcon name="share" color={colors.primary} size={22} />
      </Pressable>
    </View>
  )
}

function GroceryActionMenu({
  item,
  errorMessage,
  onClose,
  onOpenList,
  onOpenRecipe,
  onCopy,
  onShare,
}: {
  item: RecipeGroceryList | null
  errorMessage: string | null
  onClose: () => void
  onOpenList: (item: RecipeGroceryList, source: 'card' | 'menu') => void
  onOpenRecipe: (item: RecipeGroceryList) => void
  onCopy: (item: RecipeGroceryList) => void
  onShare: (item: RecipeGroceryList) => void
}) {
  const insets = useSafeAreaInsets()

  if (!item) {
    return null
  }

  return (
    <Modal
      animationType="fade"
      transparent
      statusBarTranslucent
      visible
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close shopping list options"
        onPress={onClose}
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0, 0, 0, 0.72)',
        }}
      >
        <Pressable
          accessibilityRole="none"
          onPress={(event) => event.stopPropagation()}
          style={{
            gap: spacing.lg,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.primaryOutlineSoft,
            backgroundColor: colors.surfaceContainerLow,
            paddingHorizontal: spacing.card,
            paddingTop: spacing.card,
            paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.md,
          }}
        >
          <View
            style={{
              width: 44,
              height: 4,
              alignSelf: 'center',
              borderRadius: radius.pill,
              backgroundColor: colors.outlineVariant,
              opacity: 0.72,
            }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
            <View style={{ minWidth: 0, flex: 1, gap: spacing.xs }}>
              <Text selectable style={[typography.heading, { color: colors.onSurface }]}>
                Shopping list options
              </Text>
              <Text
                selectable
                numberOfLines={1}
                style={[typography.caption, { color: colors.onSurfaceVariant }]}
              >
                {getRecipeTitle(item)} · {getGroceryPlatformLabel(item)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close shopping list options"
              onPress={onClose}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.pill,
                backgroundColor: colors.glassElevated,
                opacity: pressed ? 0.68 : 1,
              })}
            >
              <AppIcon name="close" color={colors.onSurface} size={25} />
            </Pressable>
          </View>

          {errorMessage ? (
            <View
              style={{
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.error,
                backgroundColor: colors.dangerSurface,
                padding: spacing.md,
              }}
            >
              <Text selectable style={[typography.caption, { color: colors.error }]}>
                {errorMessage}
              </Text>
            </View>
          ) : null}

          <View style={{ gap: spacing.sm }}>
            <GroceryMenuRow
              icon="grocery-list"
              label="Open shopping list"
              onPress={() => onOpenList(item, 'menu')}
            />
            <GroceryMenuRow
              icon="recipe"
              label="Open recipe"
              onPress={() => onOpenRecipe(item)}
            />
            <GroceryMenuRow
              icon="copy"
              label="Copy list"
              onPress={() => onCopy(item)}
            />
            <GroceryMenuRow
              icon="share"
              label="Share list"
              onPress={() => onShare(item)}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function GroceryMenuRow({
  icon,
  label,
  onPress,
}: {
  icon: AppIconName
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.10)',
        backgroundColor: pressed
          ? colors.surfaceContainerHigh
          : colors.glassElevated,
        paddingHorizontal: spacing.lg,
        opacity: pressed ? 0.66 : 1,
      })}
    >
      <View
        style={{
          width: 34,
          height: 34,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.pill,
          backgroundColor: colors.primaryWash,
        }}
      >
        <AppIcon name={icon} color={colors.primary} size={19} />
      </View>
      <Text selectable={false} style={[typography.body, { color: colors.onSurface, fontWeight: '700' }]}>
        {label}
      </Text>
    </Pressable>
  )
}

function GroceryImagePlaceholder() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
        backgroundColor: colors.surfaceContainerHigh,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: colors.primaryOutlineSoft,
          backgroundColor: colors.primaryWash,
        }}
      >
        <AppIcon name="grocery-list" color={colors.primary} size={34} />
      </View>
      <Text selectable={false} style={[typography.caption, { color: colors.onSurfaceVariant }]}>
        Recipe Dost Grocery
      </Text>
    </View>
  )
}

function NonBlockingNetworkNotice({ message }: { message: string }) {
  return (
    <View
      style={{
        borderRadius: radius.md,
        ...borders.subtle,
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

function filterGroceryLists(
  items: RecipeGroceryList[],
  query: string,
  filter: GroceryFilter
) {
  const normalizedQuery = query.trim().toLocaleLowerCase()

  return [...items]
    .filter((item) => {
      const total = item.grocery_items.length
      const checked = getCheckedCount(item.grocery_items)

      if (filter === 'active' && (total === 0 || checked >= total)) {
        return false
      }
      if (filter === 'completed' && (total === 0 || checked !== total)) {
        return false
      }

      return (
        !normalizedQuery ||
        getGrocerySearchValues(item).some((value) =>
          value.toLocaleLowerCase().includes(normalizedQuery)
        )
      )
    })
    .sort((left, right) => {
      if (filter !== 'recent') {
        return 0
      }

      return getDateMs(right.created_at) - getDateMs(left.created_at)
    })
}

function getGrocerySearchValues(item: RecipeGroceryList) {
  const platform = getGroceryPlatformLabel(item)
  const creator = getSafeCreator(item.creator)
  const sourceTitle = isSafeVisibleTitle(item.source_title)
    ? item.source_title?.trim()
    : null

  return [
    getRecipeTitle(item),
    sourceTitle,
    platform,
    creator,
    ...item.grocery_items.flatMap((groceryItem) => [
      groceryItem.label,
      groceryItem.label_en,
      groceryItem.label_ur,
      groceryItem.quantity,
      groceryItem.notes,
      groceryItem.notes_en,
      groceryItem.notes_ur,
      groceryItem.category,
    ]),
  ].filter((value): value is string => Boolean(value?.trim()))
}

function groupGroceryItems(items: GroceryItem[]) {
  const groups = new Map<string, GroceryItem[]>()

  for (const item of items) {
    const category = item.category?.trim() || 'Ingredients'
    const current = groups.get(category) ?? []
    current.push(item)
    groups.set(category, current)
  }

  return Array.from(groups, ([title, data]): GrocerySection => ({ title, data }))
}

function getGroceryItemText(
  item: GroceryItem,
  language: RecipeContentLanguage
) {
  const english = item.label_en?.trim() || item.label.trim()
  const urdu = hasUrduScript(item.label_ur) ? item.label_ur?.trim() : null
  const notesEnglish =
    item.notes_en?.trim() ||
    (item.notes && !hasUrduScript(item.notes) ? item.notes.trim() : null)
  const notesUrdu = hasUrduScript(item.notes_ur)
    ? item.notes_ur?.trim()
    : hasUrduScript(item.notes)
      ? item.notes?.trim()
      : null

  if (language === 'urdu') {
    return {
      primary: urdu ?? english,
      secondary: null,
      note: notesUrdu ?? notesEnglish,
    }
  }

  if (language === 'both') {
    return {
      primary: english,
      secondary: urdu,
      note:
        notesEnglish && notesUrdu
          ? `${notesEnglish} · ${notesUrdu}`
          : notesEnglish ?? notesUrdu,
    }
  }

  return { primary: english, secondary: null, note: notesEnglish }
}

function formatGroceryListText(
  recipeTitle: string,
  items: GroceryItem[],
  language: RecipeContentLanguage
) {
  const sections = groupGroceryItems(items)

  return [
    recipeTitle,
    'Shopping List',
    '',
    ...sections.flatMap((section, sectionIndex) => [
      ...(sectionIndex > 0 ? [''] : []),
      section.title,
      ...section.data.flatMap((item) => {
        const text = getGroceryItemText(item, language)
        const primary = `- ${item.quantity ? `${item.quantity} ` : ''}${text.primary}`

        return text.secondary ? [primary, `  ${text.secondary}`] : [primary]
      }),
    ]),
  ].join('\n')
}

function getRecipeTitle(item: RecipeGroceryList | undefined) {
  const recipeTitle = item?.recipe_title?.trim()
  const sourceTitle = item?.source_title?.trim()

  if (recipeTitle && isPreferredVisibleTitle(recipeTitle)) {
    return recipeTitle
  }
  if (sourceTitle && isPreferredVisibleTitle(sourceTitle)) {
    return sourceTitle
  }
  if (recipeTitle && isSafeVisibleTitle(recipeTitle)) {
    return recipeTitle
  }

  return 'Saved recipe shopping list'
}

function isPreferredVisibleTitle(value: string | null | undefined) {
  return Boolean(
    isSafeVisibleTitle(value) && !/^video\s+by\s+/i.test(value?.trim() ?? '')
  )
}

function isSafeVisibleTitle(value: string | null | undefined) {
  const trimmed = value?.trim()

  if (!trimmed || /^https?:\/\//i.test(trimmed) || /^www\./i.test(trimmed)) {
    return false
  }

  return true
}

function getGroceryPlatform(item: RecipeGroceryList): RecipePlatform {
  const stored = item.platform?.trim().toLocaleLowerCase()

  if (
    stored === 'instagram' ||
    stored === 'tiktok' ||
    stored === 'youtube' ||
    stored === 'facebook' ||
    stored === 'other'
  ) {
    return stored
  }

  return detectRecipePlatform(item.source_link ?? '')
}

function getGroceryPlatformLabel(item: RecipeGroceryList) {
  const platform = getGroceryPlatform(item)

  return platform === 'other' ? 'Saved source' : getPlatformLabel(platform)
}

function getSafeCreator(value: string | null | undefined) {
  const trimmed = value?.trim()

  if (
    !trimmed ||
    /^https?:\/\//i.test(trimmed) ||
    /^www\./i.test(trimmed)
  ) {
    return null
  }

  return trimmed.length > 26 ? `${trimmed.slice(0, 25)}…` : trimmed
}

function getCheckedCount(items: GroceryItem[]) {
  return items.filter((item) => item.checked).length
}

function getProgressPercent(checkedCount: number, totalCount: number) {
  if (totalCount <= 0) {
    return 0
  }

  return Math.min(100, Math.max(0, (checkedCount / totalCount) * 100))
}

function getGroceryAnalyticsProperties(
  items: GroceryItem[],
  recipeTitle: string | null | undefined
) {
  return {
    item_count: items.length,
    checked_count: getCheckedCount(items),
    has_recipe_title: Boolean(recipeTitle?.trim()),
    has_urdu: items.some((item) => hasUrduScript(item.label_ur)),
    has_categories: items.some((item) => Boolean(item.category?.trim())),
  }
}

function getUsageLabel(
  access: Awaited<ReturnType<typeof getAiAccessState>> | undefined
) {
  if (!access) {
    return null
  }

  if (access.plan === 'premium' || access.premiumActive) {
    return 'Premium'
  }

  return `${Math.max(0, access.freeRemainingToStart)} left`
}

function formatDuration(value: number | null) {
  if (!value || value <= 0 || !Number.isFinite(value)) {
    return null
  }

  const seconds = Math.round(value)

  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60

  return remainder > 0 ? `${minutes}m ${remainder}s` : `${minutes}m`
}

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Recent'
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function getDateMs(value: string) {
  const date = new Date(value).getTime()

  return Number.isNaN(date) ? 0 : date
}
