import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import type { AppStateStatus } from 'react-native'

type Options = {
  enabled: boolean
  minIntervalMs?: number
  refetch: () => unknown
}

export function useRefetchOnAppForeground({
  enabled,
  minIntervalMs = 2_000,
  refetch,
}: Options) {
  const enabledRef = useRef(enabled)
  const lastRefetchAtRef = useRef(0)
  const previousStateRef = useRef<AppStateStatus>(AppState.currentState)
  const refetchRef = useRef(refetch)

  useEffect(() => {
    enabledRef.current = enabled
    refetchRef.current = refetch
  }, [enabled, refetch])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = previousStateRef.current
      previousStateRef.current = nextState

      if (
        !enabledRef.current ||
        nextState !== 'active' ||
        previousState === 'active'
      ) {
        return
      }

      const now = Date.now()

      if (now - lastRefetchAtRef.current < minIntervalMs) {
        return
      }

      lastRefetchAtRef.current = now
      void refetchRef.current()
    })

    return () => {
      subscription.remove()
    }
  }, [minIntervalMs])
}
