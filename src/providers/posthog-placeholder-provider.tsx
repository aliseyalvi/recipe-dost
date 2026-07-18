import type {
  EntryPoint,
  LegacyAnalyticsProperties,
  LegacyEventName,
  PlanInterval,
  ProductEventProperties,
  SourcePlatform,
  SubscriptionTier,
} from '@/lib/analytics/events'
import {
  ANALYTICS_SCHEMA_VERSION,
  canCaptureProductEvent,
  getPostHogEnablement,
  isSafeSupabaseUserId,
  normalizeFailureCode,
  normalizeScreenPath,
  sanitizeEventProperties,
  sanitizePostHogCapture,
  type ProductEventName,
  type SafeScreenName,
} from '@/lib/analytics/policy'
import * as Application from 'expo-application'
import Constants from 'expo-constants'
import { usePathname } from 'expo-router'
import { PostHog, PostHogProvider as SdkPostHogProvider } from 'posthog-react-native'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import { Platform } from 'react-native'

type AnalyticsContextValue = {
  isEnabled: boolean
  isControlledDevTest: boolean
  track: (event: LegacyEventName, properties?: LegacyAnalyticsProperties) => void
  trackEvent: <Name extends ProductEventName>(
    event: Name,
    properties: ProductEventProperties[Name]
  ) => void
  trackScreen: (screenName: SafeScreenName) => void
  identifyUser: (userId: string) => void
  resetAnalyticsUser: () => void
  sendControlledTestEvent: () => Promise<boolean>
}

const noop = () => undefined
const noopAsync = async () => false
const defaultClient: AnalyticsContextValue = {
  isEnabled: false,
  isControlledDevTest: false,
  track: noop,
  trackEvent: noop,
  trackScreen: noop,
  identifyUser: noop,
  resetAnalyticsUser: noop,
  sendControlledTestEvent: noopAsync,
}
const AnalyticsContext = createContext<AnalyticsContextValue>(defaultClient)

let sharedPostHogClient: PostHog | null = null
let sharedPostHogIdentity: string | null = null
let didCaptureAppOpened = false

export function PostHogPlaceholderProvider({ children }: { children: ReactNode }) {
  const runtime = getRuntimeConfig()
  const enablement = getPostHogEnablement(runtime)
  const client = useMemo(() => {
    if (!enablement.enabled) return null
    if (sharedPostHogClient) return sharedPostHogClient

    sharedPostHogClient = new PostHog(runtime.apiKey!, {
      host: runtime.host!,
      captureAppLifecycleEvents: false,
      enableSessionReplay: false,
      disableGeoip: true,
      disableRemoteConfig: true,
      disableRemoteFeatureFlags: true,
      disableSurveys: true,
      preloadFeatureFlags: false,
      sendFeatureFlagEvent: false,
      setDefaultPersonProperties: false,
      personProfiles: 'identified_only',
      errorTracking: {
        autocapture: false,
        exceptionSteps: { enabled: false },
      },
      before_send: sanitizePostHogCapture,
    })
    sharedPostHogClient.register(getCommonProperties(runtime.appEnv!, runtime.appVariant!))
    return sharedPostHogClient
  }, [enablement.enabled, runtime.apiKey, runtime.appEnv, runtime.appVariant, runtime.host])

  const trackEvent = useCallback<AnalyticsContextValue['trackEvent']>(
    (event, properties) => {
      if (
        !client ||
        !canCaptureProductEvent(event, enablement.isControlledDevelopmentTest)
      ) {
        return
      }
      client.capture(event, sanitizeEventProperties(event, properties))
    },
    [client, enablement.isControlledDevelopmentTest]
  )

  const track = useCallback<AnalyticsContextValue['track']>(
    (event, properties) => {
      if (!client || enablement.isControlledDevelopmentTest) return
      const normalized = normalizeLegacyEvent(event, properties)
      if (!normalized) return
      client.capture(
        normalized.event,
        sanitizeEventProperties(normalized.event, normalized.properties)
      )
    },
    [client, enablement.isControlledDevelopmentTest]
  )

  const trackScreen = useCallback<AnalyticsContextValue['trackScreen']>(
    (screenName) => {
      if (!client || enablement.isControlledDevelopmentTest) return
      client.screen(screenName)
    },
    [client, enablement.isControlledDevelopmentTest]
  )

  const identifyUser = useCallback<AnalyticsContextValue['identifyUser']>(
    (userId) => {
      if (!client || !isSafeSupabaseUserId(userId) || sharedPostHogIdentity === userId) {
        return
      }
      if (sharedPostHogIdentity && sharedPostHogIdentity !== userId) client.reset()
      client.identify(userId)
      sharedPostHogIdentity = userId
    },
    [client]
  )

  const resetAnalyticsUser = useCallback(() => {
    if (!client) return
    client.reset()
    sharedPostHogIdentity = null
  }, [client])

  const sendControlledTestEvent = useCallback(async () => {
    if (!client || !enablement.isControlledDevelopmentTest) return false
    trackEvent('posthog_test_event', {
      app_env: 'development',
      platform: normalizePlatform(),
      test_source: 'settings_controlled_test',
      analytics_schema_version: ANALYTICS_SCHEMA_VERSION,
    })
    await client.flush()
    return true
  }, [client, enablement.isControlledDevelopmentTest, trackEvent])

  useEffect(() => {
    if (!client || didCaptureAppOpened) return
    didCaptureAppOpened = true
    trackEvent('app_opened', undefined)
  }, [client, trackEvent])

  const value = useMemo<AnalyticsContextValue>(
    () => ({
      isEnabled: Boolean(client),
      isControlledDevTest: enablement.isControlledDevelopmentTest,
      track,
      trackEvent,
      trackScreen,
      identifyUser,
      resetAnalyticsUser,
      sendControlledTestEvent,
    }),
    [
      client,
      enablement.isControlledDevelopmentTest,
      identifyUser,
      resetAnalyticsUser,
      sendControlledTestEvent,
      track,
      trackEvent,
      trackScreen,
    ]
  )

  const content = (
    <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>
  )

  return client ? (
    <SdkPostHogProvider
      client={client}
      autocapture={{ captureScreens: false, captureTouches: false }}
      debug={false}
    >
      {content}
    </SdkPostHogProvider>
  ) : (
    content
  )
}

