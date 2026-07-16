import * as Sentry from '@sentry/react-native'
import Constants from 'expo-constants'
import {
  isSafeSentryUserId,
  isSentryTransmissionAllowed,
  sanitizeSentryEvent,
  type AppEnvironment,
  type AppVariant,
  type SentryEnvironmentGate,
} from '@/lib/observability/sentry-policy'

const sentryState = globalThis as typeof globalThis & {
  __recipeDostSentryInitialized?: boolean
}

export function initializeSentry() {
  const gate = getSentryEnvironmentGate()

  if (!isSentryTransmissionAllowed(gate) || sentryState.__recipeDostSentryInitialized) {
    return false
  }

  try {
    Sentry.init({
      dsn: gate.dsn ?? undefined,
      enabled: true,
      environment: gate.appEnv,
      sendDefaultPii: false,
      debug: false,
      tracesSampleRate: 0,
      enableAutoPerformanceTracing: false,
      enableCaptureFailedRequests: false,
      attachScreenshot: false,
      attachViewHierarchy: false,
      maxBreadcrumbs: 0,
      beforeBreadcrumb: () => null,
      beforeSend: (event) =>
        sanitizeSentryEvent(event) as unknown as Sentry.ErrorEvent,
    })

    Sentry.setTags({
      app_env: gate.appEnv,
      app_variant: gate.appVariant,
      ...(Constants.expoConfig?.version
        ? { app_version: Constants.expoConfig.version }
        : {}),
      ...(Constants.expoConfig?.android?.versionCode
        ? { build_number: String(Constants.expoConfig.android.versionCode) }
        : {}),
    })
    sentryState.__recipeDostSentryInitialized = true
    return true
  } catch {
    return false
  }
}

export function captureSentryException(error: unknown) {
  if (
    !sentryState.__recipeDostSentryInitialized ||
    !isSentryTransmissionAllowed(getSentryEnvironmentGate())
  ) {
    return undefined
  }

  return Sentry.captureException(normalizeError(error))
}

export function reportError(error: unknown) {
  return captureSentryException(error)
}

export function setSentryUser(userId: string | null) {
  if (!sentryState.__recipeDostSentryInitialized) return
  Sentry.setUser(userId && isSafeSentryUserId(userId) ? { id: userId } : null)
}

export function getSentryEnvironmentGate(): SentryEnvironmentGate {
  const appEnv = getAppEnvironment()
  const appVariant = getAppVariant(appEnv)
  const devTestOverride = process.env.EXPO_PUBLIC_SENTRY_DEV_TEST === 'true'

  return {
    appEnv,
    appVariant,
    devTestOverride,
    dsn: getSentryDsn(),
    transmissionEnabled:
      getExpoExtraBoolean('sentryTransmissionEnabled') === true,
  }
}

function getAppEnvironment(): AppEnvironment {
  return getExpoExtraString('appEnv') === 'production'
    ? 'production'
    : 'development'
}

function getAppVariant(appEnv: AppEnvironment): AppVariant {
  const appVariant = getExpoExtraString('appVariant')

  if (
    appVariant === 'development' ||
    appVariant === 'preview' ||
    appVariant === 'production'
  ) {
    return appVariant
  }

  return appEnv
}

function getSentryDsn() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim()

  if (!dsn) {
    return null
  }

  try {
    const parsedDsn = new URL(dsn)

    return parsedDsn.protocol === 'https:' && parsedDsn.hostname ? dsn : null
  } catch {
    return null
  }
}

function getExpoExtraString(key: string) {
  const value = getExpoExtra()[key]

  return typeof value === 'string' ? value : null
}

function getExpoExtraBoolean(key: string) {
  const value = getExpoExtra()[key]

  return typeof value === 'boolean' ? value : null
}

function getExpoExtra() {
  const extra = Constants.expoConfig?.extra

  return extra && typeof extra === 'object'
    ? (extra as Record<string, unknown>)
    : {}
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return error
  }

  return new Error('Non-Error value thrown')
}
