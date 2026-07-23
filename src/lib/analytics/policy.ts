import type { CaptureEvent } from '@posthog/core'

export const ANALYTICS_SCHEMA_VERSION = '1'

const SUBSCRIPTION_RECONCILIATION_KEYS = [
  'trigger',
  'local_entitlement_active',
  'backend_premium_active',
  'expiration_relation',
  'provider_environment',
  'sync_result',
  'normalized_error_code',
  'latency_bucket',
] as const

export const PRODUCT_EVENT_SCHEMAS = {
  app_opened: [],
  onboarding_started: [],
  onboarding_completed: [],
  onboarding_skipped: [],
  account_deletion_completed: [],
  ai_recipe_report_submitted: ['category'],
  legal_link_opened: [],
  add_recipe_opened: ['entry_point'],
  recipe_link_save_started: ['source_platform', 'entry_point'],
  recipe_link_saved: ['source_platform', 'entry_point'],
  recipe_link_save_failed: ['source_platform', 'entry_point', 'failure_code'],
  metadata_preview_ready: ['has_thumbnail'],
  metadata_preview_failed: ['failure_code'],
  ai_generation_requested: ['source_platform', 'entry_point', 'subscription_tier'],
  ai_generation_started: ['source_platform', 'job_status'],
  ai_generation_completed: ['source_platform', 'job_status', 'has_thumbnail'],
  ai_generation_failed: ['source_platform', 'job_status', 'failure_code'],
  ai_generation_blocked: ['entry_point', 'subscription_tier', 'failure_code'],
  recipe_detail_viewed: ['has_thumbnail'],
  library_search_used: ['result'],
  grocery_list_opened: ['entry_point', 'language_mode'],
  paywall_opened: ['entry_point', 'subscription_tier'],
  paywall_plan_selected: ['entry_point', 'plan_interval', 'subscription_tier'],
  purchase_started: ['entry_point', 'plan_interval'],
  purchase_completed: ['entry_point', 'plan_interval', 'result'],
  purchase_cancelled: ['entry_point', 'plan_interval', 'result'],
  purchase_failed: ['entry_point', 'plan_interval', 'result', 'failure_code'],
  restore_started: ['entry_point'],
  restore_completed: ['entry_point', 'result'],
  restore_failed: ['entry_point', 'result', 'failure_code'],
  subscription_refresh_started: SUBSCRIPTION_RECONCILIATION_KEYS,
  subscription_refresh_completed: SUBSCRIPTION_RECONCILIATION_KEYS,
  subscription_refresh_failed: SUBSCRIPTION_RECONCILIATION_KEYS,
  subscription_restore_started: SUBSCRIPTION_RECONCILIATION_KEYS,
  subscription_restore_completed: SUBSCRIPTION_RECONCILIATION_KEYS,
  subscription_restore_no_entitlement: SUBSCRIPTION_RECONCILIATION_KEYS,
  subscription_restore_failed: SUBSCRIPTION_RECONCILIATION_KEYS,
  subscription_state_transition: [
    ...SUBSCRIPTION_RECONCILIATION_KEYS,
    'state_before',
    'state_after',
  ],
  purchase_reconciliation_started: SUBSCRIPTION_RECONCILIATION_KEYS,
  purchase_reconciliation_completed: SUBSCRIPTION_RECONCILIATION_KEYS,
  purchase_reconciliation_failed: SUBSCRIPTION_RECONCILIATION_KEYS,
  posthog_test_event: [
    'app_env',
    'platform',
    'test_source',
    'analytics_schema_version',
  ],
  $screen: ['$screen_name'],
} as const

export type ProductEventName = keyof typeof PRODUCT_EVENT_SCHEMAS
export type SafeScreenName = (typeof SAFE_SCREEN_NAMES)[number]
export type AnalyticsScalar = string | number | boolean
export type SanitizedProperties = Record<string, AnalyticsScalar>

