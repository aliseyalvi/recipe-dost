export const TEMPORARY_SOURCE_DURATION_FALLBACK_SECONDS = 180

type NullableNumber = number | null | undefined

export type DurationSemanticsInput = {
  source_video_duration_seconds?: NullableNumber
  recipe_total_minutes?: NullableNumber
  duration_semantics_version?: NullableNumber
  duration_seconds?: NullableNumber
}

export type MediaJobDurationInput = {
  actual_duration_seconds?: NullableNumber
  media_duration_seconds?: NullableNumber
  max_duration_seconds?: NullableNumber
  max_source_video_duration_seconds?: NullableNumber
}

export type ResolvedDurationSemantics = {
  sourceVideoDurationSeconds: number | null
  recipeTotalMinutes: number | null
}

export type MediaCtaState =
  | {
      kind: 'generate'
      enabled: true
      label: 'Generate AI Recipe'
      message: null
    }
  | {
      kind: 'retry'
      enabled: true
      label: 'Retry AI Recipe Generation'
      message: null
      jobId: string
    }
  | {
      kind: 'processing'
      enabled: false
      label: 'Preparing AI Recipe…'
      message: string
      jobId: string
    }
  | {
      kind: 'duration_blocked'
      enabled: false
      label: 'Generate AI Recipe'
      message: string
    }
  | {
      kind: 'failure_blocked'
      enabled: false
      label: 'Retry AI Recipe Generation'
      message: string
      jobId: string
    }
  | {
      kind: 'completed'
      enabled: false
      label: 'AI Recipe Ready'
      message: null
      jobId: string
    }

export type MediaCtaStateInput = {
  jobId?: string | null
  jobStatus?: string | null
  retryable?: boolean | null
  retryBlockReason?: string | null
  sourceVideoDurationSeconds?: NullableNumber
  maxDurationSeconds?: NullableNumber
  maxSourceVideoDurationSeconds?: NullableNumber
  hasRecipeCard?: boolean
}

/**
 * Temporary compatibility policy for responses that predate a backend-supplied
 * source-video maximum. Keep the fallback in this module only.
 */
export function getEffectiveSourceDurationLimitSeconds({
  maxDurationSeconds,
  maxSourceVideoDurationSeconds,
}: {
  maxDurationSeconds?: NullableNumber
  maxSourceVideoDurationSeconds?: NullableNumber
}) {
  return (
    positiveWholeNumber(maxDurationSeconds) ??
    positiveWholeNumber(maxSourceVideoDurationSeconds) ??
    TEMPORARY_SOURCE_DURATION_FALLBACK_SECONDS
  )
}

export function resolveDurationSemantics(
  recipe: DurationSemanticsInput | null | undefined,
  mediaJob?: MediaJobDurationInput | null
): ResolvedDurationSemantics {
  const sourceVideoDurationSeconds =
    positiveWholeNumber(recipe?.source_video_duration_seconds) ??
    positiveWholeNumber(mediaJob?.actual_duration_seconds) ??
    positiveWholeNumber(mediaJob?.media_duration_seconds)

  return {
    sourceVideoDurationSeconds,
    recipeTotalMinutes: positiveWholeNumber(recipe?.recipe_total_minutes),
  }
}