export function AnalyticsScreenTracker() {
  const pathname = usePathname()
  const { trackScreen } = usePostHog()
  const previousScreen = useRef<SafeScreenName | null>(null)

  useEffect(() => {
    const screen = normalizeScreenPath(pathname)
    if (!screen || previousScreen.current === screen) return
    previousScreen.current = screen
    trackScreen(screen)
  }, [pathname, trackScreen])

  return null
}

export function usePostHog() {
  return useContext(AnalyticsContext)
}

function getRuntimeConfig() {
  const extra = getExpoExtra()
  return {
    appEnv: getExtraString(extra, 'appEnv'),
    appVariant: getExtraString(extra, 'appVariant'),
    apiKey: process.env.EXPO_PUBLIC_POSTHOG_API_KEY,
    host: process.env.EXPO_PUBLIC_POSTHOG_HOST,
    devTest: process.env.EXPO_PUBLIC_POSTHOG_DEV_TEST,
  }
}

function getCommonProperties(appEnv: string, appVariant: string) {
  const appVersion = Constants.expoConfig?.version ?? Application.nativeApplicationVersion
  const buildNumber =
    Constants.expoConfig?.android?.versionCode?.toString() ??
    Application.nativeBuildVersion

  return {
    app_env: appEnv,
    app_variant: appVariant,
    platform: normalizePlatform(),
    ...(appVersion ? { app_version: appVersion } : {}),
    ...(buildNumber ? { build_number: buildNumber } : {}),
    analytics_schema_version: ANALYTICS_SCHEMA_VERSION,
  }
}

function getExpoExtra() {
  const extra = Constants.expoConfig?.extra
  return extra && typeof extra === 'object' ? (extra as Record<string, unknown>) : {}
}

function getExtraString(extra: Record<string, unknown>, key: string) {
  const value = extra[key]
  return typeof value === 'string' ? value : null
}

function normalizePlatform(): 'android' | 'ios' | 'web' {
  return Platform.OS === 'ios' || Platform.OS === 'web' ? Platform.OS : 'android'
}