export type AnalyticsRuntimeConfig = {
  appEnv: string | null | undefined
  appVariant: string | null | undefined
  apiKey: string | null | undefined
  host: string | null | undefined
  devTest: string | null | undefined
}

export const SAFE_SCREEN_NAMES = [
  'home',
  'add_recipe',
  'library',
  'saved_link_detail',
  'ai_recipe_detail',
  'grocery',
  'grocery_list_detail',
  'settings',
  'paywall',
  'onboarding',
] as const

const COMMON_PROPERTY_KEYS = [
  'app_env',
  'app_variant',
  'platform',
  'app_version',
  'build_number',
  'update_channel',
  'analytics_schema_version',
] as const

const SAFE_SENSITIVE_PROPERTY_KEYS = new Set([
  'local_entitlement_active',
  'normalized_error_code',
])

const SDK_PROPERTY_KEYS = new Set([
  'token',
  'distinct_id',
  '$anon_distinct_id',
  '$device_id',
  '$session_id',
  '$lib',
  '$lib_version',
  '$app_version',
  '$app_build',
  '$os_name',
  '$device_type',
  '$is_emulator',
  '$geoip_disable',
])

const SENSITIVE_KEY_PATTERN =
  /(email|phone|name|title|creator|url|uri|link|ingredient|recipe|caption|note|prompt|response|message|error|stack|token|secret|authorization|cookie|receipt|transaction|customer|package|product|search|query|path)/i
const URL_VALUE_PATTERN =
  /(?:https?:\/\/|www\.|[a-z][a-z0-9+.-]*:\/\/|\b[a-z0-9-]+\.(?:com|net|org|io|co|app|dev)(?:\b|\/))/i
const TOKEN_VALUE_PATTERN =
  /(?:\bauthorization\b|\bbearer\s+|\bapi[_ -]?key\b|\btoken\b|\bsecret\b|\beyJ[A-Za-z0-9_-]{8,})/i
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_STRING_LENGTH = 80

export function isValidPostHogApiKey(value: string | null | undefined) {
  const key = value?.trim() ?? ''
  return key.startsWith('phc_') && key.length >= 20 && !/^phc_YOUR/i.test(key)
}

export function isValidPostHogHost(value: string | null | undefined) {
  const host = value?.trim() ?? ''
  if (!host) return false

  try {
    const url = new URL(host)
    return (
      url.protocol === 'https:' &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password &&
      url.pathname.replace(/\/+$/, '') === ''
    )
  } catch {
    return false
  }
}

export function getPostHogEnablement(config: AnalyticsRuntimeConfig) {
  const hasValidProject =
    isValidPostHogApiKey(config.apiKey) && isValidPostHogHost(config.host)
  const isProduction =
    config.appEnv === 'production' && config.appVariant === 'production'
  const isControlledDevelopmentTest =
    config.appEnv === 'development' &&
    config.appVariant === 'development' &&
    config.devTest === 'true'

  return {
    enabled: hasValidProject && (isProduction || isControlledDevelopmentTest),
    isControlledDevelopmentTest:
      hasValidProject && isControlledDevelopmentTest,
    isProduction,
    hasValidProject,
  }
}

export function isAllowedProductEvent(value: string): value is ProductEventName {
  return Object.hasOwn(PRODUCT_EVENT_SCHEMAS, value)
}

export function canCaptureProductEvent(
  eventName: ProductEventName,
  isControlledDevelopmentTest: boolean
) {
  return !isControlledDevelopmentTest || eventName === 'posthog_test_event'
}

