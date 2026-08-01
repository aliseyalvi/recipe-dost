import type { MediaJobStatus } from '@/lib/api/recipes'

export type FailedJobPresentation = 'full' | 'inline' | 'none'

const TERMINAL_STATUSES: MediaJobStatus[] = [
  'completed',
  'failed',
  'cancelled',
  'needs_caption',
]

export function getFailedJobPresentation({
  jobId,
  status,
  previousStatus,
  watchedJobId,
  wasPresented,
}: {
  jobId: string
  status: MediaJobStatus
  previousStatus: MediaJobStatus | null
  watchedJobId: string | null
  wasPresented: boolean
}): FailedJobPresentation {
  if (status !== 'failed' && status !== 'cancelled' && status !== 'needs_caption') {
    return 'none'
  }

  const transitionedFromActive =
    previousStatus !== null && !TERMINAL_STATUSES.includes(previousStatus)

  if (
    jobId === watchedJobId &&
    transitionedFromActive &&
    !wasPresented
  ) {
    return 'full'
  }

  return 'inline'
}
