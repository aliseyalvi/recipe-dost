import { supabase } from '@/lib/supabase/client'
import { getFriendlyApiErrorMessage } from '@/lib/api/errors'

export type AiAccessState = {
  allowed: boolean
  reason:
    | 'free_credit_available'
    | 'premium_active'
    | 'admin_override'
    | 'tester_override'
    | 'limit_reached'
  role: string
  freeLimit: number
  usedSuccessfulGenerations: number
  activeReserved: number
  monthlyLimit: number | null
  remainingToStart: number | null
  remaining: number | null
  canStartAiJob: boolean
  isPremiumOrTester: boolean
  premiumActive: boolean
  isTestUser: boolean
}

type GetAiAccessResponse =
  | {
      ok: true
      data: AiAccessState
    }
  | {
      ok: false
      error: {
        code: string
        message: string
      }
    }

export async function getAiAccessState() {
  const { data, error } =
    await supabase.functions.invoke<GetAiAccessResponse>('get-ai-access')

  if (error) {
    throw new Error(
      getFriendlyApiErrorMessage(error, 'Could not load AI access state.')
    )
  }

  if (!data?.ok) {
    throw new Error(data?.error.message ?? 'Could not load AI access state.')
  }

  return normalizeAiAccessState(data.data)
}

function normalizeAiAccessState(data: AiAccessState & Record<string, unknown>) {
  const activeReserved =
    getNumber(data.activeReserved) ?? getNumber(data.active_reserved) ?? 0
  const remainingToStart =
    getNumber(data.remainingToStart) ??
    getNumber(data.remaining_to_start) ??
    data.remaining
  const canStartAiJob =
    getBoolean(data.canStartAiJob) ??
    getBoolean(data.can_start_ai_job) ??
    data.allowed
  const fallbackIsPremiumOrTester =
    data.premiumActive ||
    data.isTestUser ||
    data.role === 'admin' ||
    data.role === 'tester'
  const isPremiumOrTester =
    getBoolean(data.isPremiumOrTester) ??
    getBoolean(data.is_premium_or_tester) ??
    fallbackIsPremiumOrTester

  return {
    ...data,
    activeReserved,
    remainingToStart,
    remaining: data.remaining ?? remainingToStart,
    canStartAiJob,
    isPremiumOrTester,
  } satisfies AiAccessState
}

function getNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null
}
