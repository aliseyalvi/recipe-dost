import { useOnboardingStore } from '@/features/onboarding/onboarding-store'
import { useEffect, useState } from 'react'

export function useOnboardingHydration() {
  const [hasHydrated, setHasHydrated] = useState(
    useOnboardingStore.persist.hasHydrated()
  )

  useEffect(() => {
    const unsubscribeHydrate = useOnboardingStore.persist.onHydrate(() => {
      setHasHydrated(false)
    })
    const unsubscribeFinish = useOnboardingStore.persist.onFinishHydration(
      () => {
        setHasHydrated(true)
      }
    )

    setHasHydrated(useOnboardingStore.persist.hasHydrated())

    return () => {
      unsubscribeHydrate()
      unsubscribeFinish()
    }
  }, [])

  return hasHydrated
}
