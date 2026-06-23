import { RecipeContentLanguage } from '@/features/language/content-language'

export type LocalizedTextSelection = {
  primary: string
  secondary?: string
  isRtl: boolean
  usedFallback: boolean
}

const urduScriptPattern = /[\u0600-\u06ff]/

export function hasUrduScript(value: string | null | undefined) {
  return Boolean(value && urduScriptPattern.test(value))
}

export function selectLocalizedText({
  english,
  urdu,
  language,
  fallback = '',
}: {
  english?: string | null
  urdu?: string | null
  language: RecipeContentLanguage
  fallback?: string
}): LocalizedTextSelection {
  const englishText = english?.trim() || fallback
  const urduText = urdu?.trim()
  const safeUrduText = hasUrduScript(urduText) ? urduText : null

  if (language === 'urdu') {
    return {
      primary: safeUrduText ?? englishText,
      isRtl: Boolean(safeUrduText),
      usedFallback: !safeUrduText,
    }
  }

  if (language === 'both') {
    return {
      primary: englishText,
      secondary: safeUrduText ?? undefined,
      isRtl: false,
      usedFallback: !safeUrduText,
    }
  }

  return {
    primary: englishText || safeUrduText || fallback,
    isRtl: false,
    usedFallback: false,
  }
}
