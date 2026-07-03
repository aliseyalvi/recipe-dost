export const FRIENDLY_NETWORK_ERROR_MESSAGE =
  'You seem to be offline. Check your internet and try again.'

const NETWORK_ERROR_PATTERNS = [
  'unknownhostexception',
  'network request failed',
  'fetch failed',
  'failed to fetch',
  'timeout',
  'timed out',
  'offline',
  'unreachable',
]

export function isLikelyNetworkError(error: unknown) {
  const text = getErrorText(error).toLowerCase()

  return NETWORK_ERROR_PATTERNS.some((pattern) => text.includes(pattern))
}

export function getFriendlyApiErrorMessage(error: unknown, fallback: string) {
  return isLikelyNetworkError(error) ? FRIENDLY_NETWORK_ERROR_MESSAGE : fallback
}

export function toFriendlyApiError(error: unknown, fallback: string) {
  return new Error(getFriendlyApiErrorMessage(error, fallback))
}

function getErrorText(error: unknown): string {
  if (error instanceof Error) {
    const causeText = 'cause' in error ? getErrorText(error.cause) : ''

    return [error.name, error.message, causeText].filter(Boolean).join(' ')
  }

  if (typeof error === 'string') {
    return error
  }

  if (!error || typeof error !== 'object') {
    return ''
  }

  const record = error as Record<string, unknown>

  return [
    getString(record.name),
    getString(record.code),
    getString(record.message),
    getString(record.details),
    getString(record.hint),
    getErrorText(record.cause),
  ]
    .filter(Boolean)
    .join(' ')
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : ''
}
