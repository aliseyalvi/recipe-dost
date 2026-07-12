import {
  getRecipeCreatorLabel,
  getRecipeDisplayTitle,
} from '@/features/home/recipe-display-metadata'
import { UsagePill } from '@/features/home/editorial-layout'
import { getMediaJobProcessingStage } from '@/features/media-jobs/processing-stage'
import { useSaveRecipeModal } from '@/features/save-recipe/save-recipe-modal'
import { getAiAccessState } from '@/lib/api/ai-access'
import { getFriendlyApiErrorMessage } from '@/lib/api/errors'
import {
  RecipeLibraryItem,
  deleteRecipe,
  getRecipeLibrary,
  isMediaJobActive,
  isMediaJobAttentionRequired,
  shouldRefreshRecipeLibraryItem,
  toggleFavorite,
} from '@/lib/api/recipes'
import { useRefetchOnAppForeground } from '@/lib/query/use-refetch-on-app-foreground'
import { getRecipeCardThumbnail } from '@/lib/recipe-thumbnails'
import { useAuth } from '@/providers/auth-provider'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { borders, colors, radius, spacing, typography } from '@/theme'
import { Button } from '@/ui/button'
import { ErrorState } from '@/ui/error-state'
import { LoadingState } from '@/ui/loading-state'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList,
  Image,
  Keyboard,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type LibraryTab = 'recent' | 'favorites' | 'ai_recipes'

const libraryTabs: { label: string; value: LibraryTab }[] = [
  { label: 'Recent', value: 'recent' },
  { label: 'Favorites', value: 'favorites' },
  { label: 'AI Recipes', value: 'ai_recipes' },
]

const normalSearchChips = [
  'Dinner',
  'Quick',
  'Healthy',
  'Pasta',
  'Chicken',
  'Instagram',
  'TikTok',
  'YouTube',
]

