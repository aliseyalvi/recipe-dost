import { RecentRecipeCard } from '@/features/home/recent-recipe-card'
import { getRecentRecipes, RecentRecipeItem } from '@/features/home/recent-recipes-api'
import { QuickActionCard } from '@/features/home/quick-action-card'
import { useUserProfileQuery } from '@/features/onboarding/use-user-profile-query'
import { useAuth } from '@/providers/auth-provider'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, spacing, typography } from '@/theme'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { EmptyState } from '@/ui/empty-state'
import { ErrorState } from '@/ui/error-state'
import { LoadingState } from '@/ui/loading-state'
import { Screen } from '@/ui/screen'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { Text, View } from 'react-native'

export default function HomeRoute() {
  const router = useRouter()
  const { user } = useAuth()
  const { track } = usePostHog()
  const profileQuery = useUserProfileQuery()
  const recentRecipesQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ['recent-recipes', user?.id],
    queryFn: getRecentRecipes,
  })

  useEffect(() => {
    track('home_viewed')
  }, [track])

  const openSaveRecipe = () => {
    track('home_primary_cta_clicked')
    router.push('/save-recipe')
  }

  const handleRecentRecipePress = (recipe: RecentRecipeItem) => {
    track('recent_recipe_clicked', {
      platform: recipe.platform,
      metadata_status: recipe.metadata_status,
    })
  }

  return (
    <Screen>
      <View style={{ gap: spacing.sm }}>
        <Text selectable style={[typography.title, { color: colors.text }]}>
          {getGreeting(profileQuery.data?.language)}
        </Text>
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          {getSubtitle(profileQuery.data?.language)}
        </Text>
      </View>

      <Card>
        <View style={{ gap: spacing.md }}>
          <Text selectable style={[typography.heading, { color: colors.text }]}>
            Stop losing recipe Reels
          </Text>
          <Text selectable style={[typography.body, { color: colors.textMuted }]}>
            Save TikToks, Reels, Shorts, and food videos as clean recipe cards
            with ingredients, steps, and grocery lists.
          </Text>
        </View>
        <Button label="Save Recipe Link" fullWidth onPress={openSaveRecipe} />
        <Button
          label="View Library"
          fullWidth
          variant="secondary"
          onPress={() => router.push('/library')}
        />
      </Card>

      <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
        Recipe Dost saves recipe cards and links, not video files.
      </Text>

      <View style={{ gap: spacing.md }}>
        <Text selectable style={[typography.heading, { color: colors.text }]}>
          How Recipe Dost works
        </Text>
        <View style={{ gap: spacing.sm }}>
          <HowItWorksStep stepNumber={1} label="Paste a recipe video link" />
          <HowItWorksStep stepNumber={2} label="Add notes or caption if needed" />
          <HowItWorksStep
            stepNumber={3}
            label="Get ingredients, steps, and grocery list"
          />
        </View>
      </View>

      <View style={{ gap: spacing.md }}>
        <Text selectable style={[typography.heading, { color: colors.text }]}>
          Recent recipes
        </Text>
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
            title="No recipes saved yet"
            message="Save your first food Reel or Short and turn it into a clean recipe card."
            actionLabel="Save Your First Recipe"
            onActionPress={openSaveRecipe}
          />
        ) : null}
        {recentRecipesQuery.data && recentRecipesQuery.data.length > 0 ? (
          <View style={{ gap: spacing.md }}>
            {recentRecipesQuery.data.map((recipe) => (
              <RecentRecipeCard
                key={recipe.id}
                recipe={recipe}
                onPress={handleRecentRecipePress}
              />
            ))}
          </View>
        ) : null}
      </View>

      <View style={{ gap: spacing.md }}>
        <Text selectable style={[typography.heading, { color: colors.text }]}>
          Quick actions
        </Text>
        <QuickActionCard
          title="Library"
          description="Browse saved recipe links and cards."
          onPress={() => router.push('/library')}
        />
        <QuickActionCard
          title="Grocery List"
          description="Open the grocery list workspace."
          onPress={() => router.push('/grocery')}
        />
        <QuickActionCard
          title="Settings"
          description="Manage language, support, and account basics."
          onPress={() => router.push('/settings')}
        />
      </View>
    </Screen>
  )
}

function HowItWorksStep({
  stepNumber,
  label,
}: {
  stepNumber: number
  label: string
}) {
  return (
    <View
      style={{
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          backgroundColor: colors.primary,
        }}
      >
        <Text
          selectable
          style={[
            typography.caption,
            { color: colors.primaryText, fontVariant: ['tabular-nums'] },
          ]}
        >
          {stepNumber}
        </Text>
      </View>
      <Text selectable style={[typography.body, { flex: 1, color: colors.text }]}>
        {label}
      </Text>
    </View>
  )
}

function getGreeting(language: string | null | undefined) {
  if (language === 'urdu' || language === 'roman_urdu' || language === 'both') {
    return 'Assalam o Alaikum 👋'
  }

  return 'Welcome back'
}

function getSubtitle(language: string | null | undefined) {
  if (language === 'urdu' || language === 'roman_urdu' || language === 'both') {
    return 'Ready to organize your saved recipe videos with Urdu/Roman Urdu notes?'
  }

  return 'Ready to organize your saved recipe videos?'
}
