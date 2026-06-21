import { createContext, useContext, type ReactNode } from 'react'

type AnalyticsProperties = Record<
  string,
  string | number | boolean | null | undefined
>

type PostHogPlaceholderClient = {
  isEnabled: false
  track: (event: string, properties?: AnalyticsProperties) => void
  capture: (event: string, properties?: AnalyticsProperties) => void
  identify: (userId: string, properties?: AnalyticsProperties) => void
  reset: () => void
}

const noop = () => undefined

const defaultClient: PostHogPlaceholderClient = {
  isEnabled: false,
  track: noop,
  capture: noop,
  identify: noop,
  reset: noop,
}

const PostHogPlaceholderContext =
  createContext<PostHogPlaceholderClient>(defaultClient)

export function PostHogPlaceholderProvider({
  children,
}: {
  children: ReactNode
}) {
  return (
    <PostHogPlaceholderContext.Provider value={defaultClient}>
      {children}
    </PostHogPlaceholderContext.Provider>
  )
}

export function usePostHog() {
  return useContext(PostHogPlaceholderContext)
}