export default function LibraryRoute() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { track } = usePostHog()
  const { openSaveRecipeModal } = useSaveRecipeModal()
  const { query } = useLocalSearchParams<{ query?: string | string[] }>()
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchActive, setIsSearchActive] = useState(false)
  const [selectedTab, setSelectedTab] = useState<LibraryTab>('recent')
  const [menuItem, setMenuItem] = useState<RecipeLibraryItem | null>(null)
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false)
  const [activeMutation, setActiveMutation] = useState<
    { itemId: string; type: 'favorite' | 'delete' } | undefined
  >()
  const [menuError, setMenuError] = useState<string | null>(null)
  const didTrackView = useRef(false)
  const appliedRouteQuery = useRef<string | null>(null)

  const libraryQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ['recipe-library', user?.id],
    queryFn: () => getRecipeLibrary(),
    refetchInterval: (activeQuery) =>
      activeQuery.state.data?.some((item) =>
        shouldRefreshRecipeLibraryItem(item)
      )
        ? 5000
        : false,
  })
  const aiAccessQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ['ai-access-state', 'library'],
    queryFn: getAiAccessState,
  })
  const libraryItems = libraryQuery.data ?? []
  const hasLibraryItems = libraryItems.length > 0
  const normalizedQuery = searchQuery.trim()
  const hasQuery = normalizedQuery.length > 0
  const searchMode = isSearchActive || hasQuery
  const filteredItems = useMemo(
    () =>
      getFilteredLibraryItems({
        items: libraryItems,
        query: searchQuery,
        selectedTab,
      }),
    [libraryItems, searchQuery, selectedTab]
  )
  const searchSuggestions = useMemo(
    () => getSearchSuggestions(libraryItems, normalizedQuery),
    [libraryItems, normalizedQuery]
  )
  const hasBackgroundError = Boolean(libraryQuery.error && hasLibraryItems)

  useEffect(() => {
    const nextQuery = Array.isArray(query) ? query[0] : query
    const nextValue = nextQuery?.trim()

    if (!nextValue || nextValue === appliedRouteQuery.current) {
      return
    }

    appliedRouteQuery.current = nextValue
    setSearchQuery(nextValue)
    setIsSearchActive(true)
  }, [query])

  useEffect(() => {
    if (didTrackView.current || !libraryQuery.data) {
      return
    }

    didTrackView.current = true
    track('library_viewed', {
      layout: 'editorial',
      result_count: libraryQuery.data.length,
    })
  }, [libraryQuery.data, track])

  const refetchLibrary = useCallback(
    () => Promise.all([libraryQuery.refetch(), aiAccessQuery.refetch()]),
    [aiAccessQuery.refetch, libraryQuery.refetch]
  )

  useFocusEffect(
    useCallback(() => {
      if (user?.id && !libraryQuery.isLoading) {
        void refetchLibrary()
      }
    }, [libraryQuery.isLoading, refetchLibrary, user?.id])
  )

  useRefetchOnAppForeground({
    enabled: Boolean(user?.id),
    refetch: refetchLibrary,
  })

  const openLibraryItem = useCallback(
    (item: RecipeLibraryItem) => {
      const itemType = hasAiRecipe(item) ? 'recipe_card' : 'saved_link'
      track('library_item_opened', {
        opened_item_type: itemType,
        platform: item.platform ?? 'other',
      })
      track('saved_recipe_card_opened', {
        opened_item_type: itemType,
        platform: item.platform ?? 'other',
      })

      if (item.latest_card) {
        router.push(`/recipe-card/${item.latest_card.id}?returnTo=/library`)
        return
      }

      if (item.latest_media_job?.result_recipe_card_id) {
        router.push(
          `/recipe-card/${item.latest_media_job.result_recipe_card_id}?returnTo=/library`
        )
        return
      }

      router.push(`/recipe/${item.id}?returnTo=/library`)
    },
    [router, track]
  )

  const clearRouteQuery = useCallback(() => {
    appliedRouteQuery.current = null

    if (query) {
      router.replace('/library')
    }
  }, [query, router])

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    clearRouteQuery()
  }, [clearRouteQuery])

  const cancelSearch = useCallback(() => {
    const hadQuery = searchQuery.trim().length > 0
    clearSearch()
    setIsSearchActive(false)
    Keyboard.dismiss()
    track('library_search_cancelled', { had_query: hadQuery })
  }, [clearSearch, searchQuery, track])

  const applySearchChip = useCallback(
    (value: string, source: 'normal_chip' | 'suggestion_chip') => {
      setSearchQuery(value)
      setIsSearchActive(true)
      clearRouteQuery()
      track('library_filter_changed', {
        filter_type: source,
        selected_tab: selectedTab,
      })
    },
    [clearRouteQuery, selectedTab, track]
  )

  const openPaywall = () => {
    track('library_usage_pill_tapped', {
      plan:
        aiAccessQuery.data?.plan === 'premium' ||
        aiAccessQuery.data?.premiumActive
          ? 'premium'
          : aiAccessQuery.data
            ? 'free'
            : 'unknown',
    })
    router.push('/paywall')
  }

  const invalidateRecipeManagement = useCallback(
    (item: RecipeLibraryItem) => {
      void queryClient.invalidateQueries({ queryKey: ['recent-recipes'] })
      void queryClient.invalidateQueries({ queryKey: ['recipe-library'] })
      void queryClient.invalidateQueries({ queryKey: ['recipe-item', item.id] })
      void queryClient.invalidateQueries({ queryKey: ['recipe-card'] })
      void queryClient.invalidateQueries({ queryKey: ['recipe-grocery-list'] })
      void queryClient.invalidateQueries({ queryKey: ['recipe-grocery-lists'] })
    },
    [queryClient]
  )

  const updateLibraryFavorite = useCallback(
    (itemId: string, isFavorite: boolean) => {
      queryClient.setQueryData<RecipeLibraryItem[]>(
        ['recipe-library', user?.id],
        (items) =>
          items?.map((item) =>
            item.id === itemId ? { ...item, is_favorite: isFavorite } : item
          )
      )
      setMenuItem((item) =>
        item?.id === itemId ? { ...item, is_favorite: isFavorite } : item
      )
    },
    [queryClient, user?.id]
  )

  const handleToggleFavorite = useCallback(
    async (item: RecipeLibraryItem, source: 'card' | 'menu') => {
      if (activeMutation) {
        return
      }

      setActiveMutation({ itemId: item.id, type: 'favorite' })
      setMenuError(null)

      try {
        const isFavorite = await toggleFavorite(
          item.id,
          item.is_favorite === true
        )
        updateLibraryFavorite(item.id, isFavorite)
        invalidateRecipeManagement(item)
        track('recipe_favorite_toggled', {
          platform: item.platform ?? 'other',
          is_favorite: isFavorite,
          source: `library_${source}`,
        })
      } catch {
        setMenuItem(item)
        setMenuError('Could not update this favorite. Please try again.')
        track('recipe_favorite_toggle_failed', {
          platform: item.platform ?? 'other',
          source: `library_${source}`,
        })
      } finally {
        setActiveMutation(undefined)
      }
    },
    [activeMutation, invalidateRecipeManagement, track, updateLibraryFavorite]
  )

  const closeItemMenu = useCallback(() => {
    if (activeMutation?.type === 'delete') {
      return
    }

    setMenuItem(null)
    setIsDeleteConfirming(false)
    setMenuError(null)
  }, [activeMutation?.type])

  const showItemMenu = useCallback(
    (item: RecipeLibraryItem) => {
      setMenuItem(item)
      setIsDeleteConfirming(false)
      setMenuError(null)
      track('library_item_menu_opened', {
        item_type: hasAiRecipe(item) ? 'recipe_card' : 'saved_link',
        platform: item.platform ?? 'other',
      })
    },
    [track]
  )

  const handleDeleteRecipe = useCallback(
    async (item: RecipeLibraryItem) => {
      if (activeMutation) {
        return
      }

      setActiveMutation({ itemId: item.id, type: 'delete' })
      setMenuError(null)

      try {
        await deleteRecipe(item.id)
        queryClient.setQueryData<RecipeLibraryItem[]>(
          ['recipe-library', user?.id],
          (items) => items?.filter((candidate) => candidate.id !== item.id)
        )
        queryClient.removeQueries({ queryKey: ['recipe-item', item.id] })
        if (item.latest_card) {
          queryClient.removeQueries({
            queryKey: ['recipe-card', item.latest_card.id],
          })
        }
        invalidateRecipeManagement(item)
        track('recipe_deleted', {
          platform: item.platform ?? 'other',
          source: 'library_menu',
        })
        setMenuItem(null)
        setIsDeleteConfirming(false)
      } catch {
        setMenuError('Could not delete this saved recipe. Please try again.')
        track('recipe_delete_failed', {
          platform: item.platform ?? 'other',
          source: 'library_menu',
        })
      } finally {
        setActiveMutation(undefined)
      }
    },
    [activeMutation, invalidateRecipeManagement, queryClient, track, user?.id]
  )

  const usageLabel = getLibraryUsageLabel(aiAccessQuery.data)
  const emptyKind = getEmptyKind({
    hasLibraryItems,
    hasQuery,
    selectedTab,
  })

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          flexGrow: 1,
          gap: spacing.cardGap,
          paddingHorizontal: spacing.mobileMargin,
          paddingTop: insets.top + spacing.md,
          paddingBottom: 142 + insets.bottom,
        }}
        refreshControl={
          <RefreshControl
            refreshing={libraryQuery.isRefetching}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surfaceContainerHigh}
            onRefresh={() => {
              void refetchLibrary()
            }}
          />
        }
        ListHeaderComponent={
          <LibraryHeader
            searchQuery={searchQuery}
            searchMode={searchMode}
            hasQuery={hasQuery}
            selectedTab={selectedTab}
            resultCount={filteredItems.length}
            usageLabel={usageLabel}
            isUsageLoading={aiAccessQuery.isLoading && !aiAccessQuery.data}
            searchSuggestions={searchSuggestions}
            offlineMessage={
              hasBackgroundError
                ? getFriendlyApiErrorMessage(
                    libraryQuery.error,
                    'Could not refresh Library. Pull to retry.'
                  )
                : null
            }
            onUsagePress={openPaywall}
            onSearchOpen={() => {
              setIsSearchActive(true)
              track('library_search_opened', {})
            }}
            onSearchChange={setSearchQuery}
            onSearchSubmit={() => {
              if (hasQuery) {
                track('library_search_used', {
                  result_count: filteredItems.length,
                  selected_tab: selectedTab,
                })
              }
            }}
            onSearchCancel={cancelSearch}
            onClearQuery={clearSearch}
            onChipPress={applySearchChip}
            onTabChange={(tab) => {
              setSelectedTab(tab)
              track('library_tab_changed', { tab })
            }}
          />
        }
        ListEmptyComponent={
          <LibraryEmptyState
            kind={emptyKind}
            isLoading={libraryQuery.isLoading && !libraryQuery.data}
            error={libraryQuery.error}
            onRetry={() => {
              void refetchLibrary()
            }}
            onSaveRecipe={openSaveRecipeModal}
            onClearSearch={cancelSearch}
          />
        }
        renderItem={({ item }) => (
          <LibraryRecipeImageCard
            item={item}
            isFavoriteUpdating={
              activeMutation?.itemId === item.id &&
              activeMutation.type === 'favorite'
            }
            onPress={() => openLibraryItem(item)}
            onFavoritePress={() => {
              void handleToggleFavorite(item, 'card')
            }}
            onMenuPress={() => showItemMenu(item)}
          />
        )}
      />
      <LibraryActionMenu
        item={menuItem}
        errorMessage={menuError}
        isDeleteConfirming={isDeleteConfirming}
        isFavoriteUpdating={
          Boolean(
            menuItem &&
              activeMutation?.itemId === menuItem.id &&
              activeMutation.type === 'favorite'
          )
        }
        isDeleting={
          Boolean(
            menuItem &&
              activeMutation?.itemId === menuItem.id &&
              activeMutation.type === 'delete'
          )
        }
        onClose={closeItemMenu}
        onOpenOriginal={(item) => {
          track('library_item_menu_action', {
            action: 'open_original',
            platform: item.platform ?? 'other',
          })
          void openOriginalSource(item.source_url)
            .then(closeItemMenu)
            .catch(() => {
              setMenuError(
                'Could not open the original video. Try again from recipe details.'
              )
            })
        }}
        onRecipeAction={(item) => {
          track('library_item_menu_action', {
            action: hasAiRecipe(item) ? 'view_ai_recipe' : 'open_generate_flow',
            platform: item.platform ?? 'other',
          })
          closeItemMenu()
          openLibraryItem(item)
        }}
        onToggleFavorite={(item) => {
          void handleToggleFavorite(item, 'menu')
        }}
        onRequestDelete={() => {
          setMenuError(null)
          setIsDeleteConfirming(true)
        }}
        onCancelDelete={() => {
          setMenuError(null)
          setIsDeleteConfirming(false)
        }}
        onConfirmDelete={(item) => {
          void handleDeleteRecipe(item)
        }}
      />
    </View>
  )
}

