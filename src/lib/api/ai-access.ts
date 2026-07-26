import { supabase } from '@/lib/supabase/client'
import { getFriendlyApiErrorMessage } from '@/lib/api/errors'
import { normalizeAiAccessState } from '@/features/ai-access/ai-access-state'

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
