import { detectRecipePlatform } from '@/features/recipe-draft/platform'
import { extractFirstRecipeUrlFromText } from '@/features/share-intent/extract-url'
import { useSaveRecipeModal } from '@/features/save-recipe/save-recipe-modal'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { useEffect, useRef, useState } from 'react'
import { useShareIntent } from 'expo-share-intent'

type IncomingShareState =
  | { status: 'idle' }
  | { status: 'received_valid_share'; url: string }
  | { status: 'received_invalid_share' }
  | { status: 'consumed' }

export function useIncomingRecipeShareIntent() {
  const { openSaveRecipeModal, showSaveRecipeMessage } = useSaveRecipeModal()
  const { track } = usePostHog()
  const lastHandledUrlRef = useRef<string | null>(null)
  const [shareState, setShareState] = useState<IncomingShareState>({
    status: 'idle',
  })
  const { hasShareIntent, shareIntent, resetShareIntent, error } =
    useShareIntent({
      resetOnBackground: false,
      scheme: 'recipe-dost',
    })

  useEffect(() => {
    if (error) {
      track('share_url_invalid', { reason: 'native_share_error' })
      setShareState((currentState) =>
        currentState.status === 'received_invalid_share'
          ? currentState
          : { status: 'received_invalid_share' }
      )
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
      setShareState((currentState) =>
        currentState.status === 'received_invalid_share'
          ? currentState
          : { status: 'received_invalid_share' }
      )
      resetShareIntent()
      return
    }

    if (lastHandledUrlRef.current === sharedUrl) {
      setShareState((currentState) =>
        currentState.status === 'consumed' ? currentState : { status: 'consumed' }
      )
      resetShareIntent()
      return
    }

    track('share_url_extracted', {
      platform: detectRecipePlatform(sharedUrl),
    })
    setShareState((currentState) =>
      currentState.status === 'received_valid_share' &&
      currentState.url === sharedUrl
        ? currentState
        : { status: 'received_valid_share', url: sharedUrl }
    )
    resetShareIntent()
  }, [
    hasShareIntent,
    resetShareIntent,
    shareIntent.meta?.title,
    shareIntent.text,
    shareIntent.webUrl,
    track,
  ])

  useEffect(() => {
    if (shareState.status === 'received_invalid_share') {
      showSaveRecipeMessage('Could not find a recipe video link in the shared text.')
      setShareState((currentState) =>
        currentState.status === 'consumed' ? currentState : { status: 'consumed' }
      )
      return
    }

    if (shareState.status !== 'received_valid_share') {
      return
    }

    if (lastHandledUrlRef.current === shareState.url) {
      setShareState((currentState) =>
        currentState.status === 'consumed' ? currentState : { status: 'consumed' }
      )
      return
    }

    lastHandledUrlRef.current = shareState.url
    setTimeout(() => {
      if (lastHandledUrlRef.current === shareState.url) {
        lastHandledUrlRef.current = null
      }
    }, 2000)
    openSaveRecipeModal({
      initialUrl: shareState.url,
      source: 'share_intent',
      sourceHint: 'Shared from another app',
    })
    setShareState((currentState) =>
      currentState.status === 'consumed' ? currentState : { status: 'consumed' }
    )
  }, [
    openSaveRecipeModal,
    shareState.status,
    shareState.status === 'received_valid_share' ? shareState.url : null,
    showSaveRecipeMessage,
  ])
}

export function IncomingRecipeShareIntentHandler() {
  useIncomingRecipeShareIntent()

  return null
}
