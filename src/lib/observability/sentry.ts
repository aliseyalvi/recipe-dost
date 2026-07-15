import * as Sentry from '@sentry/react-native'
import Constants from 'expo-constants'

type AppEnvironment = 'development' | 'production'
type AppVariant = 'development' | 'preview' | 'production'

type SentryEnvironmentGate = {
  appEnv: AppEnvironment
  appVariant: AppVariant
  devTestOverride: boolean
  dsn: string | null
  transmissionEnabled: boolean
}

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
      beforeSend: sanitizeEvent,
    })

    Sentry.setTags({
      app_env: gate.appEnv,
      app_variant: gate.appVariant,
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

export function isSentryTransmissionAllowed(gate: SentryEnvironmentGate) {
  if (!gate.dsn || !gate.transmissionEnabled) {
    return false
  }

  if (gate.appEnv === 'production') {
    return gate.appVariant === 'production'
  }

  return gate.appVariant === 'development' && gate.devTestOverride
}

function getSentryEnvironmentGate(): SentryEnvironmentGate {
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

function sanitizeEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  return {
    ...event,
    breadcrumbs: undefined,
    contexts: undefined,
    exception: event.exception
      ? {
          values: event.exception.values?.map((exception) => ({
            type: getSafeExceptionType(exception.type),
            value: 'Application error',
            stacktrace: exception.stacktrace
              ? {
                  frames: exception.stacktrace.frames?.map((frame) => ({
                    function: frame.function,
                    in_app: frame.in_app,
                    lineno: frame.lineno,
                    colno: frame.colno,
                  })),
                }
              : undefined,
          })),
        }
      : undefined,
    extra: undefined,
    fingerprint: undefined,
    logentry: undefined,
    message: undefined,
    request: undefined,
    server_name: undefined,
    transaction: undefined,
    user: undefined,
  }
}

function getSafeExceptionType(value: string | undefined) {
  return value && /^[A-Za-z][A-Za-z0-9_.]{0,63}$/.test(value)
    ? value
    : 'Error'
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
