import { detectRecipePlatform } from '@/features/recipe-draft/platform'
import { extractFirstRecipeUrlFromSharedText } from '@/features/share-intent/extract-url'
import { useSaveRecipeModal } from '@/features/save-recipe/save-recipe-modal'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { Screen } from '@/ui/screen'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef } from 'react'

export default function ShareRecipeRoute() {
  const router = useRouter()
  const { track } = usePostHog()
  const { openSaveRecipeModal, showSaveRecipeMessage } = useSaveRecipeModal()
  const { url, text } = useLocalSearchParams<{ url?: string; text?: string }>()
  const didHandleRef = useRef(false)
  const sharedUrl = useMemo(() => {
    const rawUrl = getFirstParamValue(url)
    const rawText = getFirstParamValue(text)

    return (
      extractFirstRecipeUrlFromSharedText(rawUrl) ??
      extractFirstRecipeUrlFromSharedText(rawText)
    )
  }, [text, url])

  useEffect(() => {
    if (didHandleRef.current) {
      return
    }

    didHandleRef.current = true
    track('share_intent_received')

    if (!sharedUrl) {
      track('share_url_invalid', { reason: 'missing_supported_url' })
      showSaveRecipeMessage('Could not find a recipe video link in the shared text.')
      router.replace('/home')
      return
    }

    const platform = detectRecipePlatform(sharedUrl)
    track('share_url_extracted', { platform })

    openSaveRecipeModal({
      initialUrl: sharedUrl,
      source: 'share_intent',
      sourceHint: 'Shared from another app',
    })
    router.replace('/home')
  }, [openSaveRecipeModal, router, sharedUrl, showSaveRecipeMessage, track])

  return <Screen compact>{null}</Screen>
}

function getFirstParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
