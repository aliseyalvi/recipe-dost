import { getRecipeGroceryList } from '@/lib/api/recipes'
import type { GroceryItem, RecipeGroceryList } from '@/lib/api/recipes'
import { getUsageSummary } from '@/lib/api/usage'
import { UpgradePlaceholder } from '@/features/usage/upgrade-placeholder'
import { UsagePill } from '@/features/usage/usage-limit-card'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, radius, spacing, typography } from '@/theme'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { EmptyState } from '@/ui/empty-state'
import { ErrorState } from '@/ui/error-state'
import { LoadingState } from '@/ui/loading-state'
import { Screen } from '@/ui/screen'
import { useQuery } from '@tanstack/react-query'
import * as Clipboard from 'expo-clipboard'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

export default function GroceryRoute() {
  const router = useRouter()
  const { track } = usePostHog()
  const { recipeCardId: recipeCardIdParam } = useLocalSearchParams<{
    recipeCardId?: string
  }>()
  const recipeCardId = Array.isArray(recipeCardIdParam)
    ? recipeCardIdParam[0]
    : recipeCardIdParam
  const [checkedItemIds, setCheckedItemIds] = useState<Set<string>>(
    () => new Set()
  )
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const viewedCardIdRef = useRef<string | null>(null)
  const didTrackUsageSummary = useRef(false)
  const groceryListQuery = useQuery({
    enabled: Boolean(recipeCardId),
    queryKey: ['recipe-grocery-list', recipeCardId],
    queryFn: () => getRecipeGroceryList(recipeCardId ?? ''),
  })
  const usageSummaryQuery = useQuery({
    queryKey: ['usage-summary', 'grocery-list'],
    queryFn: getUsageSummary,
  })
  const recipeGroceryList = groceryListQuery.data
  const usageSummary = usageSummaryQuery.data
  const groceryItems = useMemo(
    () =>
      (recipeGroceryList?.grocery_items ?? []).map((item) => ({
        ...item,
        checked: checkedItemIds.has(item.id),
      })),
    [checkedItemIds, recipeGroceryList?.grocery_items]
  )
  const checkedCount = groceryItems.filter((item) => item.checked).length
  const recipeTitle = getRecipeTitle(recipeGroceryList)
  const hasRecipeTitle = Boolean(recipeGroceryList?.recipe_title?.trim())

  useEffect(() => {
    setCheckedItemIds(new Set())
    setCopyMessage(null)
  }, [recipeGroceryList?.id])

  useEffect(() => {
    if (!recipeGroceryList || viewedCardIdRef.current === recipeGroceryList.id) {
      return
    }

    viewedCardIdRef.current = recipeGroceryList.id
    track(
      'grocery_list_viewed',
      getGroceryAnalyticsProperties({
        itemCount: recipeGroceryList.grocery_items.length,
        checkedCount: 0,
        hasRecipeTitle,
      })
    )
  }, [hasRecipeTitle, recipeGroceryList, track])

  useEffect(() => {
    if (!usageSummary || didTrackUsageSummary.current) {
      return
    }

    didTrackUsageSummary.current = true
    track('usage_summary_viewed', {
      limit_type: 'grocery_lists',
      used: usageSummary.groceryListsUsed,
      limit: usageSummary.limits.groceryLists,
    })
  }, [track, usageSummary])

  if (!recipeCardId) {
    return (
      <Screen>
        <EmptyState
          title="Grocery list not found"
          message="Open a recipe card first, then view its grocery list."
          actionLabel="Back to Library"
          onActionPress={() => router.replace('/library')}
        />
      </Screen>
    )
  }

  if (groceryListQuery.isLoading) {
    return (
      <Screen>
        <LoadingState message="Loading grocery list..." />
      </Screen>
    )
  }

  if (groceryListQuery.error) {
    return (
      <Screen>
        <ErrorState
          title="Could not load grocery list"
          message={groceryListQuery.error.message}
          retryLabel="Retry"
          onRetry={() => {
            void groceryListQuery.refetch()
          }}
          secondaryActionLabel="Back to Library"
          onSecondaryAction={() => router.replace('/library')}
        />
      </Screen>
    )
  }

  if (!recipeGroceryList) {
    return (
      <Screen>
        <EmptyState
          title="Grocery list not found"
          message="Open a recipe card first, then view its grocery list."
          actionLabel="Back to Library"
          onActionPress={() => router.replace('/library')}
        />
      </Screen>
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
    setCopyMessage(null)
    track(
      'grocery_item_checked',
      getGroceryAnalyticsProperties({
        itemCount: groceryItems.length,
        checkedCount: nextCheckedItemIds.size,
        hasRecipeTitle,
      })
    )
  }

  const uncheckAll = () => {
    setCheckedItemIds(new Set())
    setCopyMessage(null)
    track(
      'grocery_list_unchecked_all',
      getGroceryAnalyticsProperties({
        itemCount: groceryItems.length,
        checkedCount: 0,
        hasRecipeTitle,
      })
    )
  }

  const copyList = async () => {
    await Clipboard.setStringAsync(formatGroceryListCopy(recipeTitle, groceryItems))
    setCopyMessage('Grocery list copied.')
    track(
      'grocery_list_copied',
      getGroceryAnalyticsProperties({
        itemCount: groceryItems.length,
        checkedCount,
        hasRecipeTitle,
      })
    )
  }

  return (
    <Screen>
      <View style={{ gap: spacing.sm }}>
        <Text selectable style={[typography.title, { color: colors.text }]}>
          Grocery List
        </Text>
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          {recipeTitle}
        </Text>
        {recipeGroceryList.servings ? (
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Servings: {recipeGroceryList.servings}
          </Text>
        ) : null}
      </View>

      {usageSummary ? (
        <UsagePill
          label="Grocery lists used"
          value={`${usageSummary.groceryListsUsed} / ${usageSummary.limits.groceryLists}`}
        />
      ) : null}

      {usageSummary && !usageSummary.canOpenGroceryList ? (
        <UpgradePlaceholder
          limitType="grocery_lists"
          used={usageSummary.groceryListsUsed}
          limit={usageSummary.limits.groceryLists}
          actionLabel="View Library"
          onActionPress={() => router.replace('/library')}
        />
      ) : null}

      {groceryItems.length === 0 ? (
        <EmptyState
          title="No grocery items yet"
          message="This recipe card does not have grocery items or ingredients to turn into a list."
          actionLabel="Back to Recipe"
          onActionPress={() => router.push(`/recipe-card/${recipeGroceryList.id}`)}
        />
      ) : (
        <>
          <Card>
            <View style={{ gap: spacing.sm }}>
              <Text selectable style={[typography.heading, { color: colors.text }]}>
                Checklist
              </Text>
              <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
                {checkedCount} of {groceryItems.length} checked
              </Text>
            </View>
            <View style={{ gap: spacing.sm }}>
              {groceryItems.map((item) => (
                <ChecklistItem key={item.id} item={item} onPress={toggleItem} />
              ))}
            </View>
          </Card>

          {copyMessage ? (
            <Text selectable style={[typography.caption, { color: colors.primary }]}>
              {copyMessage}
            </Text>
          ) : null}

          <View style={{ gap: spacing.md }}>
            <Button
              label="Copy List"
              fullWidth
              onPress={() => {
                void copyList()
              }}
            />
            <Button
              label="Uncheck All"
              fullWidth
              variant="secondary"
              disabled={checkedCount === 0}
              onPress={uncheckAll}
            />
            <Button
              label="Back to Recipe"
              fullWidth
              variant="ghost"
              onPress={() => router.push(`/recipe-card/${recipeGroceryList.id}`)}
            />
          </View>
        </>
      )}
    </Screen>
  )
}

function ChecklistItem({
  item,
  onPress,
}: {
  item: GroceryItem
  onPress: (item: GroceryItem) => void
}) {
  return (
    <Pressable
      accessibilityLabel={
        item.quantity ? `${item.label}, ${item.quantity}` : item.label
      }
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.checked }}
      onPress={() => onPress(item)}
      style={({ pressed }) => [
        {
          minHeight: 56,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          borderWidth: 1,
          borderColor: item.checked ? colors.primary : colors.border,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          backgroundColor: item.checked ? colors.surfaceMuted : colors.surface,
          padding: spacing.md,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <View
        style={{
          width: 24,
          height: 24,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: item.checked ? colors.primary : colors.border,
          borderRadius: radius.sm,
          backgroundColor: item.checked ? colors.primary : colors.surface,
        }}
      >
        <Text
          selectable={false}
          style={[typography.caption, { color: colors.primaryText }]}
        >
          {item.checked ? '✓' : ''}
        </Text>
      </View>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text
          selectable
          style={[
            typography.body,
            {
              color: item.checked ? colors.textMuted : colors.text,
              textDecorationLine: item.checked ? 'line-through' : 'none',
            },
          ]}
        >
          {item.label}
        </Text>
        {item.quantity ? (
          <Text
            selectable
            style={[typography.caption, { color: colors.textMuted }]}
          >
            {item.quantity}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

function getRecipeTitle(recipeGroceryList: RecipeGroceryList | undefined) {
  return recipeGroceryList?.recipe_title?.trim() || 'Untitled recipe'
}

function formatGroceryListCopy(recipeTitle: string, items: GroceryItem[]) {
  return [`Grocery List — ${recipeTitle}`, '', ...items.map(formatCopyItem)].join(
    '\n'
  )
}

function formatCopyItem(item: GroceryItem) {
  return item.quantity ? `* ${item.label} - ${item.quantity}` : `* ${item.label}`
}

function getGroceryAnalyticsProperties({
  itemCount,
  checkedCount,
  hasRecipeTitle,
}: {
  itemCount: number
  checkedCount: number
  hasRecipeTitle: boolean
}) {
  return {
    item_count: itemCount,
    checked_count: checkedCount,
    has_recipe_title: hasRecipeTitle,
  }
}
