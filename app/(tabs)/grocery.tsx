import {
  RecipeContentLanguage,
  useRecipeContentLanguage,
} from '@/features/language/content-language'
import { ContentLanguageControl } from '@/features/language/content-language-control'
import { hasUrduScript } from '@/features/language/localized-text'
import { detectRecipePlatform } from '@/features/recipe-draft/platform'
import { getRecipeGroceryList, getRecipeGroceryLists } from '@/lib/api/recipes'
import type { GroceryItem, RecipeGroceryList } from '@/lib/api/recipes'
import { getUsageSummary } from '@/lib/api/usage'
import { UpgradePlaceholder } from '@/features/usage/upgrade-placeholder'
import { UsagePill } from '@/features/usage/usage-limit-card'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, radius, spacing, typography } from '@/theme'
import { AppHeader } from '@/ui/app-header'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { EmptyState } from '@/ui/empty-state'
import { ErrorState } from '@/ui/error-state'
import { LoadingState } from '@/ui/loading-state'
import { Screen } from '@/ui/screen'
import { UrduText } from '@/ui/urdu-text'
import { VisualRecipeCard } from '@/ui/visual-recipe-card'
import { useQuery } from '@tanstack/react-query'
import * as Clipboard from 'expo-clipboard'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

export default function GroceryRoute() {
  const router = useRouter()
  const { track } = usePostHog()
  const { language: globalLanguage } = useRecipeContentLanguage()
  const [screenLanguage, setScreenLanguage] =
    useState<RecipeContentLanguage | null>(null)
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
  const groceryListsQuery = useQuery({
    enabled: !recipeCardId,
    queryKey: ['recipe-grocery-lists'],
    queryFn: getRecipeGroceryLists,
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
  const contentLanguage = screenLanguage ?? globalLanguage
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
      <Screen compact tabBarPadding>
        <AppHeader
          eyebrow="Cook"
          title="Grocery"
          subtitle="Open grocery lists from your recipe cards."
        />
        {groceryListsQuery.isLoading ? (
          <LoadingState message="Loading grocery lists..." />
        ) : null}
        {groceryListsQuery.error ? (
          <ErrorState
            title="Could not load grocery lists"
            message={groceryListsQuery.error.message}
            retryLabel="Retry"
            onRetry={() => {
              void groceryListsQuery.refetch()
            }}
          />
        ) : null}
        {groceryListsQuery.data?.length === 0 ? (
          <EmptyState
            title="No grocery lists yet"
            message="Generate a recipe card first, then open its grocery list."
            actionLabel="Go to Library"
            onActionPress={() => router.replace('/library')}
          />
        ) : null}
        {groceryListsQuery.data && groceryListsQuery.data.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            {groceryListsQuery.data.map((item) => (
              <View key={item.id} style={{ width: '47.8%' }}>
                <VisualRecipeCard
                  title={getRecipeTitle(item)}
                  subtitle={`${item.grocery_items.length} grocery items`}
                  platform={detectRecipePlatform(item.source_link ?? '')}
                  status="ai_card"
                  sourceUrl={item.source_link}
                  hasGroceryList
                  createdAt={item.created_at}
                  onPress={() => router.push(`/grocery?recipeCardId=${item.id}`)}
                />
              </View>
            ))}
          </View>
        ) : null}
      </Screen>
    )
  }

  if (groceryListQuery.isLoading) {
    return (
      <Screen tabBarPadding>
        <LoadingState message="Loading grocery list..." />
      </Screen>
    )
  }

  if (groceryListQuery.error) {
    return (
      <Screen tabBarPadding>
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
      <Screen tabBarPadding>
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
    await Clipboard.setStringAsync(
      formatGroceryListCopy(recipeTitle, groceryItems, contentLanguage)
    )
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
    <Screen compact tabBarPadding>
      <View style={{ gap: spacing.sm }}>
        <AppHeader
          eyebrow="Cook"
          title="Grocery List"
          subtitle={recipeTitle}
        />
        {recipeGroceryList.servings ? (
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Servings: {recipeGroceryList.servings}
          </Text>
        ) : null}
        <ContentLanguageControl
          value={contentLanguage}
          onChange={setScreenLanguage}
        />
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
          title="No grocery items here yet"
          message="This recipe card does not have grocery items or ingredients to turn into a checklist."
          actionLabel="Back to Recipe"
          onActionPress={() => router.push(`/recipe-card/${recipeGroceryList.id}`)}
        />
      ) : (
        <>
          <Card tone="warm">
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
                <ChecklistItem
                  key={item.id}
                  item={item}
                  language={contentLanguage}
                  onPress={toggleItem}
                />
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
              variant="accent"
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
  language,
  onPress,
}: {
  item: GroceryItem
  language: RecipeContentLanguage
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
          backgroundColor: item.checked ? colors.primarySoft : colors.surface,
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
          backgroundColor: item.checked ? colors.primary : colors.surfaceMuted,
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
        <GroceryItemLabel item={item} language={language} checked={item.checked} />
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

function GroceryItemLabel({
  item,
  language,
  checked,
}: {
  item: GroceryItem
  language: RecipeContentLanguage
  checked: boolean
}) {
  const english = item.label_en ?? item.label
  const urdu = hasUrduScript(item.label_ur) ? item.label_ur : null
  const textStyle = {
    color: checked ? colors.textMuted : colors.text,
    textDecorationLine: checked ? ('line-through' as const) : ('none' as const),
  }

  if (language === 'urdu') {
    return urdu ? (
      <UrduText muted={checked} style={{ textDecorationLine: textStyle.textDecorationLine }}>
        {urdu}
      </UrduText>
    ) : (
      <Text selectable style={[typography.body, textStyle]}>
        {english}
      </Text>
    )
  }

  if (language === 'both') {
    return (
      <View style={{ gap: spacing.xs }}>
        <Text selectable style={[typography.body, textStyle]}>
          {english}
        </Text>
        {urdu ? (
          <UrduText
            muted={checked}
            style={{ textDecorationLine: textStyle.textDecorationLine }}
          >
            {urdu}
          </UrduText>
        ) : null}
      </View>
    )
  }

  return (
    <Text selectable style={[typography.body, textStyle]}>
      {english}
    </Text>
  )
}

function getRecipeTitle(recipeGroceryList: RecipeGroceryList | undefined) {
  return recipeGroceryList?.recipe_title?.trim() || 'Untitled recipe'
}

function formatGroceryListCopy(
  recipeTitle: string,
  items: GroceryItem[],
  language: RecipeContentLanguage
) {
  return [
    `Grocery List — ${recipeTitle}`,
    '',
    ...items.map((item) => formatCopyItem(item, language)),
  ].join('\n')
}

function formatCopyItem(item: GroceryItem, language: RecipeContentLanguage) {
  const english = `${item.label_en ?? item.label}${item.quantity ? ` - ${item.quantity}` : ''}`
  const urdu = hasUrduScript(item.label_ur)
    ? `${item.label_ur}${item.quantity ? ` - ${item.quantity}` : ''}`
    : null

  if (language === 'urdu') {
    return `* ${urdu ?? english}`
  }

  if (language === 'both' && urdu) {
    return `* ${english}\n  ${urdu}`
  }

  return `* ${english}`
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
