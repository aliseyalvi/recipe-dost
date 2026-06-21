import { getPlatformLabel, getReadableSource } from '@/features/recipe-draft/platform'
import { PlatformBadge } from '@/features/recipe-draft/platform-badge'
import { RecipePlatform } from '@/features/recipe-draft/types'
import {
  generateMockRecipeCard,
  getSavedRecipeItem,
} from '@/lib/api/recipes'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, spacing, typography } from '@/theme'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { EmptyState } from '@/ui/empty-state'
import { ErrorState } from '@/ui/error-state'
import { LoadingState } from '@/ui/loading-state'
import { Screen } from '@/ui/screen'
import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'

export default function SavedRecipeRoute() {
  const router = useRouter()
  const { track } = usePostHog()
  const { id } = useLocalSearchParams<{ id?: string }>()
  const recipeId = Array.isArray(id) ? id[0] : id
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<Error | null>(null)
  const recipeQuery = useQuery({
    enabled: Boolean(recipeId),
    queryKey: ['recipe-item', recipeId],
    queryFn: () => getSavedRecipeItem(recipeId ?? ''),
  })

  if (!recipeId) {
    return (
      <Screen>
        <EmptyState
          title="Recipe link not found"
          message="Go back home and open a saved recipe link again."
          actionLabel="Back to Home"
          onActionPress={() => router.replace('/home')}
        />
      </Screen>
    )
  }

  if (recipeQuery.isLoading) {
    return (
      <Screen>
        <LoadingState message="Loading saved recipe link..." />
      </Screen>
    )
  }

  if (recipeQuery.error) {
    return (
      <Screen>
        <ErrorState
          title="Could not load saved link"
          message={recipeQuery.error.message}
          retryLabel="Retry"
          onRetry={() => {
            void recipeQuery.refetch()
          }}
          secondaryActionLabel="Back to Home"
          onSecondaryAction={() => router.replace('/home')}
        />
      </Screen>
    )
  }

  if (!recipeQuery.data) {
    return (
      <Screen>
        <EmptyState
          title="Recipe link not found"
          message="Go back home and open a saved recipe link again."
          actionLabel="Back to Home"
          onActionPress={() => router.replace('/home')}
        />
      </Screen>
    )
  }

  const recipe = recipeQuery.data
  const platform = getRecipePlatform(recipe.platform)
  const hasNote = Boolean(recipe.user_note)
  const hasCaption = Boolean(recipe.pasted_caption)

  const handleGenerateMockRecipeCard = async () => {
    if (!recipeId || isGenerating) {
      return
    }

    setIsGenerating(true)
    setGenerationError(null)
    track('ai_recipe_started', {
      platform,
      model_used: 'mock',
    })

    try {
      const response = await generateMockRecipeCard(recipeId)

      track('ai_recipe_completed', {
        platform,
        model_used: 'mock',
        confidence: response.data.confidence,
      })
      router.push(`/recipe-card/${response.data.recipe_card_id}`)
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error
          ? caughtError
          : new Error('Could not generate the mock recipe card. Please try again.')

      setGenerationError(nextError)
      track('ai_recipe_failed', {
        platform,
        model_used: 'mock',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Screen>
      <View style={{ gap: spacing.md }}>
        <Text selectable style={[typography.title, { color: colors.text }]}>
          Recipe link saved
        </Text>
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          AI recipe card generation is coming next.
        </Text>
      </View>

      <Card>
        <PlatformBadge platform={platform} />
        <Text selectable style={[typography.heading, { color: colors.text }]}>
          {recipe.title ?? 'Untitled recipe link'}
        </Text>
        <View style={{ gap: spacing.xs }}>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Platform
          </Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            {getPlatformLabel(platform)}
          </Text>
        </View>
        <View style={{ gap: spacing.xs }}>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Source link
          </Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            {getReadableSource(recipe.source_url)}
          </Text>
        </View>
        <View style={{ gap: spacing.xs }}>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Notes
          </Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            {getRecipeInputSummary(hasNote, hasCaption)}
          </Text>
        </View>
      </Card>

      {isGenerating ? (
        <LoadingState message="Generating mock recipe card..." />
      ) : null}

      {generationError ? (
        <ErrorState
          title="Could not generate mock card"
          message={generationError.message}
          retryLabel="Retry"
          onRetry={() => {
            void handleGenerateMockRecipeCard()
          }}
        />
      ) : null}

      <Button
        label="Generate Mock Recipe Card"
        fullWidth
        disabled={isGenerating}
        onPress={() => {
          void handleGenerateMockRecipeCard()
        }}
      />

      <Button
        label="Back to Home"
        fullWidth
        onPress={() => router.replace('/home')}
      />
    </Screen>
  )
}

function getRecipeInputSummary(hasNote: boolean, hasCaption: boolean) {
  if (hasNote && hasCaption) {
    return 'Note and caption added'
  }

  if (hasNote) {
    return 'Note added'
  }

  if (hasCaption) {
    return 'Caption added'
  }

  return 'No note or caption added yet'
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
