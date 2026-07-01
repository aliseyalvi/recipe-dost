import { detectRecipePlatform } from '@/features/recipe-draft/platform'
import { extractFirstHttpUrl } from '@/features/share-intent/extract-url'
import { refreshRecipeMetadata, saveRecipeLink } from '@/lib/api/recipes'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, spacing, typography } from '@/theme'
import { AppHeader } from '@/ui/app-header'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { EmptyState } from '@/ui/empty-state'
import { ErrorState } from '@/ui/error-state'
import { LoadingState } from '@/ui/loading-state'
import { Screen } from '@/ui/screen'
import { useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Text } from 'react-native'

export default function ShareRecipeRoute() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { track } = usePostHog()
  const { url, text } = useLocalSearchParams<{ url?: string; text?: string }>()
  const [error, setError] = useState<Error | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const didStartRef = useRef(false)
  const sharedUrl = useMemo(() => {
    const rawUrl = Array.isArray(url) ? url[0] : url
    const rawText = Array.isArray(text) ? text[0] : text

    return extractFirstHttpUrl(rawUrl) ?? extractFirstHttpUrl(rawText)
  }, [text, url])

  useEffect(() => {
    if (didStartRef.current) {
      return
    }

    didStartRef.current = true

    if (!sharedUrl) {
      track('share_intent_failed', { reason: 'missing_url' })
      return
    }

    const sourceUrl = sharedUrl
    const platform = detectRecipePlatform(sourceUrl)
    track('share_intent_received', { platform })

    async function saveSharedRecipe() {
      try {
        const savedRecipe = await saveRecipeLink(sourceUrl)

        track('recipe_link_saved', {
          source: 'share_intent',
          platform: savedRecipe.platform ?? platform,
          metadata_status: savedRecipe.metadata_status ?? 'pending',
        })
        void queryClient.invalidateQueries({ queryKey: ['recent-recipes'] })
        void queryClient.invalidateQueries({ queryKey: ['recipe-library'] })
        router.replace(`/recipe/${savedRecipe.id}`)

        try {
          track('metadata_refresh_started', {
            source: 'share_intent',
            platform: savedRecipe.platform ?? platform,
          })
          const refreshResult = await refreshRecipeMetadata(savedRecipe.id)

          track('metadata_refresh_completed', {
            source: 'share_intent',
            metadata_status: refreshResult.metadata_status,
            worker_status: refreshResult.worker_status,
            error_code: refreshResult.error_code,
            title_present: refreshResult.title_present,
            thumbnail_present: refreshResult.thumbnail_present,
          })
          void queryClient.invalidateQueries({ queryKey: ['recent-recipes'] })
          void queryClient.invalidateQueries({ queryKey: ['recipe-library'] })
          void queryClient.invalidateQueries({
            queryKey: ['recipe-item', savedRecipe.id],
          })
        } catch {
          track('metadata_refresh_completed', {
            source: 'share_intent',
            metadata_status: 'failed',
            error_code: 'client_error',
          })
        }
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError
            : new Error('Could not save this shared recipe link.')
        )
        track('share_intent_failed', { reason: 'save_failed' })
      }
    }

    void saveSharedRecipe()
  }, [queryClient, retryCount, router, sharedUrl, track])

  if (!sharedUrl) {
    return (
      <Screen compact>
        <EmptyState
          title="No recipe link found"
          message="Paste the recipe link manually."
          actionLabel="Paste Manually"
          onActionPress={() => router.replace('/save-recipe')}
        />
      </Screen>
    )
  }

  return (
    <Screen compact>
      <AppHeader
        eyebrow="Shared"
        title="Saving shared recipe"
        subtitle="Saving the link now. Details can load in the background."
      />

      <Card tone="warm">
        <Text selectable style={[typography.body, { color: colors.text }]}>
          Shared recipe link found
        </Text>
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
          We save links and recipe cards, not videos.
        </Text>
      </Card>

      {error ? (
        <ErrorState
          title="Could not open shared link"
          message={error.message}
          retryLabel="Retry"
          onRetry={() => {
            didStartRef.current = false
            setError(null)
            setRetryCount((currentCount) => currentCount + 1)
          }}
          secondaryActionLabel="Paste Manually"
          onSecondaryAction={() => router.replace('/save-recipe')}
        />
      ) : (
        <LoadingState message="Saving shared recipe..." />
      )}

      <Button
        label="Paste Manually"
        fullWidth
        variant="secondary"
        onPress={() => router.replace('/save-recipe')}
      />
    </Screen>
  )
}
