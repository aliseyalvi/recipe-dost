export const AI_REPORT_NOTE_MAX_LENGTH = 500

export const AI_REPORT_CATEGORIES = [
  { value: 'incorrect_or_misleading', label: 'Incorrect or misleading' },
  { value: 'unsafe_cooking_instructions', label: 'Unsafe cooking instructions' },
  { value: 'allergy_or_food_safety', label: 'Allergy or food safety' },
  { value: 'offensive_content', label: 'Offensive content' },
  { value: 'other', label: 'Other' },
] as const

export type AiReportCategory = (typeof AI_REPORT_CATEGORIES)[number]['value']

export function isAiReportCategory(value: unknown): value is AiReportCategory {
  return AI_REPORT_CATEGORIES.some((category) => category.value === value)
}

export function normalizeAiReportNote(value: string) {
  const normalized = value.trim()
  return normalized ? normalized.slice(0, AI_REPORT_NOTE_MAX_LENGTH) : null
}