function normalizeLegacyEvent(
  event: LegacyEventName,
  properties: LegacyAnalyticsProperties = {}
): { event: ProductEventName; properties?: Record<string, unknown> } | null {
  const sourcePlatform = normalizeSourcePlatform(properties.platform)
  const entryPoint = normalizeEntryPoint(properties.trigger ?? properties.source)
  const planInterval = normalizePlanInterval(properties.selected_plan ?? properties.plan)
  const subscriptionTier = normalizeSubscriptionTier(
    properties.access_plan ?? properties.current_plan,
    properties.premium_active ?? properties.is_premium
  )

  switch (event) {
    case 'onboarding_started':
    case 'onboarding_completed':
    case 'onboarding_skipped':
      return { event }
    case 'save_recipe_modal_opened':
      return { event: 'add_recipe_opened', properties: { entry_point: entryPoint } }
    case 'save_recipe_link_submitted':
    case 'shared_recipe_save_started':
      return {
        event: 'recipe_link_save_started',
        properties: { source_platform: sourcePlatform, entry_point: entryPoint },
      }
    case 'save_recipe_link_saved':
    case 'recipe_link_saved':
    case 'shared_recipe_save_completed':
      return {
        event: 'recipe_link_saved',
        properties: { source_platform: sourcePlatform, entry_point: entryPoint },
      }
    case 'save_recipe_link_failed':
    case 'recipe_link_save_failed':
    case 'shared_recipe_save_failed':
      return {
        event: 'recipe_link_save_failed',
        properties: {
          source_platform: sourcePlatform,
          entry_point: entryPoint,
          failure_code: normalizeFailureCode(
            properties.error_code ?? properties.code ?? properties.reason
          ),
        },
      }
    case 'metadata_refresh_completed':
      return properties.has_error === true || properties.metadata_status === 'failed'
        ? {
            event: 'metadata_preview_failed',
            properties: {
              failure_code: normalizeFailureCode(properties.error_code ?? 'metadata_failed'),
            },
          }
        : {
            event: 'metadata_preview_ready',
            properties: { has_thumbnail: properties.thumbnail_present === true },
          }
    case 'generate_ai_recipe_tapped':
      return {
        event: 'ai_generation_requested',
        properties: {
          source_platform: sourcePlatform,
          entry_point: entryPoint,
          subscription_tier: subscriptionTier,
        },
      }
    case 'media_job_created':
      return {
        event: 'ai_generation_started',
        properties: { source_platform: sourcePlatform, job_status: 'queued' },
      }
    case 'media_job_status_viewed':
      return null
    case 'media_job_completed':
      return {
        event: 'ai_generation_completed',
        properties: { source_platform: sourcePlatform, job_status: 'completed' },
      }
    case 'media_job_failed':
    case 'media_job_create_failed':
      return {
        event: 'ai_generation_failed',
        properties: {
          source_platform: sourcePlatform,
          job_status: 'failed',
          failure_code: normalizeFailureCode(properties.error_code ?? properties.code),
        },
      }
    case 'ai_credit_limit_reached':
      return {
        event: 'ai_generation_blocked',
        properties: {
          entry_point: 'quota_gate',
          subscription_tier: subscriptionTier,
          failure_code: 'quota_reached',
        },
      }
    case 'recipe_result_viewed':
      return {
        event: 'recipe_detail_viewed',
        properties: { has_thumbnail: properties.thumbnail_present === true },
      }
    case 'library_search_used':
      return { event, properties: { result: 'success' } }
    case 'grocery_list_viewed':
      return {
        event: 'grocery_list_opened',
        properties: {
          entry_point: entryPoint,
          language_mode: normalizeLanguageMode(properties.language),
        },
      }
    case 'paywall_viewed':
      return {
        event: 'paywall_opened',
        properties: { entry_point: entryPoint, subscription_tier: subscriptionTier },
      }
    case 'paywall_plan_selected':
      return {
        event,
        properties: {
          entry_point: entryPoint,
          plan_interval: planInterval,
          subscription_tier: subscriptionTier,
        },
      }
    case 'purchase_started':
      return { event, properties: { entry_point: entryPoint, plan_interval: planInterval } }
    case 'purchase_completed':
      return {
        event,
        properties: { entry_point: entryPoint, plan_interval: planInterval, result: 'success' },
      }
    case 'purchase_cancelled':
      return {
        event,
        properties: {
          entry_point: entryPoint,
          plan_interval: planInterval,
          result: 'cancelled',
        },
      }
    case 'purchase_failed':
      return {
        event,
        properties: {
          entry_point: entryPoint,
          plan_interval: planInterval,
          result: 'failure',
          failure_code: normalizeFailureCode(properties.outcome ?? properties.code),
        },
      }
    case 'restore_started':
      return { event, properties: { entry_point: entryPoint } }
    case 'restore_completed':
      return { event, properties: { entry_point: entryPoint, result: 'success' } }
    case 'restore_failed':
      return {
        event,
        properties: {
          entry_point: entryPoint,
          result: 'failure',
          failure_code: 'unknown',
        },
      }
    default:
      return null
  }
}

function normalizeSourcePlatform(value: unknown): SourcePlatform {
  return value === 'instagram' || value === 'tiktok' || value === 'youtube'
    ? value
    : 'unknown'
}

function normalizeEntryPoint(value: unknown): EntryPoint {
  if (typeof value !== 'string') return 'unknown'
  if (value.includes('home')) return 'home'
  if (value.includes('library')) return 'library'
  if (value.includes('grocery')) return 'grocery'
  if (value.includes('settings')) return 'settings'
  if (value.includes('quota') || value.includes('limit')) return 'quota_gate'
  if (value.includes('detail') || value.includes('recipe')) return 'detail'
  if (value.includes('add') || value.includes('save') || value.includes('share')) return 'add'
  return 'unknown'
}

function normalizePlanInterval(value: unknown): PlanInterval {
  if (value === 'monthly' || value === 'yearly') return value
  return 'unknown'
}

function normalizeSubscriptionTier(value: unknown, premium: unknown): SubscriptionTier {
  return value === 'premium' || premium === true ? 'premium' : 'free'
}

function normalizeLanguageMode(value: unknown) {
  if (value === 'ur' || value === 'urdu') return 'urdu' as const
  if (value === 'both') return 'both' as const
  return 'english' as const
}
