export const SUPPORTED_SECONDARY_RECIPE_LANGUAGES = [
  {
    code: 'ur',
    label: 'Urdu',
    nativeLabel: 'اردو',
    aiInstruction: 'Provide secondary explanations in Urdu.',
  },
] as const

export type SecondaryRecipeLanguageCode =
  (typeof SUPPORTED_SECONDARY_RECIPE_LANGUAGES)[number]['code']

export type SecondaryRecipeLanguage =
  (typeof SUPPORTED_SECONDARY_RECIPE_LANGUAGES)[number]

export const DEFAULT_SECONDARY_RECIPE_LANGUAGE_CODE: SecondaryRecipeLanguageCode =
  'ur'

export function getSecondaryRecipeLanguage(
  code: string | null | undefined
): SecondaryRecipeLanguage {
  return (
    SUPPORTED_SECONDARY_RECIPE_LANGUAGES.find(
      (language) => language.code === code
    ) ?? SUPPORTED_SECONDARY_RECIPE_LANGUAGES[0]
  )
}

export function isSupportedSecondaryRecipeLanguageCode(
  code: string
): code is SecondaryRecipeLanguageCode {
  return SUPPORTED_SECONDARY_RECIPE_LANGUAGES.some(
    (language) => language.code === code
  )
}
