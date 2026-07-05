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
  plan: 'free' | 'premium'
  blockReason:
    | 'free_ai_limit_reached'
    | 'premium_monthly_limit_reached'
    | 'active_ai_job_limit_reached'
    | null
  role: string
  freeLimit: number
  usedSuccessfulGenerations: number
  activeReserved: number
  freeSuccessfulUsed: number
  freeActiveReserved: number
  freeRemainingToStart: number
  premiumMonthlyLimit: number
  premiumMonthlySuccessfulUsed: number
  premiumMonthlyActiveReserved: number
  premiumMonthlyRemainingToStart: number
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
  const freeSuccessfulUsed =
    getNumber(data.freeSuccessfulUsed) ??
    getNumber(data.free_successful_used) ??
    data.usedSuccessfulGenerations
  const freeActiveReserved =
    getNumber(data.freeActiveReserved) ??
    getNumber(data.free_active_reserved) ??
    activeReserved
  const freeRemainingToStart =
    getNumber(data.freeRemainingToStart) ??
    getNumber(data.free_remaining_to_start) ??
    data.remaining
  const premiumMonthlyLimit =
    getNumber(data.premiumMonthlyLimit) ??
    getNumber(data.premium_monthly_limit) ??
    getNumber(data.monthlyLimit) ??
    getNumber(data.monthly_limit) ??
    100
  const premiumMonthlySuccessfulUsed =
    getNumber(data.premiumMonthlySuccessfulUsed) ??
    getNumber(data.premium_monthly_successful_used) ??
    0
  const premiumMonthlyActiveReserved =
    getNumber(data.premiumMonthlyActiveReserved) ??
    getNumber(data.premium_monthly_active_reserved) ??
    0
  const premiumMonthlyRemainingToStart =
    getNumber(data.premiumMonthlyRemainingToStart) ??
    getNumber(data.premium_monthly_remaining_to_start) ??
    data.remaining
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
    plan:
      data.plan === 'premium' || data.premiumActive ? 'premium' : 'free',
    blockReason: getBlockReason(data.blockReason ?? data.block_reason),
    activeReserved,
    freeSuccessfulUsed,
    freeActiveReserved,
    freeRemainingToStart: freeRemainingToStart ?? 0,
    premiumMonthlyLimit,
    premiumMonthlySuccessfulUsed,
    premiumMonthlyActiveReserved,
    premiumMonthlyRemainingToStart: premiumMonthlyRemainingToStart ?? 0,
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

function getBlockReason(value: unknown): AiAccessState['blockReason'] {
  return value === 'free_ai_limit_reached' ||
    value === 'premium_monthly_limit_reached' ||
    value === 'active_ai_job_limit_reached'
    ? value
    : null
}
