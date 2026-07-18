import {
  isAiReportCategory,
  normalizeAiReportNote,
  type AiReportCategory,
} from '@/features/ai-report/ai-report-model'
import { supabase } from '@/lib/supabase/client'

type SubmitAiReportResponse =
  | { ok: true; data: { submitted: true; duplicate: boolean } }
  | { ok: false; error: { code: string; message: string } }

export async function submitAiRecipeReport(input: {
  recipeCardId: string
  category: AiReportCategory
  note: string
  appVersion: string | null
  buildNumber: string | null
}) {
  if (!isAiReportCategory(input.category)) {
    throw new Error('Choose a valid report category.')
  }

  const { data, error } = await supabase.functions.invoke<SubmitAiReportResponse>(
    'submit-ai-report',
    {
      method: 'POST',
      body: {
        recipe_card_id: input.recipeCardId,
        category: input.category,
        note: normalizeAiReportNote(input.note),
        app_version: input.appVersion,
        build_number: input.buildNumber,
      },
    }
  )

  if (error) {
    throw new Error('The report could not be submitted. Check your connection and retry.')
  }
  if (!data?.ok) {
    throw new Error(
      data?.error.message ?? 'The report could not be submitted. Please retry.'
    )
  }

  return data.data
}