export function selectMediaCtaState(input: MediaCtaStateInput): MediaCtaState {
  const sourceDuration = positiveWholeNumber(
    input.sourceVideoDurationSeconds
  )
  const limit = getEffectiveSourceDurationLimitSeconds({
    maxDurationSeconds: input.maxDurationSeconds,
    maxSourceVideoDurationSeconds: input.maxSourceVideoDurationSeconds,
  })

  if (sourceDuration !== null && sourceDuration > limit) {
    return {
      kind: 'duration_blocked',
      enabled: false,
      label: 'Generate AI Recipe',
      message: getDurationLimitMessage(sourceDuration, limit).body,
    }
  }

  if (!input.jobId || !input.jobStatus) {
    return {
      kind: 'generate',
      enabled: true,
      label: 'Generate AI Recipe',
      message: null,
    }
  }

  if (input.hasRecipeCard || input.jobStatus === 'completed') {
    return {
      kind: 'completed',
      enabled: false,
      label: 'AI Recipe Ready',
      message: null,
      jobId: input.jobId,
    }
  }

  if (isActiveMediaJobStatus(input.jobStatus)) {
    return {
      kind: 'processing',
      enabled: false,
      label: 'Preparing AI Recipe…',
      message: getProcessingMessage(input.jobStatus),
      jobId: input.jobId,
    }
  }

  if (isFailedMediaJobStatus(input.jobStatus)) {
    if (input.retryable === true) {
      return {
        kind: 'retry',
        enabled: true,
        label: 'Retry AI Recipe Generation',
        message: null,
        jobId: input.jobId,
      }
    }

    return {
      kind: 'failure_blocked',
      enabled: false,
      label: 'Retry AI Recipe Generation',
      message: getSafeRetryBlockMessage(input.retryBlockReason),
      jobId: input.jobId,
    }
  }

  return {
    kind: 'processing',
    enabled: false,
    label: 'Preparing AI Recipe…',
    message: 'This AI recipe request is already in progress.',
    jobId: input.jobId,
  }
}

export function getDurationLimitMessage(
  actualDurationSeconds: NullableNumber,
  maxDurationSeconds: NullableNumber
) {
  const actual = positiveWholeNumber(actualDurationSeconds)
  const max =
    positiveWholeNumber(maxDurationSeconds) ??
    TEMPORARY_SOURCE_DURATION_FALLBACK_SECONDS
  const supportedCopy = `Recipe Dost currently supports videos up to ${formatDurationWords(max)}.`

  return {
    title: 'Video is too long',
    body:
      actual === null
        ? supportedCopy
        : `This video is ${formatDurationWords(actual)}. ${supportedCopy}`,
  }
}

export function formatDurationWords(value: number) {
  const totalSeconds = Math.max(0, Math.round(value))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const parts: string[] = []

  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`)
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`)
  }

  return parts.join(' ')
}

export function formatSourceDurationSeconds(value: number) {
  const totalSeconds = Math.max(0, Math.round(value))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function formatRecipeDurationMinutes(value: number) {
  const totalMinutes = Math.max(0, Math.round(value))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) {
    return `${totalMinutes}m`
  }

  return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`
}

export function getSafeRetryBlockMessage(reason: string | null | undefined) {
  switch (reason) {
    case 'retry_limit_reached':
      return 'This AI recipe has reached its retry limit.'
    case 'non_retryable_input':
      return 'This source cannot be retried. Review the original video or add recipe details manually.'
    case 'completed_job':
    case 'result_already_exists':
      return 'This AI recipe is already complete.'
    case 'active_job':
    case 'already_queued':
      return 'This AI recipe is already queued or processing.'
    case 'ownership_denied':
    case 'job_not_found':
      return 'This AI recipe job is no longer available to retry.'
    default:
      return 'This AI recipe cannot be retried safely.'
  }
}

function positiveWholeNumber(value: NullableNumber) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : null
}

function isActiveMediaJobStatus(status: string) {
  return [
    'queued',
    'processing',
    'pending',
    'running',
    'resolving',
    'downloading',
    'validating',
    'thumbnailing',
    'uploading_to_ai',
    'analyzing',
    'saving_result',
  ].includes(status)
}

function isFailedMediaJobStatus(status: string) {
  return (
    status === 'failed' ||
    status === 'cancelled' ||
    status === 'needs_caption'
  )
}

function getProcessingMessage(status: string) {
  return status === 'queued'
    ? 'This AI recipe is queued and will start shortly.'
    : 'This AI recipe is already being prepared.'
}
