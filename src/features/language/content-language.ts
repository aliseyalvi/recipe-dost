import { useUserProfileQuery } from '@/features/onboarding/use-user-profile-query'
import { secureStoreStorage } from '@/lib/storage/secure-store-storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type RecipeContentLanguage = 'english' | 'urdu' | 'both'

type ContentLanguageState = {
  language: RecipeContentLanguage | null
  setLanguage: (language: RecipeContentLanguage) => void
}

export const useContentLanguageStore = create<ContentLanguageState>()(
  persist(
    (set) => ({
      language: null,
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'recipe-dost-content-language',
      storage: createJSONStorage(() => secureStoreStorage),
    }
  )
)

export function useRecipeContentLanguage() {
  const storedLanguage = useContentLanguageStore((state) => state.language)
  const setLanguage = useContentLanguageStore((state) => state.setLanguage)
  const profileQuery = useUserProfileQuery()

  return {
    language:
      storedLanguage ?? getDefaultContentLanguage(profileQuery.data?.language),
    setLanguage,
  }
}

function getDefaultContentLanguage(language: string | null | undefined) {
  if (language === 'english') {
    return 'english'
  }

  if (language === 'urdu') {
    return 'urdu'
  }

  return 'both'
}