type EditorialIconName =
  | 'sparkles'
  | 'link'
  | 'clock'
  | 'user'
  | 'heart'
  | 'heart-filled'
  | 'hourglass'
  | 'retry'
  | 'more'
  | 'external'
  | 'book'
  | 'trash'
  | 'close'

const editorialIconGlyphs: Record<EditorialIconName, string> = {
  sparkles: '✦',
  link: '⌁',
  clock: '◷',
  user: '@',
  heart: '♡',
  'heart-filled': '♥',
  hourglass: '⧖',
  retry: '↻',
  more: '⋮',
  external: '↗',
  book: '▤',
  trash: '⌫',
  close: '×',
}

function EditorialIcon({
  name,
  color,
  size = 18,
}: {
  name: EditorialIconName
  color: string
  size?: number
}) {
  return (
    <Text
      selectable={false}
      style={{
        color,
        fontSize: size,
        lineHeight: Math.ceil(size * 1.12),
        fontWeight: '800',
        textAlign: 'center',
      }}
    >
      {editorialIconGlyphs[name]}
    </Text>
  )
}

function PlatformMark({ platform }: { platform: string | null }) {
  const mark = getPlatformMark(platform)

  return (
    <View
      style={{
        minWidth: mark.length > 1 ? 20 : 14,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 5,
        borderWidth: mark.length > 1 ? 1 : 0,
        borderColor: colors.primaryOutlineSoft,
      }}
    >
      <Text
        selectable={false}
        style={{
          color: colors.primary,
          fontSize: mark.length > 1 ? 7 : 14,
          lineHeight: mark.length > 1 ? 10 : 15,
          fontWeight: '900',
          letterSpacing: mark.length > 1 ? 0.2 : 0,
        }}
      >
        {mark}
      </Text>
    </View>
  )
}

