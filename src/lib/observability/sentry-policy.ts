export type AppEnvironment = 'development' | 'production'
export type AppVariant = 'development' | 'preview' | 'production'

export type SentryEnvironmentGate = {
  appEnv: AppEnvironment
  appVariant: AppVariant
  devTestOverride: boolean
  dsn: string | null
  transmissionEnabled: boolean
}

type SentryEventLike = {
  [key: string]: unknown
  breadcrumbs?: unknown
  contexts?: unknown
  exception?: {
    values?: Array<{
      type?: string
      value?: string
      stacktrace?: {
        frames?: Array<Record<string, unknown>>
      }
    }>
  }
  extra?: unknown
  fingerprint?: unknown
  logentry?: unknown
  message?: unknown
  request?: unknown
  server_name?: unknown
  tags?: Record<string, unknown>
  transaction?: unknown
  user?: Record<string, unknown>
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SAFE_TAG_KEYS = new Set([
  'app_env',
  'app_variant',
  'app_version',
  'build_number',
])
const EXPECTED_FAILURE_MARKERS = [
  'invalid',
  'unsupported',
  'not_found',
  'unavailable',
  'deleted',
  'private',
  'quota',
  'limit_reached',
  'rate_limit',
  'cancel',
  'safety',
  'duration',
  'size_exceeded',
  'structured_extraction',
  'quality_gate',
  'tags_invalid',
]

export function isSentryTransmissionAllowed(gate: SentryEnvironmentGate) {
  if (!gate.dsn || !gate.transmissionEnabled) {
    return false
  }

  if (gate.appEnv === 'production') {
    return gate.appVariant === 'production'
  }

  return gate.appVariant === 'development' && gate.devTestOverride
}

export function isSafeSentryUserId(value: string | null | undefined) {
  return UUID_PATTERN.test(value ?? '')
}

export function getSentryIdentityAction(
  previousUserId: string | null,
  nextUserId: string | null
): 'set' | 'clear' | 'none' {
  if (nextUserId && nextUserId !== previousUserId && isSafeSentryUserId(nextUserId)) {
    return 'set'
  }
  if (previousUserId && !nextUserId) return 'clear'
  return 'none'
}

export function isUnexpectedTechnicalFailureCode(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() || 'unknown'
  return !EXPECTED_FAILURE_MARKERS.some((marker) => normalized.includes(marker))
}

export function sanitizeSentryEvent(event: object): SentryEventLike {
  const source = event as SentryEventLike
  const sanitized: SentryEventLike = {}
  if (typeof source.event_id === 'string' && /^[a-f0-9]{32}$/i.test(source.event_id)) {
    sanitized.event_id = source.event_id
  }
  if (typeof source.timestamp === 'number' || typeof source.timestamp === 'string') {
    sanitized.timestamp = source.timestamp
  }
  if (source.platform === 'javascript' || source.platform === 'native') {
    sanitized.platform = source.platform
  }
  if (source.level === 'error' || source.level === 'fatal') sanitized.level = source.level
  if (source.environment === 'development' || source.environment === 'production') {
    sanitized.environment = source.environment
  }
  if (typeof source.release === 'string' && /^[A-Za-z0-9_.@+-]{1,160}$/.test(source.release)) {
    sanitized.release = source.release
  }
  if (typeof source.dist === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(source.dist)) {
    sanitized.dist = source.dist
  }
  sanitized.tags = sanitizeTags(source.tags)
  sanitized.exception = source.exception
    ? {
        values: source.exception.values?.map((exception) => ({
          type: getSafeExceptionType(exception.type),
          value: 'Application error',
          stacktrace: exception.stacktrace
            ? {
                frames: exception.stacktrace.frames?.map(sanitizeStackFrame),
              }
            : undefined,
        })),
      }
    : undefined
  sanitized.user = isSafeSentryUserId(source.user?.id as string | undefined)
    ? { id: source.user?.id }
    : undefined

  return sanitized
}

function sanitizeStackFrame(frame: Record<string, unknown>) {
  return {
    filename: sanitizeFramePath(frame.filename),
    abs_path: sanitizeFramePath(frame.abs_path),
    function: getSafeFrameName(frame.function),
    module: getSafeFrameName(frame.module),
    in_app: typeof frame.in_app === 'boolean' ? frame.in_app : undefined,
    lineno: typeof frame.lineno === 'number' ? frame.lineno : undefined,
    colno: typeof frame.colno === 'number' ? frame.colno : undefined,
  }
}

function sanitizeFramePath(value: unknown) {
  if (typeof value !== 'string' || !value) return undefined
  const withoutQuery = value.split(/[?#]/, 1)[0]?.replace(/\\/g, '/')
  const basename = withoutQuery?.split('/').filter(Boolean).at(-1)
  return basename && /^[A-Za-z0-9_.-]{1,120}$/.test(basename) ? basename : undefined
}

function sanitizeTags(tags: Record<string, unknown> | undefined) {
  if (!tags) return undefined
  const sanitized = Object.fromEntries(
    Object.entries(tags).filter(
      ([key, value]) =>
        SAFE_TAG_KEYS.has(key) &&
        (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    )
  )
  return Object.keys(sanitized).length ? sanitized : undefined
}

function getSafeExceptionType(value: string | undefined) {
  return value && /^[A-Za-z][A-Za-z0-9_.]{0,63}$/.test(value) ? value : 'Error'
}

function getSafeFrameName(value: unknown) {
  return typeof value === 'string' && /^[A-Za-z_$][A-Za-z0-9_.$<>-]{0,127}$/.test(value)
    ? value
    : undefined
}
