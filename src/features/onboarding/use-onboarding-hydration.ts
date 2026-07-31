import {
  hydrateOnboardingStore,
  useOnboardingStore,
} from '@/features/onboarding/onboarding-store'
import { getLocalOnboardingState } from '@/features/onboarding/welcome-flow-model'
import { useCallback, useEffect } from 'react'

export function useOnboardingHydration() {
  const hydrationStatus = useOnboardingStore((state) => state.hydrationStatus)
  const storageKeyStatus = useOnboardingStore((state) => state.storageKeyStatus)
  const error = useOnboardingStore((state) => state.hydrationError)
  const onboardingCompleted = useOnboardingStore(
    (state) => state.profile.onboardingCompleted
  )

  useEffect(() => {
    void hydrateOnboardingStore()
  }, [])

  const retry = useCallback(() => hydrateOnboardingStore(true), [])

  const onboardingState = getLocalOnboardingState({
    hydrationStatus,
    storageKeyStatus,
    onboardingCompleted,
  })

  return {
    error,
    hydrationStatus,
    onboardingState,
    retry,
    storageKeyStatus,
  }
}