function LibraryActionMenu({
  item,
  errorMessage,
  isDeleteConfirming,
  isFavoriteUpdating,
  isDeleting,
  onClose,
  onOpenOriginal,
  onRecipeAction,
  onToggleFavorite,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  item: RecipeLibraryItem | null
  errorMessage: string | null
  isDeleteConfirming: boolean
  isFavoriteUpdating: boolean
  isDeleting: boolean
  onClose: () => void
  onOpenOriginal: (item: RecipeLibraryItem) => void
  onRecipeAction: (item: RecipeLibraryItem) => void
  onToggleFavorite: (item: RecipeLibraryItem) => void
  onRequestDelete: () => void
  onCancelDelete: () => void
  onConfirmDelete: (item: RecipeLibraryItem) => void
}) {
  const insets = useSafeAreaInsets()

  if (!item) {
    return null
  }

  const hasAiCard = hasAiRecipe(item)
  const isPreparing =
    isMediaJobActive(item.latest_media_job) ||
    item.metadata_status === 'saving' ||
    item.metadata_status === 'pending'
  const recipeAction = hasAiCard
    ? { label: 'View AI Recipe', icon: 'book' as const }
    : isPreparing
      ? { label: 'View progress', icon: 'hourglass' as const }
      : { label: 'Generate AI Recipe', icon: 'sparkles' as const }

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
        accessibilityLabel="Close recipe options"
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
                Recipe options
              </Text>
              <Text
                selectable
                numberOfLines={1}
                style={[typography.caption, { color: colors.onSurfaceVariant }]}
              >
                {getRecipeDisplayTitle(item)} · {getPlatformLabel(item.platform)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close recipe options"
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
              <EditorialIcon name="close" color={colors.onSurface} size={25} />
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

          {isDeleteConfirming ? (
            <View style={{ gap: spacing.lg }}>
              <View style={{ gap: spacing.sm }}>
                <Text selectable style={[typography.body, { color: colors.onSurface, fontWeight: '800' }]}>
                  Delete this saved recipe?
                </Text>
                <Text selectable style={[typography.body, { color: colors.onSurfaceVariant }]}>
                  This removes it from your library. It does not affect the original video.
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <Pressable
                  accessibilityRole="button"
                  disabled={isDeleting}
                  onPress={onCancelDelete}
                  style={({ pressed }) => ({
                    minHeight: 50,
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: radius.pill,
                    ...borders.subtle,
                    backgroundColor: colors.glassElevated,
                    opacity: pressed || isDeleting ? 0.64 : 1,
                  })}
                >
                  <Text selectable={false} style={[typography.caption, { color: colors.onSurface }]}>
                    Keep recipe
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Confirm delete saved recipe"
                  disabled={isDeleting}
                  onPress={() => onConfirmDelete(item)}
                  style={({ pressed }) => ({
                    minHeight: 50,
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: spacing.sm,
                    borderRadius: radius.pill,
                    backgroundColor: colors.errorContainer,
                    opacity: pressed || isDeleting ? 0.64 : 1,
                  })}
                >
                  <EditorialIcon name="trash" color={colors.error} size={18} />
                  <Text selectable={false} style={[typography.caption, { color: colors.error, fontWeight: '800' }]}>
                    {isDeleting ? 'Deleting…' : 'Delete'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {item.source_url?.trim() ? (
                <ActionMenuRow
                  icon="external"
                  label="Open original video"
                  onPress={() => onOpenOriginal(item)}
                />
              ) : null}
              <ActionMenuRow
                icon={recipeAction.icon}
                label={recipeAction.label}
                onPress={() => onRecipeAction(item)}
              />
              <ActionMenuRow
                icon={item.is_favorite ? 'heart-filled' : 'heart'}
                label={item.is_favorite ? 'Unfavorite' : 'Favorite'}
                disabled={isFavoriteUpdating}
                onPress={() => onToggleFavorite(item)}
              />
              <ActionMenuRow
                destructive
                icon="trash"
                label="Delete"
                onPress={onRequestDelete}
              />
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function ActionMenuRow({
  icon,
  label,
  destructive = false,
  disabled = false,
  onPress,
}: {
  icon: EditorialIconName
  label: string
  destructive?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const color = destructive ? colors.error : colors.onSurface

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: destructive
          ? 'rgba(255, 180, 171, 0.30)'
          : 'rgba(255, 255, 255, 0.10)',
        backgroundColor: destructive
          ? colors.dangerSurface
          : pressed
            ? colors.surfaceContainerHigh
            : colors.glassElevated,
        paddingHorizontal: spacing.lg,
        opacity: pressed || disabled ? 0.62 : 1,
      })}
    >
      <View
        style={{
          width: 34,
          height: 34,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.pill,
          backgroundColor: destructive
            ? colors.errorContainer
            : colors.primaryWash,
        }}
      >
        <EditorialIcon
          name={icon}
          color={destructive ? colors.error : colors.primary}
          size={19}
        />
      </View>
      <Text selectable={false} style={[typography.body, { color, fontWeight: '700' }]}>
        {disabled ? `${label}…` : label}
      </Text>
    </Pressable>
  )
}

function LibraryHeader({
  searchQuery,
  searchMode,
  hasQuery,
  selectedTab,
  resultCount,
  usageLabel,
  isUsageLoading,
  searchSuggestions,
  offlineMessage,
  onUsagePress,
  onSearchOpen,
  onSearchChange,
  onSearchSubmit,
  onSearchCancel,
  onClearQuery,
  onChipPress,
  onTabChange,
}: {
  searchQuery: string
  searchMode: boolean
  hasQuery: boolean
  selectedTab: LibraryTab
  resultCount: number
  usageLabel: string | null
  isUsageLoading: boolean
  searchSuggestions: string[]
  offlineMessage: string | null
  onUsagePress: () => void
  onSearchOpen: () => void
  onSearchChange: (value: string) => void
  onSearchSubmit: () => void
  onSearchCancel: () => void
  onClearQuery: () => void
  onChipPress: (
    value: string,
    source: 'normal_chip' | 'suggestion_chip'
  ) => void
  onTabChange: (tab: LibraryTab) => void
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
          Library
        </Text>
        <UsagePill
          label={usageLabel}
          isLoading={isUsageLoading}
          onPress={onUsagePress}
        />
      </View>

      {searchMode ? (
        <ActiveLibrarySearch
          value={searchQuery}
          onChangeText={onSearchChange}
          onSubmit={onSearchSubmit}
          onCancel={onSearchCancel}
        />
      ) : (
        <Pressable
          accessibilityLabel="Search recipes and ingredients"
          accessibilityRole="search"
          onPress={onSearchOpen}
          style={({ pressed }) => ({
            minHeight: 56,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.10)',
            backgroundColor: pressed
              ? 'rgba(255, 255, 255, 0.10)'
              : 'rgba(255, 255, 255, 0.06)',
            paddingHorizontal: spacing.lg,
          })}
        >
          <Text selectable={false} style={{ color: colors.onSurfaceVariant, fontSize: 21 }}>
            ⌕
          </Text>
          <Text
            selectable={false}
            style={[typography.body, { color: colors.onSurfaceVariant, opacity: 0.82 }]}
          >
            Search recipes, ingredients...
          </Text>
        </Pressable>
      )}

      {searchMode ? (
        <SearchFilterChips
          query={searchQuery}
          suggestions={searchSuggestions}
          onClearQuery={onClearQuery}
          onSuggestionPress={(value) => onChipPress(value, 'suggestion_chip')}
        />
      ) : (
        <LibraryFilterChips
          chips={normalSearchChips}
          onPress={(value) => onChipPress(value, 'normal_chip')}
        />
      )}

      {searchMode && hasQuery ? (
        <LibrarySearchResultsHeader query={searchQuery} count={resultCount} />
      ) : null}

      {!searchMode ? (
        <LibraryTabs selectedTab={selectedTab} onChange={onTabChange} />
      ) : null}

      {offlineMessage ? <NonBlockingNetworkNotice message={offlineMessage} /> : null}
    </View>
  )
}

function ActiveLibrarySearch({
  value,
  onChangeText,
  onSubmit,
  onCancel,
}: {
  value: string
  onChangeText: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View
        style={{
          minHeight: 52,
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: colors.primary,
        }}
      >
        <Text selectable={false} style={{ color: colors.primary, fontSize: 22 }}>
          ⌕
        </Text>
        <TextInput
          accessibilityLabel="Search saved recipes"
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Search recipes, ingredients, tags..."
          placeholderTextColor={colors.onSurfaceVariant}
          returnKeyType="search"
          selectionColor={colors.primary}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          style={[
            typography.body,
            {
              minHeight: 48,
              flex: 1,
              color: colors.onSurface,
              paddingHorizontal: spacing.sm,
              paddingVertical: 0,
            },
          ]}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancel search"
        onPress={onCancel}
        style={({ pressed }) => ({
          minWidth: 58,
          minHeight: 48,
          alignItems: 'flex-end',
          justifyContent: 'center',
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text selectable={false} style={[typography.caption, { color: colors.onSurface }]}>
          Cancel
        </Text>
      </Pressable>
    </View>
  )
}

function LibraryFilterChips({
  chips,
  onPress,
}: {
  chips: string[]
  onPress: (value: string) => void
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.md }}
    >
      {chips.map((chip) => (
        <GlassChip key={chip} label={chip} onPress={() => onPress(chip)} />
      ))}
    </ScrollView>
  )
}

function SearchFilterChips({
  query,
  suggestions,
  onClearQuery,
  onSuggestionPress,
}: {
  query: string
  suggestions: string[]
  onClearQuery: () => void
  onSuggestionPress: (value: string) => void
}) {
  const trimmedQuery = query.trim()

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: spacing.sm, alignItems: 'center' }}
    >
      <View
        accessibilityLabel="Search filters"
        style={{
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          borderRadius: radius.pill,
          ...borders.subtle,
          backgroundColor: colors.glassElevated,
          paddingHorizontal: spacing.lg,
        }}
      >
        <Text selectable={false} style={{ color: colors.onSurfaceVariant, fontSize: 16 }}>
          ≛
        </Text>
        <Text selectable={false} style={[typography.label, { color: colors.onSurface }]}>
          Filters
        </Text>
      </View>
      {trimmedQuery ? (
        <GlassChip
          label={`${truncateText(trimmedQuery, 22)}  ×`}
          selected
          accessibilityLabel={`Clear ${trimmedQuery} search`}
          onPress={onClearQuery}
        />
      ) : null}
      {suggestions.map((suggestion) => (
        <GlassChip
          key={suggestion}
          label={formatLabel(suggestion)}
          onPress={() => onSuggestionPress(suggestion)}
        />
      ))}
    </ScrollView>
  )
}

