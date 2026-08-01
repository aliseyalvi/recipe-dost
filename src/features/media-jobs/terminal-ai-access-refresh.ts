import type { MediaJob } from '@/lib/api/recipes'

export function shouldRefreshAiAccessForTerminalJob(
  refreshedTerminalJobs: Set<string>,
  job: Pick<MediaJob, 'id' | 'status'> | null | undefined
) {
  if (!job || !isTerminalAiAccessStatus(job.status)) {
    return false
  }

  const key = job.id
  if (refreshedTerminalJobs.has(key)) {
    return false
  }

  refreshedTerminalJobs.add(key)
  return true
}

function isTerminalAiAccessStatus(status: MediaJob['status']) {
  return (
    status === 'completed' ||
    status === 'failed' ||
    status === 'cancelled' ||
    status === 'needs_caption'
  )
}