export function sanitizeEventProperties(
  eventName: string,
  properties: unknown,
  options: { preserveSdkProperties?: boolean } = {}
): SanitizedProperties {
  if (!isAllowedProductEvent(eventName) || !isPlainObject(properties)) return {}

  const allowedKeys = new Set<string>([
    ...COMMON_PROPERTY_KEYS,
    ...PRODUCT_EVENT_SCHEMAS[eventName],
  ])
  const sanitized: SanitizedProperties = {}

  for (const [key, value] of Object.entries(properties)) {
    const isSdkProperty = options.preserveSdkProperties && SDK_PROPERTY_KEYS.has(key)
    if (!allowedKeys.has(key) && !isSdkProperty) {
      continue
    }
    if (
      !isSdkProperty &&
      key !== '$screen_name' &&
      !SAFE_SENSITIVE_PROPERTY_KEYS.has(key) &&
      SENSITIVE_KEY_PATTERN.test(key)
    ) {
      continue
    }
    if (!isSafeScalar(value)) continue
    if (typeof value === 'string') {
      const normalized = value.trim()
      if (
        !normalized ||
        normalized.length > MAX_STRING_LENGTH ||
        URL_VALUE_PATTERN.test(normalized) ||
        TOKEN_VALUE_PATTERN.test(normalized)
      ) {
        continue
      }
      sanitized[key] = normalized
      continue
    }
    sanitized[key] = value
  }

  return sanitized
}


export function sanitizePostHogCapture(capture: CaptureEvent | null): CaptureEvent | null {
  if (!capture) return null
  if (capture.event === '$identify' && isPlainObject(capture.properties)) {
    const properties = Object.fromEntries(
      Object.entries(capture.properties).filter(
        ([key, value]) => SDK_PROPERTY_KEYS.has(key) && isSafeScalar(value)
      )
    )
    return { ...capture, properties, $set: undefined, $set_once: undefined }
  }
  if (typeof capture.event !== 'string' || !isAllowedProductEvent(capture.event)) {
    return null
  }

  return {
    ...capture,
    properties: sanitizeEventProperties(capture.event, capture.properties, {
      preserveSdkProperties: true,
    }),
  }
}

export function normalizeScreenPath(pathname: string): SafeScreenName | null {
  const path = pathname.split('?')[0]?.replace(/\/+$/, '') || '/'
  if (/^\/(?:\(tabs\)\/)?home$/.test(path)) return 'home'
  if (/^\/(?:save-recipe|share-recipe|recipe\/preview)$/.test(path)) return 'add_recipe'
  if (/^\/(?:\(tabs\)\/)?library$/.test(path)) return 'library'
  if (/^\/recipe\/[^/]+$/.test(path)) return 'saved_link_detail'
  if (/^\/(?:recipe-card\/[^/]+|recipe\/ready)$/.test(path)) return 'ai_recipe_detail'
  if (/^\/(?:\(tabs\)\/)?grocery$/.test(path)) return 'grocery'
  if (/^\/grocery\/[^/]+$/.test(path)) return 'grocery_list_detail'
  if (/^\/(?:\(tabs\)\/)?settings(?:\/[^/]+)?$/.test(path)) return 'settings'
  if (path === '/paywall') return 'paywall'
  if (/^\/(?:welcome|onboarding)$/.test(path)) return 'onboarding'
  return null
}

export function isSafeSupabaseUserId(value: string | null | undefined) {
  return UUID_PATTERN.test(value ?? '')
}

export function getAnalyticsIdentityAction(
  previousUserId: string | null,
  nextUserId: string | null
): 'identify' | 'reset' | 'none' {
  if (nextUserId && nextUserId !== previousUserId && isSafeSupabaseUserId(nextUserId)) {
    return 'identify'
  }
  if (previousUserId && !nextUserId) return 'reset'
  return 'none'
}

export function normalizeFailureCode(value: unknown) {
  if (typeof value !== 'string') return 'unknown'
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
  const allowed = new Set([
    'already_subscribed',
    'auth_required',
    'backend_access_pending',
    'duplicate',
    'entitlement_not_active',
    'invalid_link',
    'limit_reached',
    'metadata_failed',
    'network',
    'not_configured',
    'product_unavailable',
    'quota_reached',
    'save_failed',
    'timeout',
    'unknown',
    'video_duration_exceeded',
    'worker_timeout',
  ])
  return allowed.has(normalized) ? normalized : 'unknown'
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isSafeScalar(value: unknown): value is AnalyticsScalar {
  return (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  )
}