function GlassChip({
  label,
  selected = false,
  accessibilityLabel,
  onPress,
}: {
  label: string
  selected?: boolean
  accessibilityLabel?: string
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Search for ${label}`}
      onPress={onPress}
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
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text
        selectable={false}
        numberOfLines={1}
        style={[
          typography.caption,
          { color: selected ? colors.onPrimaryContainer : colors.onSurface },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function LibraryTabs({
  selectedTab,
  onChange,
}: {
  selectedTab: LibraryTab
  onChange: (tab: LibraryTab) => void
}) {
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.10)',
      }}
    >
      {libraryTabs.map((tab) => {
        const selected = selectedTab === tab.value

        return (
          <Pressable
            key={tab.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.value)}
            style={({ pressed }) => ({
              minHeight: 56,
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              borderBottomWidth: 2,
              borderBottomColor: selected ? colors.primaryContainer : 'transparent',
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <Text
              selectable={false}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
              style={[
                typography.heading,
                {
                  color: selected ? colors.onSurface : colors.onSurfaceVariant,
                  fontSize: 20,
                  lineHeight: 26,
                  textAlign: 'center',
                },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function LibrarySearchResultsHeader({
  query,
  count,
}: {
  query: string
  count: number
}) {
  return (
    <View
      style={{
        gap: spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.10)',
        paddingBottom: spacing.lg,
      }}
    >
      <Text selectable style={[typography.heading, { color: colors.onSurface }]}>
        Showing results for{' '}
        <Text
          style={{
            color: colors.primary,
            fontFamily: typography.heading.fontFamily,
            fontStyle: 'italic',
          }}
        >
          “{truncateText(query.trim(), 34)}”
        </Text>
      </Text>
      <Text selectable style={[typography.caption, { color: colors.onSurfaceVariant }]}>
        {count} saved {count === 1 ? 'recipe' : 'recipes'} found
      </Text>
    </View>
  )
}

function LibraryRecipeImageCard({
  item,
  isFavoriteUpdating,
  onPress,
  onFavoritePress,
  onMenuPress,
}: {
  item: RecipeLibraryItem
  isFavoriteUpdating: boolean
  onPress: () => void
  onFavoritePress: () => void
  onMenuPress: () => void
}) {
  const thumbnailUrl = getRecipeCardThumbnail(item)
  const [imageFailed, setImageFailed] = useState(false)
  const title = getRecipeDisplayTitle(item)
  const state = getLibraryCardState(item)
  const metadata = getCardMetadata(item)

  useEffect(() => {
    setImageFailed(false)
  }, [thumbnailUrl])

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${title}. ${state.label}`}
      onPress={onPress}
      style={({ pressed }) => ({
        height: 342,
        overflow: 'hidden',
        borderRadius: radius.card,
        borderCurve: 'continuous',
        ...borders.subtle,
        backgroundColor: colors.surfaceContainer,
        opacity: pressed ? 0.86 : 1,
      })}
    >
      {thumbnailUrl && !imageFailed ? (
        <Image
          accessibilityIgnoresInvertColors
          source={{ uri: thumbnailUrl }}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        <LibraryImagePlaceholder isPreparing={state.isPreparing} />
      )}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          inset: 0,
          experimental_backgroundImage:
            'linear-gradient(to top, rgba(4, 4, 5, 0.98) 0%, rgba(7, 7, 8, 0.78) 32%, rgba(8, 8, 9, 0.20) 70%, rgba(8, 8, 9, 0.12) 100%)',
        }}
      />

      <View
        style={{
          position: 'absolute',
          top: spacing.md,
          left: spacing.md,
          right: 64,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            item.is_favorite
              ? `Remove ${title} from favorites`
              : `Add ${title} to favorites`
          }
          disabled={isFavoriteUpdating}
          onPress={(event) => {
            event.stopPropagation()
            onFavoritePress()
          }}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            flexShrink: 0,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: item.is_favorite
              ? colors.primaryOutlineSoft
              : 'rgba(255, 255, 255, 0.16)',
            backgroundColor: 'rgba(0, 0, 0, 0.54)',
            opacity: pressed || isFavoriteUpdating ? 0.64 : 1,
          })}
        >
          {isFavoriteUpdating ? (
            <Text selectable={false} style={{ color: colors.primary, fontSize: 18 }}>
              …
            </Text>
          ) : (
            <EditorialIcon
              name={item.is_favorite ? 'heart-filled' : 'heart'}
              color={item.is_favorite ? colors.primary : colors.onSurface}
              size={23}
            />
          )}
        </Pressable>
        <View
          style={{
            minWidth: 0,
            minHeight: 36,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.xs,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: state.borderColor,
            backgroundColor: 'rgba(0, 0, 0, 0.54)',
            paddingHorizontal: spacing.md,
          }}
        >
          <EditorialIcon name={state.icon} color={state.color} size={15} />
          <Text selectable={false} style={[typography.caption, { color: state.color }]}>
            {state.label}
          </Text>
        </View>
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
          backgroundColor: 'rgba(0, 0, 0, 0.46)',
          opacity: pressed ? 0.68 : 1,
        })}
      >
        <EditorialIcon name="more" color={colors.onSurface} size={27} />
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
        <Text
          selectable
          numberOfLines={2}
          style={[typography.caption, { color: '#D3CED0', lineHeight: 19 }]}
        >
          {getLibrarySummary(item)}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: spacing.xs,
          }}
        >
          <MetadataChip
            platform={item.platform}
            label={metadata.platform}
          />
          {metadata.creator ? (
            <MetadataChip icon="user" label={metadata.creator} accent />
          ) : null}
          {metadata.time ? (
            <MetadataChip icon="clock" label={metadata.time} />
          ) : null}
        </View>
      </View>
    </Pressable>
  )
}

