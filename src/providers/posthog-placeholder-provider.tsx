import { AnalyticsProperties } from '@/config/posthog'
import { ReactNode, createContext, useContext, useMemo } from 'react'

type PostHogPlaceholderContextValue = {
  isEnabled: false
  track: (eventName: string, properties?: AnalyticsProperties) => void
  capture: (eventName: string, properties?: AnalyticsProperties) => void
  identify: (distinctId: string, properties?: AnalyticsProperties) => void
  reset: () => void
}

const PostHogPlaceholderContext =
  createContext<PostHogPlaceholderContextValue>({
    isEnabled: false,
    track: () => undefined,
    capture: () => undefined,
    identify: () => undefined,
    reset: () => undefined,
  })

type Props = {
  children: ReactNode
}

export function PostHogPlaceholderProvider({ children }: Props) {
  const value = useMemo<PostHogPlaceholderContextValue>(
    () => {
      const noop = () => undefined

      return {
        isEnabled: false,
        track: noop,
        capture: noop,
        identify: noop,
        reset: noop,
      }
    },
    []
  )

  return (
    <PostHogPlaceholderContext.Provider value={value}>
      {children}
    </PostHogPlaceholderContext.Provider>
  )
}

export function usePostHog() {
  return useContext(PostHogPlaceholderContext)
}
