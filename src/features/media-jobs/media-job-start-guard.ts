import type { AiAccessState } from '@/lib/api/ai-access'

export class AiAccessRequiredError extends Error {
  constructor() {
    super('AI recipe generation is not currently available.')
    this.name = 'AiAccessRequiredError'
  }
}

export class MediaJobStartGuard {
  private inFlight = false

  async run<T>(operation: () => Promise<T>): Promise<T | null> {
    if (this.inFlight) {
      return null
    }

    this.inFlight = true
    try {
      return await operation()
    } finally {
      this.inFlight = false
    }
  }
}

export async function retryAiGenerationWithAuthoritativeAccess<T>({
  fetchAccess,
  createJob,
}: {
  fetchAccess: () => Promise<AiAccessState>
  createJob: () => Promise<T>
}) {
  const access = await fetchAccess()
  if (!access.canStartAiJob) {
    throw new AiAccessRequiredError()
  }

  return createJob()
}
