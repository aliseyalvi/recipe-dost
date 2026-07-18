import {
  hydrateOnboardingStore,
  useOnboardingStore,
} from '@/features/onboarding/onboarding-store'
import { useCallback, useEffect } from 'react'

export function useOnboardingHydration() {
  const hydrationStatus = useOnboardingStore((state) => state.hydrationStatus)
  const storageKeyStatus = useOnboardingStore((state) => state.storageKeyStatus)
  const error = useOnboardingStore((state) => state.hydrationError)

  useEffect(() => {
    void hydrateOnboardingStore()
  }, [])

  const retry = useCallback(() => hydrateOnboardingStore(true), [])

  return { error, hydrationStatus, retry, storageKeyStatus }
}
