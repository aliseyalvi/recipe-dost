import { getPlatformLabel } from '@/features/recipe-draft/platform'
import { PlatformBadge } from '@/features/recipe-draft/platform-badge'
import { RecipePlatform } from '@/features/recipe-draft/types'
import { UsagePill } from '@/features/usage/usage-limit-card'
import { getAiAccessState } from '@/lib/api/ai-access'
import {
  RecipeApiError,
  createMediaJob,
  getLatestMediaJobForRecipe,
  getRecipeCard,
  getSavedRecipeItem,
  isMediaJobActive,
} from '@/lib/api/recipes'
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
  const [isCreatingMediaJob, setIsCreatingMediaJob] = useState(false)
  const [mediaJobError, setMediaJobError] = useState<Error | null>(null)
  const [showCreditLimitState, setShowCreditLimitState] = useState(false)
  const didTrackUsageSummary = useRef(false)
  const lastTrackedMediaJobStatus = useRef<string | null>(null)
  const recipeQuery = useQuery({
    enabled: Boolean(recipeId),
    queryKey: ['recipe-item', recipeId],
    queryFn: () => getSavedRecipeItem(recipeId ?? ''),
  })
  const aiAccessQuery = useQuery({
    queryKey: ['ai-access-state', 'recipe-detail'],
    queryFn: getAiAccessState,
  })
  const mediaJobQuery = useQuery({
    enabled: Boolean(recipeId),
    queryKey: ['media-job', 'recipe', recipeId],
    queryFn: () => getLatestMediaJobForRecipe(recipeId ?? ''),
    refetchInterval: (query) =>
      isMediaJobActive(query.state.data) ? 5000 : false,
  })
  const aiAccess = aiAccessQuery.data

  useEffect(() => {
    if (!aiAccess || didTrackUsageSummary.current) {
      return
    }

    didTrackUsageSummary.current = true
    track('usage_summary_viewed', {
      limit_type: 'ai_recipe_cards',
      used: aiAccess.usedSuccessfulGenerations,
      limit: aiAccess.freeLimit,
      role: aiAccess.role,
      reason: aiAccess.reason,
    })
  }, [aiAccess, track])

  useEffect(() => {
    const mediaJob = mediaJobQuery.data

    if (
      !mediaJob ||
      lastTrackedMediaJobStatus.current === mediaJob.status
    ) {
      return
    }

    lastTrackedMediaJobStatus.current = mediaJob.status
    track('media_job_status_viewed', {
      platform: getRecipePlatform(mediaJob.platform),
      status: mediaJob.status,
      progress: mediaJob.progress,
    })
    if (mediaJob.status === 'failed') {
      track('media_job_failed', {
        platform: getRecipePlatform(mediaJob.platform),
        error_code: mediaJob.error_code ?? 'unknown',
      })
    }
  }, [mediaJobQuery.data, track])

  useEffect(() => {
    const recipeCardId = mediaJobQuery.data?.result_recipe_card_id

    if (!recipeCardId) {
      return
    }

    void queryClient.prefetchQuery({
      queryKey: ['recipe-card', recipeCardId],
      queryFn: () => getRecipeCard(recipeCardId),
    })
    void queryClient.invalidateQueries({
      queryKey: ['recent-recipes'],
    })
    void queryClient.invalidateQueries({
      queryKey: ['recipe-library'],
    })
  }, [mediaJobQuery.data?.result_recipe_card_id, queryClient])

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
  const mediaJob = mediaJobQuery.data
  const liveSourceTitle =
    mediaJob?.source_metadata.title?.trim() || recipe.title?.trim()
  const liveThumbnailUrl =
    mediaJob?.thumbnail_url ??
    mediaJob?.source_metadata.uploaded_thumbnail_url ??
    recipe.thumbnail_url
  const liveDurationSeconds =
    mediaJob?.source_metadata.duration_seconds ?? recipe.duration_seconds
  const activeMediaJob = isMediaJobActive(mediaJob) ? mediaJob : null

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

  const handleCreateMediaJob = async () => {
    if (isCreatingMediaJob) {
      return
    }

    setIsCreatingMediaJob(true)
    setMediaJobError(null)
    setShowCreditLimitState(false)

    track('generate_ai_recipe_tapped', {
      platform,
    })

    try {
      const createdJob = await createMediaJob({
        recipeItemId: recipe.id,
      })

      track('media_job_created', {
        platform,
        status: createdJob.status,
      })
      await aiAccessQuery.refetch()
      await mediaJobQuery.refetch()
    } catch (caughtError) {
      if (
        caughtError instanceof RecipeApiError &&
        caughtError.code === 'ai_credit_limit_reached'
      ) {
        setShowCreditLimitState(true)
        track('ai_credit_limit_reached', {
          platform,
        })
        track('upgrade_placeholder_shown', {
          limit_type: 'ai_recipe_cards',
          source: 'saved_recipe_detail',
        })
        return
      }

      const nextError =
        caughtError instanceof Error
          ? caughtError
          : new Error('Could not generate AI recipe. Please try again.')

      setMediaJobError(getFriendlyMediaJobError(caughtError, nextError))
      track('media_job_failed', {
        platform,
        error_code:
          caughtError instanceof RecipeApiError
            ? caughtError.code
            : 'media_job_failed',
      })
      track('media_job_create_failed', {
        platform,
        error_code:
          caughtError instanceof RecipeApiError
            ? caughtError.code
            : 'media_job_failed',
      })
    } finally {
      setIsCreatingMediaJob(false)
    }
  }

  return (
    <Screen compact>
      <AppHeader
        eyebrow="Saved link"
        title="Recipe source"
        subtitle="Generate an AI recipe card whenever you are ready."
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
          {liveThumbnailUrl ? (
            <Image
              source={{ uri: liveThumbnailUrl }}
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
          {liveSourceTitle ?? 'Saved recipe link'}
        </Text>
        {typeof liveDurationSeconds === 'number' ? (
          <Text selectable style={[typography.body, { color: colors.textMuted }]}>
            Duration: {formatDuration(liveDurationSeconds)}
          </Text>
        ) : null}
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
      </Card>

      {recipe.metadata_status === 'failed' ? (
        <Card tone="muted">
          <Text selectable style={[typography.heading, { color: colors.warning }]}>
            Details unavailable
          </Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            Details unavailable, but you can still generate AI recipe.
          </Text>
        </Card>
      ) : null}

      {mediaJobQuery.isLoading ? (
        <LoadingState message="Checking AI recipe status..." />
      ) : null}

      {mediaJobQuery.error ? (
        <ErrorState
          title="Could not load AI recipe status"
          message={mediaJobQuery.error.message}
          retryLabel="Retry"
          onRetry={() => {
            void mediaJobQuery.refetch()
          }}
        />
      ) : null}

      {activeMediaJob ? (
        <Card tone="warm">
          <Text selectable style={[typography.heading, { color: colors.text }]}>
            Analyzing
          </Text>
          <Text selectable style={[typography.body, { color: colors.textMuted }]}>
            Recipe Dost is generating your AI recipe card.
          </Text>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: activeMediaJob.progress }}
            style={{
              overflow: 'hidden',
              height: 8,
              borderRadius: radius.pill,
              backgroundColor: colors.border,
            }}
          >
            <View
              style={{
                width: `${activeMediaJob.progress}%`,
                height: '100%',
                backgroundColor: colors.primary,
              }}
            />
          </View>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            {activeMediaJob.progress}% complete
          </Text>
        </Card>
      ) : mediaJob?.result_recipe_card_id ? (
        <Card tone="warm">
          <Text selectable style={[typography.heading, { color: colors.text }]}>
            AI recipe ready
          </Text>
          <Button
            label="Open AI Recipe"
            fullWidth
            onPress={() => router.push(`/recipe-card/${mediaJob.result_recipe_card_id}`)}
          />
        </Card>
      ) : !mediaJobQuery.isLoading && !mediaJobQuery.error ? (
        <Card tone="warm">
          <View style={{ gap: spacing.xs }}>
            <Text selectable style={[typography.heading, { color: colors.text }]}>
              Generate AI Recipe
            </Text>
            <Text selectable style={[typography.body, { color: colors.textMuted }]}>
              AI turns this saved link and available details into a recipe card.
              Recipe Dost saves links and recipe cards, not videos.
            </Text>
          </View>
          <Button
            label="Generate AI Recipe"
            fullWidth
            disabled={isCreatingMediaJob}
            onPress={() => {
              void handleCreateMediaJob()
            }}
          />
          {mediaJob?.status === 'failed' ? (
            <Text selectable style={[typography.caption, { color: colors.warning }]}>
              The last AI generation attempt failed. You can try generating again.
            </Text>
          ) : null}
        </Card>
      ) : null}

      {isCreatingMediaJob ? (
        <LoadingState message="Starting AI recipe..." />
      ) : null}

      {mediaJobError ? (
        <Card tone="muted">
          <Text selectable style={[typography.heading, { color: colors.warning }]}>
            Could not generate AI recipe
          </Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            {mediaJobError.message}
          </Text>
          <Button
            label="Generate AI Recipe"
            fullWidth
            disabled={isCreatingMediaJob}
            onPress={() => {
              void handleCreateMediaJob()
            }}
          />
        </Card>
      ) : null}

      {showCreditLimitState ? (
        <Card tone="muted">
          <Text selectable style={[typography.heading, { color: colors.warning }]}>
            Free AI recipes used
          </Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            You have used your 3 free AI recipe generations. Upgrade to generate
            more recipe cards.
          </Text>
          <Button
            label="Unlock Pro"
            fullWidth
            variant="accent"
            onPress={() => router.push('/paywall')}
          />
          <Button
            label="Maybe later"
            fullWidth
            variant="secondary"
            onPress={() => setShowCreditLimitState(false)}
          />
        </Card>
      ) : null}

      {aiAccess ? (
        <UsagePill
          label="AI recipes left"
          value={getAiRecipesLeftValue(aiAccess)}
        />
      ) : aiAccessQuery.isLoading ? (
        <UsagePill label="AI recipes left" value="-" />
      ) : null}

      <Button
        label="Back to Home"
        fullWidth
        onPress={() => router.replace('/home')}
      />
    </Screen>
  )
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

function getFriendlyMediaJobError(caughtError: unknown, fallback: Error) {
  if (
    caughtError instanceof RecipeApiError &&
    caughtError.code === 'video_duration_exceeded'
  ) {
    return new Error(
      'This video is over the 2-minute analysis limit. Save the link or paste the caption instead.'
    )
  }

  return fallback
}

function getAiRecipesLeftValue(access: {
  role: string
  isTestUser: boolean
  premiumActive: boolean
  remaining: number | null
  reason: string
}) {
  if (access.role === 'admin') {
    return 'Admin'
  }

  if (access.isTestUser || access.role === 'tester') {
    return 'Tester'
  }

  if (access.premiumActive) {
    return 'Pro'
  }

  if (access.reason === 'limit_reached') {
    return '0'
  }

  return access.remaining === null ? '-' : `${access.remaining}`
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes === 0) {
    return `${seconds}s`
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
