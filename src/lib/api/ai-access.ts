import { supabase } from '@/lib/supabase/client'

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
  monthlyLimit: number | null
  remaining: number | null
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
    throw new Error('Could not load AI access state.')
  }

  if (!data?.ok) {
    throw new Error(data?.error.message ?? 'Could not load AI access state.')
  }

  return data.data
}
