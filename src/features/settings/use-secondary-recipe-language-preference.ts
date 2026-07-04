import {
  saveSecondaryRecipeLanguagePreference,
} from '@/features/onboarding/profile-api'
import { useUserProfileQuery } from '@/features/onboarding/use-user-profile-query'
import {
  DEFAULT_SECONDARY_RECIPE_LANGUAGE_CODE,
  getSecondaryRecipeLanguage,
} from '@/features/settings/secondary-recipe-language'
import type { SecondaryRecipeLanguageCode } from '@/features/settings/secondary-recipe-language'
import { useAuth } from '@/providers/auth-provider'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useSecondaryRecipeLanguagePreference() {
  const { user } = useAuth()
  const { track } = usePostHog()
  const queryClient = useQueryClient()
  const profileQuery = useUserProfileQuery()
  const language = getSecondaryRecipeLanguage(
    profileQuery.data?.secondary_recipe_language_code ??
      DEFAULT_SECONDARY_RECIPE_LANGUAGE_CODE
  )
  const mutation = useMutation({
    mutationFn: (languageCode: SecondaryRecipeLanguageCode) => {
      if (!user?.id) {
        throw new Error('Unable to save language preference yet.')
      }

      return saveSecondaryRecipeLanguagePreference({
        userId: user.id,
        languageCode,
      })
    },
    onSuccess: async (_profile, languageCode) => {
      track('secondary_recipe_language_saved', {
        code: languageCode,
      })
      await queryClient.invalidateQueries({
        queryKey: ['user-profile', user?.id],
      })
    },
  })

  return {
    profileQuery,
    selectedLanguage: language,
    saveLanguage: mutation.mutate,
    isSaving: mutation.isPending,
    saveError: mutation.error,
  }
}
