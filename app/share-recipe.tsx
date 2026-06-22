import { detectRecipePlatform } from '@/features/recipe-draft/platform'
import { useRecipeDraftStore } from '@/features/recipe-draft/recipe-draft-store'
import { extractFirstHttpUrl } from '@/features/share-intent/extract-url'
import { parseRecipeUrl } from '@/lib/api/recipes'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, spacing, typography } from '@/theme'
import { AppHeader } from '@/ui/app-header'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { EmptyState } from '@/ui/empty-state'
import { ErrorState } from '@/ui/error-state'
import { LoadingState } from '@/ui/loading-state'
import { Screen } from '@/ui/screen'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Text } from 'react-native'

export default function ShareRecipeRoute() {
  const router = useRouter()
  const { track } = usePostHog()
  const { setDraft } = useRecipeDraftStore()
  const { url, text } = useLocalSearchParams<{ url?: string; text?: string }>()
  const [error, setError] = useState<Error | null>(null)
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

    async function parseSharedRecipe() {
      try {
        const parsedRecipeUrl = await parseRecipeUrl(sourceUrl)

        setDraft({
          source_url: parsedRecipeUrl.source_url,
          normalized_url: parsedRecipeUrl.normalized_url,
          host: parsedRecipeUrl.host,
          platform: parsedRecipeUrl.platform,
          title: parsedRecipeUrl.title,
          description: parsedRecipeUrl.description,
          thumbnail_url: parsedRecipeUrl.thumbnail_url,
          metadata_status: parsedRecipeUrl.metadata_status,
          requires_manual_caption: parsedRecipeUrl.requires_manual_caption,
          created_at: new Date().toISOString(),
        })
        router.replace('/recipe/preview')
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError
            : new Error('Could not check this shared recipe link.')
        )
        track('share_intent_failed', { reason: 'parse_failed' })
      }
    }

    void parseSharedRecipe()
  }, [router, setDraft, sharedUrl, track])

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
        subtitle="Checking the link before preview."
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
          retryLabel="Paste Manually"
          onRetry={() => router.replace('/save-recipe')}
        />
      ) : (
        <LoadingState message="Preparing preview..." />
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
