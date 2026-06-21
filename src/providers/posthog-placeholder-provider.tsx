import { AnalyticsProperties } from '@/config/posthog'
import { ReactNode, createContext, use, useMemo } from 'react'

type PostHogPlaceholderContextValue = {
  isEnabled: false
  track: (eventName: string, properties?: AnalyticsProperties) => void
}

const PostHogPlaceholderContext =
  createContext<PostHogPlaceholderContextValue>({
    isEnabled: false,
    track: () => undefined,
  })

type Props = {
  children: ReactNode
}

export function PostHogPlaceholderProvider({ children }: Props) {
  const value = useMemo<PostHogPlaceholderContextValue>(
    () => ({
      isEnabled: false,
      track: () => undefined,
    }),
    []
  )

  return (
    <PostHogPlaceholderContext.Provider value={value}>
      {children}
    </PostHogPlaceholderContext.Provider>
  )
}

export function usePostHog() {
  return use(PostHogPlaceholderContext)
}
