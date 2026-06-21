import { OnboardingProfile } from '@/features/onboarding/types'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { secureStoreStorage } from '@/lib/storage/secure-store-storage'

const initialProfile: OnboardingProfile = {
  cuisinePreference: null,
  language: null,
  householdSize: null,
  cookingLevel: null,
  mainUse: null,
  cookingPreferences: [],
  onboardingCompleted: false,
}

type OnboardingState = {
  profile: OnboardingProfile
  setProfile: (profile: Partial<OnboardingProfile>) => void
  toggleCookingPreference: (preference: OnboardingProfile['cookingPreferences'][number]) => void
  resetProfile: () => void
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      profile: initialProfile,
      setProfile: (profile) =>
        set((state) => ({
          profile: {
            ...state.profile,
            ...profile,
          },
        })),
      toggleCookingPreference: (preference) =>
        set((state) => {
          const hasPreference =
            state.profile.cookingPreferences.includes(preference)

          return {
            profile: {
              ...state.profile,
              cookingPreferences: hasPreference
                ? state.profile.cookingPreferences.filter(
                    (item) => item !== preference
                  )
                : [...state.profile.cookingPreferences, preference],
            },
          }
        }),
      resetProfile: () => set({ profile: initialProfile }),
    }),
    {
      name: 'recipe-dost-onboarding-profile',
      storage: createJSONStorage(() => secureStoreStorage),
    }
  )
)