function MetadataChip({
  icon,
  platform,
  label,
  accent = false,
}: {
  icon?: EditorialIconName
  platform?: string | null
  label: string
  accent?: boolean
}) {
  return (
    <View
      style={{
        minHeight: 28,
        maxWidth: '58%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: accent
          ? colors.primaryOutlineSoft
          : 'rgba(255, 255, 255, 0.12)',
        backgroundColor: 'rgba(0, 0, 0, 0.46)',
        paddingHorizontal: spacing.sm,
      }}
    >
      {platform !== undefined ? (
        <PlatformMark platform={platform} />
      ) : icon ? (
        <EditorialIcon
          name={icon}
          color={accent ? colors.primary : '#D3CED0'}
          size={13}
        />
      ) : null}
      <Text
        selectable
        numberOfLines={1}
        style={[
          typography.label,
          {
            minWidth: 0,
            color: accent ? colors.primary : '#D3CED0',
            fontSize: 9,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  )
}

function LibraryImagePlaceholder({ isPreparing }: { isPreparing: boolean }) {
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
      <Text
        selectable={false}
        style={[typography.heading, { color: colors.onSurfaceVariant, opacity: 0.68 }]}
      >
        {isPreparing ? '⧖' : 'Recipe Dost'}
      </Text>
      {isPreparing ? (
        <View
          style={{
            width: 88,
            height: 3,
            borderRadius: radius.pill,
            backgroundColor: colors.primary,
            opacity: 0.52,
          }}
        />
      ) : null}
    </View>
  )
}

type LibraryEmptyKind = 'library' | 'search' | 'favorites' | 'ai_recipes'

function LibraryEmptyState({
  kind,
  isLoading,
  error,
  onRetry,
  onSaveRecipe,
  onClearSearch,
}: {
  kind: LibraryEmptyKind
  isLoading: boolean
  error: Error | null
  onRetry: () => void
  onSaveRecipe: () => void
  onClearSearch: () => void
}) {
  if (isLoading) {
    return <LoadingState message="Loading your library..." />
  }

  if (error && kind === 'library') {
    return (
      <ErrorState
        title="Could not load Library"
        message={getFriendlyApiErrorMessage(
          error,
          'Could not load your recipes. Please try again.'
        )}
        retryLabel="Retry"
        onRetry={onRetry}
      />
    )
  }

  const content = getEmptyContent(kind)
  const action = kind === 'library' ? onSaveRecipe : kind === 'search' ? onClearSearch : null

  return (
    <View
      style={{
        minHeight: 230,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
        borderRadius: radius.card,
        ...borders.subtle,
        backgroundColor: colors.surfaceContainerLow,
        padding: spacing.xl,
      }}
    >
      <Text selectable style={[typography.heading, { color: colors.onSurface, textAlign: 'center' }]}>
        {content.title}
      </Text>
      <Text selectable style={[typography.body, { color: colors.onSurfaceVariant, textAlign: 'center' }]}>
        {content.message}
      </Text>
      {action ? (
        <Button
          label={kind === 'library' ? 'Save Recipe' : 'Clear search'}
          variant="accent"
          onPress={action}
        />
      ) : null}
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

function getFilteredLibraryItems({
  items,
  query,
  selectedTab,
}: {
  items: RecipeLibraryItem[]
  query: string
  selectedTab: LibraryTab
}) {
  const normalizedQuery = query.trim().toLocaleLowerCase()

  return [...items]
    .filter((item) => {
      if (!normalizedQuery && selectedTab === 'favorites' && !item.is_favorite) {
        return false
      }

      if (!normalizedQuery && selectedTab === 'ai_recipes' && !hasAiRecipe(item)) {
        return false
      }

      return !normalizedQuery || itemMatchesSearchQuery(item, normalizedQuery)
    })
    .sort(
      (left, right) =>
        getValidDateMs(right.created_at) - getValidDateMs(left.created_at)
    )
}

function itemMatchesSearchQuery(item: RecipeLibraryItem, normalizedQuery: string) {
  if (normalizedQuery === 'quick') {
    const totalMinutes = getAiRecipeMinutes(item)

    if (totalMinutes !== null && totalMinutes <= 30) {
      return true
    }
  }

  return getLibrarySearchValues(item).some((value) =>
    value.toLocaleLowerCase().includes(normalizedQuery)
  )
}

function getLibrarySearchValues(item: RecipeLibraryItem) {
  return [
    getRecipeDisplayTitle(item),
    item.title,
    item.description,
    item.source_url,
    item.latest_card?.recipe_title,
    item.latest_card?.short_summary,
    item.latest_media_job?.source_metadata.title,
    item.latest_media_job?.source_metadata.description,
    item.latest_media_job?.source_metadata.author_username,
    item.user_note,
    item.pasted_caption,
    item.manual_ingredients,
    item.cuisine,
    item.meal_type,
    item.platform,
    ...getSourceMetadataSearchValues(item.source_metadata),
    ...(item.latest_card?.tags ?? []),
    ...(item.latest_card?.ingredients.flatMap((ingredient) => [
      ingredient.name,
      ingredient.name_en,
      ingredient.name_ur,
      ingredient.quantity,
      ingredient.notes,
      ingredient.notes_en,
      ingredient.notes_ur,
    ]) ?? []),
    ...(item.latest_card?.steps.flatMap((step) => [
      step.instruction,
      step.instruction_en,
      step.instruction_ur,
      step.tip_en,
      step.tip_ur,
      step.urdu_or_roman_urdu_tip,
    ]) ?? []),
  ].filter((value): value is string => Boolean(value?.trim()))
}

function getSourceMetadataSearchValues(value: RecipeLibraryItem['source_metadata']) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return []
  }

  const metadata = value as Record<string, unknown>
  return [
    metadata.title,
    metadata.description,
    metadata.caption,
    metadata.platform,
    metadata.author,
    metadata.author_name,
    metadata.author_username,
    metadata.authorUsername,
    metadata.creator,
    metadata.channel,
    metadata.channel_name,
    metadata.uploader,
    metadata.username,
    metadata.host,
    metadata.source_host,
  ].filter(
    (candidate): candidate is string =>
      typeof candidate === 'string' && candidate.trim().length > 0
  )
}

function getSearchSuggestions(items: RecipeLibraryItem[], activeQuery: string) {
  const counts = new Map<string, number>()
  const normalizedActiveQuery = activeQuery.toLocaleLowerCase()

  for (const item of items) {
    const values = [
      ...(item.latest_card?.tags ?? []),
      item.meal_type,
      item.cuisine,
      item.platform,
    ]

    for (const value of values) {
      const normalized = value?.trim()

      if (
        !normalized ||
        normalized.toLocaleLowerCase() === normalizedActiveQuery ||
        isRawUrl(normalized)
      ) {
        continue
      }

      counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([value]) => value)
    .slice(0, 3)
}

function getLibraryCardState(item: RecipeLibraryItem) {
  if (hasAiRecipe(item)) {
    return {
      label: 'AI Recipe',
      icon: 'sparkles' as const,
      color: colors.primary,
      borderColor: colors.primaryOutlineSoft,
      isPreparing: false,
    }
  }

  if (isMediaJobActive(item.latest_media_job)) {
    return {
      label: getMediaJobProcessingStage(item.latest_media_job?.status).label,
      icon: 'hourglass' as const,
      color: colors.primary,
      borderColor: colors.primaryOutlineSoft,
      isPreparing: true,
    }
  }

  if (item.latest_media_job?.status === 'needs_caption') {
    return {
      label: 'Caption needed',
      icon: 'retry' as const,
      color: colors.warning,
      borderColor: colors.warning,
      isPreparing: false,
    }
  }

  if (
    isMediaJobAttentionRequired(item.latest_media_job) ||
    item.metadata_status === 'failed'
  ) {
    return {
      label: 'Needs retry',
      icon: 'retry' as const,
      color: colors.error,
      borderColor: colors.error,
      isPreparing: false,
    }
  }

  if (item.metadata_status === 'saving' || item.metadata_status === 'pending') {
    return {
      label: 'Preparing',
      icon: 'hourglass' as const,
      color: colors.primary,
      borderColor: colors.primaryOutlineSoft,
      isPreparing: true,
    }
  }

  return {
    label: 'Saved Link',
    icon: 'link' as const,
    color: colors.onSurface,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    isPreparing: false,
  }
}

function getLibrarySummary(item: RecipeLibraryItem) {
  if (item.latest_card?.short_summary?.trim()) {
    return cleanVisibleText(item.latest_card.short_summary, 132)
  }

  if (isMediaJobActive(item.latest_media_job)) {
    return 'Your AI recipe card is being prepared. Open for live progress.'
  }

  if (item.metadata_status === 'saving' || item.metadata_status === 'pending') {
    return 'Fetching recipe details and preparing a preview.'
  }

  if (
    item.metadata_status === 'failed' ||
    isMediaJobAttentionRequired(item.latest_media_job)
  ) {
    return 'Open this saved recipe to review details and retry safely.'
  }

  const summary =
    item.description ??
    item.latest_media_job?.source_metadata.description ??
    item.pasted_caption ??
    item.user_note

  return summary?.trim()
    ? cleanVisibleText(summary, 132)
    : 'Saved recipe link ready to open and turn into an AI recipe card.'
}

function getCardMetadata(item: RecipeLibraryItem) {
  const platform = getPlatformLabel(item.platform)
  const creator = getRecipeCreatorLabel(item)
  const aiMinutes = getAiRecipeMinutes(item)
  const time =
    aiMinutes !== null
      ? formatMinutes(aiMinutes)
      : item.duration_seconds && item.duration_seconds > 0
        ? formatDurationSeconds(item.duration_seconds)
        : null

  return {
    platform,
    creator:
      creator.toLocaleLowerCase() === platform.toLocaleLowerCase()
        ? null
        : truncateText(creator, 24),
    time,
  }
}

function getAiRecipeMinutes(item: RecipeLibraryItem) {
  if (!item.latest_card) {
    return null
  }

  const minutes =
    (item.latest_card.time.prep_time_minutes ?? 0) +
    (item.latest_card.time.cook_time_minutes ?? 0)

  return minutes > 0 ? minutes : null
}

function hasAiRecipe(item: RecipeLibraryItem) {
  return Boolean(item.latest_card || item.latest_media_job?.result_recipe_card_id)
}

function getLibraryUsageLabel(
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

function getEmptyKind({
  hasLibraryItems,
  hasQuery,
  selectedTab,
}: {
  hasLibraryItems: boolean
  hasQuery: boolean
  selectedTab: LibraryTab
}): LibraryEmptyKind {
  if (!hasLibraryItems) {
    return 'library'
  }

  if (hasQuery) {
    return 'search'
  }

  return selectedTab === 'recent' ? 'library' : selectedTab
}

function getEmptyContent(kind: LibraryEmptyKind) {
  switch (kind) {
    case 'search':
      return {
        title: 'No recipes found',
        message: 'Try searching ingredients, platform, title, or tags.',
      }
    case 'favorites':
      return {
        title: 'No favorites yet',
        message: 'Favorite a saved link or AI recipe from its detail screen.',
      }
    case 'ai_recipes':
      return {
        title: 'No AI recipes yet',
        message: 'Generated AI recipe cards will appear here when they are ready.',
      }
    case 'library':
      return {
        title: 'Your recipe library is waiting',
        message: 'Save your first Instagram, TikTok, YouTube, or recipe link.',
      }
  }
}

async function openOriginalSource(sourceUrl: string) {
  const canOpen = await Linking.canOpenURL(sourceUrl)

  if (!canOpen) {
    throw new Error('unsupported_url')
  }

  await Linking.openURL(sourceUrl)
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

function getPlatformMark(platform: string | null) {
  switch (platform) {
    case 'instagram':
      return 'IG'
    case 'tiktok':
      return 'TT'
    case 'youtube':
      return 'YT'
    case 'facebook':
      return 'FB'
    default:
      return editorialIconGlyphs.link
  }
}

function formatDurationSeconds(seconds: number) {
  const roundedSeconds = Math.max(1, Math.round(seconds))
  const minutes = Math.floor(roundedSeconds / 60)
  const remainder = roundedSeconds % 60

  return minutes > 0 ? `${minutes}m ${remainder ? `${remainder}s` : ''}`.trim() : `${remainder}s`
}

function formatMinutes(minutes: number) {
  if (minutes < 60) {
    return `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return `${hours}h${remainder ? ` ${remainder}m` : ''}`
}

function formatLabel(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function cleanVisibleText(value: string, maxLength: number) {
  const cleaned = value
    .replace(/https?:\/\/\S+|www\.\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return truncateText(cleaned || 'Saved recipe link.', maxLength)
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`
}

function isRawUrl(value: string) {
  return /^(?:https?:\/\/|www\.)\S+$/i.test(value.trim())
}

function getValidDateMs(value: string) {
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}
