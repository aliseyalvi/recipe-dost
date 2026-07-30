import type {
  ActiveMediaJob,
  MediaJob,
  RecipeLibraryItem,
} from '@/lib/api/recipes'

export const CANONICAL_ACTIVE_MEDIA_JOB_STATUSES = [
  'resolving',
  'downloading',
  'analyzing',
  'queued',
] as const

export type CanonicalActiveMediaJobStatus =
  (typeof CANONICAL_ACTIVE_MEDIA_JOB_STATUSES)[number]

type ActiveJobOrderingFields = Pick<
  ActiveMediaJob,
  'id' | 'status' | 'created_at' | 'started_at'
>

export function isCanonicalActiveMediaJobStatus(
  status: string | null | undefined
): status is CanonicalActiveMediaJobStatus {
  return CANONICAL_ACTIVE_MEDIA_JOB_STATUSES.some(
    (activeStatus) => activeStatus === status
  )
}

export function compareActiveMediaJobs(
  left: ActiveJobOrderingFields,
  right: ActiveJobOrderingFields
) {
  const priorityDifference =
    getActiveJobPriority(left.status) - getActiveJobPriority(right.status)

  if (priorityDifference !== 0) {
    return priorityDifference
  }

  const leftTimestamp =
    left.status === 'queued'
      ? getTimestampMs(left.created_at)
      : getTimestampMs(left.started_at ?? left.created_at)
  const rightTimestamp =
    right.status === 'queued'
      ? getTimestampMs(right.created_at)
      : getTimestampMs(right.started_at ?? right.created_at)

  return leftTimestamp - rightTimestamp || left.id.localeCompare(right.id)
}

export function getActiveMediaJobStatusLabel(
  status: CanonicalActiveMediaJobStatus
) {
  switch (status) {
    case 'resolving':
      return 'Preparing'
    case 'downloading':
      return 'Downloading'
    case 'analyzing':
      return 'Generating'
    case 'queued':
      return 'Queued'
  }
}

export function compareLibraryRecentItems(
  left: RecipeLibraryItem,
  right: RecipeLibraryItem
) {
  const priorityDifference =
    getLibraryItemPriority(left) - getLibraryItemPriority(right)

  if (priorityDifference !== 0) {
    return priorityDifference
  }

  const leftJob = left.latest_media_job
  const rightJob = right.latest_media_job

  if (isProcessingJob(leftJob) && isProcessingJob(rightJob)) {
    return compareProcessingJobs(leftJob, rightJob)
  }

  if (leftJob?.status === 'queued' && rightJob?.status === 'queued') {
    return (
      getTimestampMs(leftJob.created_at) -
        getTimestampMs(rightJob.created_at) ||
      leftJob.id.localeCompare(rightJob.id)
    )
  }

  return (
    getLibraryActivityMs(right) - getLibraryActivityMs(left) ||
    left.id.localeCompare(right.id)
  )
}

export function selectHomeRecentItems(
  items: RecipeLibraryItem[],
  activeJobs: ActiveMediaJob[]
) {
  const activeRecipeIds = new Set(
    activeJobs
      .map((job) => job.recipe_item_id)
      .filter((id): id is string => Boolean(id))
  )
  const activeResultIds = new Set(
    activeJobs
      .map((job) => job.result_recipe_card_id)
      .filter((id): id is string => Boolean(id))
  )
  const seenRecipeCardIds = new Set<string>()

  return [...items]
    .filter((item) => {
      if (
        activeRecipeIds.has(item.id) ||
        isCanonicalActiveMediaJobStatus(item.latest_media_job?.status) ||
        isFailedItem(item) ||
        item.metadata_status === 'saving' ||
        item.metadata_status === 'pending'
      ) {
        return false
      }

      const recipeCardId =
        item.latest_card?.id ?? item.latest_media_job?.result_recipe_card_id

      return !recipeCardId || !activeResultIds.has(recipeCardId)
    })
    .sort(
      (left, right) =>
        getLibraryActivityMs(right) - getLibraryActivityMs(left) ||
        left.id.localeCompare(right.id)
    )
    .filter((item) => {
      const recipeCardId =
        item.latest_card?.id ?? item.latest_media_job?.result_recipe_card_id

      if (!recipeCardId) {
        return true
      }

      if (seenRecipeCardIds.has(recipeCardId)) {
        return false
      }

      seenRecipeCardIds.add(recipeCardId)
      return true
    })
}

function getActiveJobPriority(status: ActiveMediaJob['status']) {
  return status === 'queued' ? 1 : 0
}

function getLibraryItemPriority(item: RecipeLibraryItem) {
  const job = item.latest_media_job

  if (isProcessingJob(job)) {
    return 0
  }

  if (job?.status === 'queued') {
    return 1
  }

  if (isRetryableFailedJob(job)) {
    return 2
  }

  if (!isFailedItem(item)) {
    return 3
  }

  return 4
}

function isProcessingJob(
  job: MediaJob | null | undefined
): job is MediaJob & {
  status: 'resolving' | 'downloading' | 'analyzing'
} {
  return (
    job?.status === 'resolving' ||
    job?.status === 'downloading' ||
    job?.status === 'analyzing'
  )
}

function compareProcessingJobs(
  left: MediaJob,
  right: MediaJob
) {
  const leftStartedAt = left.started_at ?? left.created_at
  const rightStartedAt = right.started_at ?? right.created_at

  return (
    getTimestampMs(leftStartedAt) - getTimestampMs(rightStartedAt) ||
    left.id.localeCompare(right.id)
  )
}

function isRetryableFailedJob(job: MediaJob | null | undefined) {
  return isFailedJob(job) && job?.source_metadata.retryable === true
}

function isFailedItem(item: RecipeLibraryItem) {
  return isFailedJob(item.latest_media_job) || item.metadata_status === 'failed'
}

function isFailedJob(job: MediaJob | null | undefined) {
  return (
    job?.status === 'failed' ||
    job?.status === 'cancelled' ||
    job?.status === 'needs_caption'
  )
}

function getLibraryActivityMs(item: RecipeLibraryItem) {
  return Math.max(
    getTimestampMs(item.latest_media_job?.completed_at),
    getTimestampMs(item.latest_media_job?.updated_at),
    getTimestampMs(item.latest_card?.updated_at),
    getTimestampMs(item.latest_card?.created_at),
    getTimestampMs(item.updated_at),
    getTimestampMs(item.created_at)
  )
}

function getTimestampMs(value: string | null | undefined) {
  if (!value) {
    return 0
  }

  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}
