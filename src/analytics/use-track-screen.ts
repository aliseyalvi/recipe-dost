import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { usePathname } from 'expo-router'
import { useEffect } from 'react'

export function useTrackScreen(screenName: string) {
  const pathname = usePathname()
  const { track } = usePostHog()

  useEffect(() => {
    track('screen_viewed', {
      screen_name: screenName,
      path: pathname,
    })
  }, [pathname, screenName, track])
}
