import { AnalyticsProperties } from '@/config/posthog'
import { ReactNode, createContext, use } from 'react'

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
  return (
    <PostHogPlaceholderContext.Provider
      value={{
        isEnabled: false,
        track: () => undefined,
      }}
    >
      {children}
    </PostHogPlaceholderContext.Provider>
  )
}

export function usePostHog() {
  return use(PostHogPlaceholderContext)
}
