import { RecipePlatform } from '@/features/recipe-draft/types'
import { RecipeLibraryItem, getRecipeLibrary } from '@/lib/api/recipes'
import { getUsageSummary } from '@/lib/api/usage'
import { useAuth } from '@/providers/auth-provider'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, radius, spacing, typography } from '@/theme'
import { AppBadge } from '@/ui/app-badge'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { EmptyState } from '@/ui/empty-state'
import { ErrorState } from '@/ui/error-state'
import { FilterChip } from '@/ui/filter-chip'
import { LoadingState } from '@/ui/loading-state'
import { Screen } from '@/ui/screen'
import { SectionHeader } from '@/ui/section-header'
import { VisualRecipeCard } from '@/ui/visual-recipe-card'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

type HomeChip = 'all' | 'ai_cards' | 'links' | 'grocery' | 'instagram' | 'tiktok'

const homeChips: { label: string; value: HomeChip }[] = [
  { label: 'All', value: 'all' },
  { label: 'AI Cards', value: 'ai_cards' },
  { label: 'Links', value: 'links' },
  { label: 'Grocery', value: 'grocery' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'TikTok', value: 'tiktok' },
]

export default function HomeRoute() {
  const router = useRouter()
  const { user } = useAuth()
  const { track } = usePostHog()
  const [selectedChip, setSelectedChip] = useState<HomeChip>('all')
  const didTrackUsageSummary = useRef(false)
  const recentRecipesQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ['recent-recipes', user?.id],
    queryFn: () => getRecipeLibrary({ limit: 6 }),
  })
  const usageSummaryQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ['usage-summary', user?.id],
    queryFn: getUsageSummary,
  })
  const filteredRecipes = useMemo(
    () => filterHomeRecipes(recentRecipesQuery.data ?? [], selectedChip),
    [recentRecipesQuery.data, selectedChip]
  )

  useEffect(() => {
    track('home_viewed')
  }, [track])

  useEffect(() => {
    if (!usageSummaryQuery.data || didTrackUsageSummary.current) {
      return
    }

    didTrackUsageSummary.current = true
    track('usage_summary_viewed', {
      limit_type: 'saved_links',
      used: usageSummaryQuery.data.savedLinksUsed,
      limit: usageSummaryQuery.data.limits.savedLinks,
    })
    track('usage_summary_viewed', {
      limit_type: 'recipe_cards',
      used: usageSummaryQuery.data.recipeCardsUsed,
      limit: usageSummaryQuery.data.limits.recipeCards,
    })
    track('usage_summary_viewed', {
      limit_type: 'grocery_lists',
      used: usageSummaryQuery.data.groceryListsUsed,
      limit: usageSummaryQuery.data.limits.groceryLists,
    })
  }, [track, usageSummaryQuery.data])

  const openSaveRecipe = () => {
    track('home_primary_cta_clicked')
    router.push('/save-recipe')
  }

  const openRecipe = (recipe: RecipeLibraryItem) => {
    track('recent_recipe_clicked', {
      platform: recipe.platform,
      metadata_status: recipe.metadata_status,
    })

    if (recipe.latest_card) {
      router.push(`/recipe-card/${recipe.latest_card.id}`)
      return
    }

    router.push(`/recipe/${recipe.id}`)
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
            selected={selectedChip === chip.value}
            onPress={() => setSelectedChip(chip.value)}
          />
        ))}
      </ScrollView>

      <Card tone="muted">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text selectable style={[typography.heading, { color: colors.text }]}>
              Get started
            </Text>
            <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
              Build a useful recipe library in a few taps.
            </Text>
          </View>
          <AppBadge
            label={`${getCompletedSteps(usageSummaryQuery.data)} of 4`}
            tone="primary"
          />
        </View>
        <View
          style={{
            overflow: 'hidden',
            height: 6,
            borderRadius: radius.pill,
            backgroundColor: colors.border,
          }}
        >
          <View
            style={{
              width: `${(getCompletedSteps(usageSummaryQuery.data) / 4) * 100}%`,
              height: '100%',
              backgroundColor: colors.primary,
            }}
          />
        </View>
        <View style={{ gap: spacing.sm }}>
          <ProgressItem
            label="Save your first recipe link"
            completed={Boolean(usageSummaryQuery.data?.savedLinksUsed)}
          />
          <ProgressItem
            label="Generate an AI recipe card"
            completed={Boolean(usageSummaryQuery.data?.recipeCardsUsed)}
          />
          <ProgressItem
            label="Open a grocery list"
            completed={Boolean(usageSummaryQuery.data?.groceryListsUsed)}
          />
          <ProgressItem label="Add notes or caption" completed={false} />
        </View>
      </Card>

      {usageSummaryQuery.data ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <UsageStat label="Saved" value={`${usageSummaryQuery.data.savedLinksUsed}`} />
          <UsageStat label="AI Cards" value={`${usageSummaryQuery.data.recipeCardsUsed}`} />
          <UsageStat
            label="AI tries left"
            value={`${usageSummaryQuery.data.recipeCardsRemaining}`}
          />
        </View>
      ) : null}

      <View style={{ gap: spacing.md }}>
        <SectionHeader title="Today" subtitle="Recent saves and recipe cards." />
        {recentRecipesQuery.isLoading || recentRecipesQuery.isFetching ? (
          <LoadingState message="Loading recent recipes..." />
        ) : null}
        {recentRecipesQuery.error ? (
          <ErrorState
            title="Could not load recent recipes"
            message={recentRecipesQuery.error.message}
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
                  title={
                    recipe.latest_card?.recipe_title?.trim() ||
                    recipe.title?.trim() ||
                    'Untitled recipe'
                  }
                  subtitle={recipe.latest_card ? 'Recipe card' : 'Saved link'}
                  platform={getRecipePlatform(recipe.platform)}
                  status={recipe.latest_card ? 'ai_card' : getSavedLinkStatus(recipe)}
                  thumbnailUrl={recipe.thumbnail_url}
                  sourceUrl={recipe.source_url}
                  hasGroceryList={Boolean(recipe.latest_card)}
                  hasNotes={hasNotes(recipe)}
                  confidence={recipe.latest_card?.confidence}
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

function ProgressItem({
  label,
  completed,
}: {
  label: string
  completed: boolean
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <View
        style={{
          width: 24,
          height: 24,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: completed ? colors.primary : colors.border,
          borderRadius: radius.pill,
          backgroundColor: completed ? colors.primary : 'transparent',
        }}
      >
        <Text selectable={false} style={[typography.caption, { color: colors.text }]}>
          {completed ? '✓' : ''}
        </Text>
      </View>
      <Text
        selectable
        style={[
          typography.body,
          {
            flex: 1,
            color: completed ? colors.textMuted : colors.text,
            textDecorationLine: completed ? 'line-through' : 'none',
          },
        ]}
      >
        {label}
      </Text>
    </View>
  )
}

function UsageStat({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flex: 1,
        gap: spacing.xs,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        padding: spacing.md,
      }}
    >
      <Text
        selectable
        style={[typography.heading, { color: colors.primary, textAlign: 'center' }]}
      >
        {value}
      </Text>
      <Text
        selectable
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}
      >
        {label}
      </Text>
    </View>
  )
}

function getCompletedSteps(
  usageSummary:
    | {
        savedLinksUsed: number
        recipeCardsUsed: number
        groceryListsUsed: number
      }
    | undefined
) {
  if (!usageSummary) {
    return 0
  }

  return [
    usageSummary.savedLinksUsed > 0,
    usageSummary.recipeCardsUsed > 0,
    usageSummary.groceryListsUsed > 0,
    usageSummary.savedLinksUsed > 0,
  ].filter(Boolean).length
}

function filterHomeRecipes(items: RecipeLibraryItem[], selectedChip: HomeChip) {
  return items.filter((item) => {
    switch (selectedChip) {
      case 'ai_cards':
        return Boolean(item.latest_card)
      case 'links':
        return !item.latest_card
      case 'grocery':
        return Boolean(item.latest_card)
      case 'instagram':
      case 'tiktok':
        return getRecipePlatform(item.platform) === selectedChip
      case 'all':
        return true
    }
  })
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
  return recipe.metadata_status === 'failed' ? 'failed' : 'saved_link'
}

function hasNotes(recipe: RecipeLibraryItem) {
  return Boolean(
    recipe.user_note?.trim() ||
      recipe.pasted_caption?.trim() ||
      recipe.manual_ingredients?.trim()
  )
}
