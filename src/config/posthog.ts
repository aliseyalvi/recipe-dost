export type AnalyticsProperties = Record<string, string | number | boolean | null>

export const isPostHogEnabled = false

export const posthog = {
  capture: (_eventName: string, _properties?: AnalyticsProperties) => undefined,
  screen: (_screenName: string, _properties?: AnalyticsProperties) => undefined,
  identify: (_distinctId: string, _properties?: AnalyticsProperties) => undefined,
  reset: () => undefined,
}
