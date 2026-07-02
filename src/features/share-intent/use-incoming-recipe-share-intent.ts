import { detectRecipePlatform } from '@/features/recipe-draft/platform'
import { extractFirstRecipeUrlFromText } from '@/features/share-intent/extract-url'
import { useSaveRecipeModal } from '@/features/save-recipe/save-recipe-modal'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { useEffect, useRef } from 'react'
import { useShareIntent } from 'expo-share-intent'

export function useIncomingRecipeShareIntent() {
  const { openSaveRecipeModal } = useSaveRecipeModal()
  const { track } = usePostHog()
  const lastHandledUrlRef = useRef<string | null>(null)
  const { hasShareIntent, shareIntent, resetShareIntent, error } =
    useShareIntent({
      resetOnBackground: false,
      scheme: 'recipe-dost',
    })

  useEffect(() => {
    if (error) {
      track('share_url_invalid', { reason: 'native_share_error' })
    }
  }, [error, track])

  useEffect(() => {
    if (!hasShareIntent) {
      return
    }

    track('share_intent_received')

    const sharedUrl =
      extractFirstRecipeUrlFromText(shareIntent.webUrl) ??
      extractFirstRecipeUrlFromText(shareIntent.text) ??
      extractFirstRecipeUrlFromText(shareIntent.meta?.title)

    if (!sharedUrl) {
      track('share_url_invalid', { reason: 'missing_supported_url' })
      resetShareIntent()
      return
    }

    if (lastHandledUrlRef.current === sharedUrl) {
      resetShareIntent()
      return
    }

    lastHandledUrlRef.current = sharedUrl
    setTimeout(() => {
      if (lastHandledUrlRef.current === sharedUrl) {
        lastHandledUrlRef.current = null
      }
    }, 2000)
    track('share_url_extracted', {
      platform: detectRecipePlatform(sharedUrl),
    })
    openSaveRecipeModal({
      initialUrl: sharedUrl,
      source: 'share_intent',
      sourceHint: 'Shared from another app',
    })
    resetShareIntent()
  }, [
    hasShareIntent,
    openSaveRecipeModal,
    resetShareIntent,
    shareIntent.meta?.title,
    shareIntent.text,
    shareIntent.webUrl,
    track,
  ])
}

export function IncomingRecipeShareIntentHandler() {
  useIncomingRecipeShareIntent()

  return null
}
