import { getPlatformLabel, getReadableSource } from '@/features/recipe-draft/platform'
import { PlatformBadge } from '@/features/recipe-draft/platform-badge'
import { RecipePlatform } from '@/features/recipe-draft/types'
import { UpgradePlaceholder } from '@/features/usage/upgrade-placeholder'
import { UsagePill } from '@/features/usage/usage-limit-card'
import {
  RecipeApiError,
  generateRecipeCard,
  getSavedRecipeItem,
} from '@/lib/api/recipes'
import { getUsageSummary } from '@/lib/api/usage'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, radius, spacing, typography } from '@/theme'
import { AppBadge } from '@/ui/app-badge'
import { AppHeader } from '@/ui/app-header'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { EmptyState } from '@/ui/empty-state'
import { ErrorState } from '@/ui/error-state'
import { LoadingState } from '@/ui/loading-state'
import { Screen } from '@/ui/screen'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Image, Linking, Text, View } from 'react-native'

export default function SavedRecipeRoute() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { track } = usePostHog()
  const { id } = useLocalSearchParams<{ id?: string }>()
  const recipeId = Array.isArray(id) ? id[0] : id
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<Error | null>(null)
  const didTrackUsageSummary = useRef(false)
  const didTrackLimitReached = useRef(false)
  const recipeQuery = useQuery({
    enabled: Boolean(recipeId),
    queryKey: ['recipe-item', recipeId],
    queryFn: () => getSavedRecipeItem(recipeId ?? ''),
  })
  const usageSummaryQuery = useQuery({
    queryKey: ['usage-summary', 'recipe-detail'],
    queryFn: getUsageSummary,
  })
  const usageSummary = usageSummaryQuery.data

  useEffect(() => {
    if (!usageSummary || didTrackUsageSummary.current) {
      return
    }

    didTrackUsageSummary.current = true
    track('usage_summary_viewed', {
      limit_type: 'recipe_cards',
      used: usageSummary.recipeCardsUsed,
      limit: usageSummary.limits.recipeCards,
    })
  }, [track, usageSummary])

  useEffect(() => {
    if (
      !usageSummary ||
      usageSummary.canGenerateRecipeCard ||
      didTrackLimitReached.current
    ) {
      return
    }

    didTrackLimitReached.current = true
    track('usage_limit_reached', {
      limit_type: 'recipe_cards',
      used: usageSummary.recipeCardsUsed,
      limit: usageSummary.limits.recipeCards,
    })
  }, [track, usageSummary])

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
  const hasManualIngredients = Boolean(recipe.manual_ingredients)
  const needsAccuracyContext = !hasCaption && !hasManualIngredients

  const openOriginalVideo = async () => {
    const canOpenUrl = await Linking.canOpenURL(recipe.source_url)

    if (canOpenUrl) {
      await Linking.openURL(recipe.source_url)
      track('original_source_opened', {
        platform,
        source: 'saved_recipe_detail',
      })
    }
  }

  const handleGenerateRecipeCard = async () => {
    if (!recipeId || isGenerating) {
      return
    }

    if (usageSummary && !usageSummary.canGenerateRecipeCard) {
      return
    }

    setIsGenerating(true)
    setGenerationError(null)
    track('ai_recipe_started', {
      platform,
    })

    try {
      const response = await generateRecipeCard(recipeId)

      track('ai_recipe_completed', {
        platform,
        confidence: response.data.confidence,
      })
      void queryClient.invalidateQueries({
        queryKey: ['usage-summary'],
      })
      router.push(`/recipe-card/${response.data.recipe_card_id}`)
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error
          ? caughtError
          : new Error('Something went wrong while creating your recipe card.')

      setGenerationError(nextError)
      track('ai_recipe_failed', {
        platform,
        error_code:
          caughtError instanceof RecipeApiError
            ? caughtError.code
            : 'generation_failed',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Screen compact>
      <AppHeader
        eyebrow="Saved link"
        title="Recipe link saved"
        subtitle="Your link, caption, and notes are saved. AI can turn them into a clean recipe card."
      />

      <Card tone="warm">
        <View
          style={{
            overflow: 'hidden',
            aspectRatio: 1.55,
            borderRadius: radius.lg,
            backgroundColor: colors.surfaceMuted,
          }}
        >
          {recipe.thumbnail_url ? (
            <Image
              source={{ uri: recipe.thumbnail_url }}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <View
              style={{
                flex: 1,
                justifyContent: 'flex-end',
                gap: spacing.sm,
                padding: spacing.lg,
              }}
            >
              <Text
                selectable={false}
                style={{
                  color: colors.text,
                  fontSize: 44,
                  lineHeight: 48,
                  fontWeight: '900',
                }}
              >
                RD
              </Text>
              <View
                style={{
                  width: '64%',
                  height: 8,
                  borderRadius: radius.pill,
                  backgroundColor: colors.primary,
                }}
              />
              <View
                style={{
                  width: '42%',
                  height: 8,
                  borderRadius: radius.pill,
                  backgroundColor: colors.accent,
                }}
              />
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <PlatformBadge platform={platform} />
          <AppBadge label="Saved Link" />
        </View>
        <Text selectable style={[typography.heading, { color: colors.text }]}>
          {recipe.title ?? 'Untitled recipe link'}
        </Text>
        <Button
          label="Open Original Video"
          fullWidth
          variant="accent"
          onPress={() => {
            void openOriginalVideo()
          }}
        />
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
          Recipe Dost saves the link and recipe card, not the video file.
        </Text>
        <View style={{ gap: spacing.xs }}>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Platform
          </Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            {getPlatformLabel(platform)}
          </Text>
        </View>
        {needsAccuracyContext ? (
          <Text selectable style={[typography.caption, { color: colors.warning }]}>
            Add or paste the caption for better AI accuracy.
          </Text>
        ) : null}
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
            {getRecipeInputSummary(hasNote, hasCaption, hasManualIngredients)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {hasNote ? <AppBadge label="Note added" /> : null}
          {hasCaption ? <AppBadge label="Caption added" /> : null}
          {hasManualIngredients ? <AppBadge label="Ingredients added" /> : null}
        </View>
      </Card>

      {usageSummary ? (
        <UsagePill
          label="Free AI tries remaining"
          value={`${usageSummary.recipeCardsRemaining}`}
        />
      ) : null}

      <Card tone="warm">
        <View style={{ gap: spacing.xs }}>
          <Text selectable style={[typography.heading, { color: colors.text }]}>
            AI uses your saved details
          </Text>
          <Text selectable style={[typography.body, { color: colors.textMuted }]}>
            For best accuracy, paste the recipe caption or ingredients before
            generating. If only the source link exists, Recipe Dost can try, but
            confidence should stay low.
          </Text>
        </View>
        <Button
          label="Generate Recipe Card"
          fullWidth
          disabled={
            isGenerating ||
            usageSummaryQuery.isLoading ||
            Boolean(usageSummary && !usageSummary.canGenerateRecipeCard)
          }
          onPress={() => {
            void handleGenerateRecipeCard()
          }}
        />
      </Card>

      {isGenerating ? (
        <LoadingState message="Creating your recipe card..." />
      ) : null}

      {usageSummary && !usageSummary.canGenerateRecipeCard ? (
        <UpgradePlaceholder
          limitType="recipe_cards"
          used={usageSummary.recipeCardsUsed}
          limit={usageSummary.limits.recipeCards}
          actionLabel="View Library"
          onActionPress={() => router.replace('/library')}
        />
      ) : null}

      {generationError ? (
        <ErrorState
          title="Could not create recipe card"
          message={getGenerationErrorMessage(generationError)}
          retryLabel="Retry"
          onRetry={() => {
            void handleGenerateRecipeCard()
          }}
        />
      ) : null}

      <Button
        label="Back to Home"
        fullWidth
        onPress={() => router.replace('/home')}
      />
    </Screen>
  )
}

function getRecipeInputSummary(
  hasNote: boolean,
  hasCaption: boolean,
  hasManualIngredients: boolean
) {
  const detailsCount = [hasNote, hasCaption, hasManualIngredients].filter(
    Boolean
  ).length

  if (detailsCount > 1) {
    return 'Extra details added for better AI results'
  }

  if (hasNote) {
    return 'Note added'
  }

  if (hasCaption) {
    return 'Caption added'
  }

  if (hasManualIngredients) {
    return 'Manual ingredients added'
  }

  return 'No note, caption, or ingredients added yet'
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

function getGenerationErrorMessage(error: Error) {
  const code =
    error instanceof RecipeApiError
      ? error.code
      : 'unexpected_generate_card_error'
  const message = getFriendlyGenerateCardErrorMessage(code)

  if (__DEV__) {
    return `${message}\nDebug code: ${code}`
  }

  return message
}

function getFriendlyGenerateCardErrorMessage(code: string) {
  switch (code) {
    case 'missing_openai_key':
      return 'AI generation is not configured yet.'
    case 'missing_gemini_key':
      return 'Gemini generation is not configured yet.'
    case 'gemini_request_failed':
      return 'Gemini could not create the recipe card right now.'
    case 'gemini_rate_limited':
      return 'Gemini is busy right now. Please try again in a few minutes.'
    case 'gemini_bad_request':
      return 'Gemini could not use this request. Please try again.'
    case 'gemini_invalid_key_or_forbidden':
      return 'Gemini generation is not allowed with the current key.'
    case 'gemini_model_not_found':
      return 'Gemini model is not available.'
    case 'openai_request_failed':
      return 'AI service could not create the recipe card right now.'
    case 'openai_rate_limited':
      return 'AI service is busy right now. Please try again in a few minutes.'
    case 'openai_insufficient_quota':
      return 'OpenAI quota is not available for this project.'
    case 'openai_invalid_api_key':
      return 'OpenAI key is invalid or unavailable.'
    case 'openai_model_forbidden':
      return 'OpenAI model is not allowed for this key.'
    case 'openai_model_not_found':
      return 'OpenAI model is not available.'
    case 'openai_bad_request':
      return 'OpenAI could not use this request. Please try again.'
    case 'missing_openrouter_key':
      return 'OpenRouter generation is not configured yet.'
    case 'openrouter_request_failed':
      return 'OpenRouter could not create the recipe card right now.'
    case 'openrouter_rate_limited':
      return 'OpenRouter is busy right now. Please try again in a few minutes.'
    case 'openrouter_bad_request':
      return 'OpenRouter could not use this request. Please try again.'
    case 'openrouter_invalid_key_or_forbidden':
      return 'OpenRouter generation is not allowed with the current key.'
    case 'openrouter_model_not_found':
      return 'OpenRouter model is not available.'
    case 'missing_kimi_key':
      return 'Kimi generation is not configured yet.'
    case 'kimi_request_failed':
      return 'Kimi could not create the recipe card right now.'
    case 'kimi_rate_limited':
      return 'Kimi is busy right now. Please try again in a few minutes.'
    case 'kimi_bad_request':
      return 'Kimi could not use this request. Please try again.'
    case 'kimi_invalid_key_or_forbidden':
      return 'Kimi generation is not allowed with the current key.'
    case 'kimi_model_not_found':
      return 'Kimi model is not available.'
    case 'missing_anthropic_key':
      return 'Anthropic generation is not configured yet.'
    case 'missing_anthropic_model':
      return 'Anthropic model is not configured yet.'
    case 'anthropic_not_implemented':
      return 'Anthropic generation is not available right now.'
    case 'unsupported_ai_provider':
      return 'AI provider is not supported.'
    case 'invalid_ai_output':
      return 'Recipe card could not be generated. Please add more details and try again.'
    case 'db_insert_failed':
      return 'Recipe card was created but could not be saved.'
    case 'recipe_not_found':
      return 'Recipe link not found.'
    case 'free_limit_reached':
      return 'You have used your free recipe cards.'
    case 'unauthorized':
      return 'Please restart the app and try again.'
    default:
      return 'Something went wrong while creating your recipe card.'
  }
}
