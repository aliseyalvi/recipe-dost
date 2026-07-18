import { OnboardingProfile } from '@/features/onboarding/types'
import { create } from 'zustand'
import {
  deleteSecureStoreItem,
  readSecureStoreItem,
  writeSecureStoreItem,
} from '@/lib/storage/secure-store-storage'

export const ONBOARDING_STORAGE_KEY = 'recipe-dost-onboarding-profile'

export const initialOnboardingProfile: OnboardingProfile = {
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
  hydrationStatus: 'pending' | 'ready' | 'error'
  storageKeyStatus: 'unknown' | 'absent' | 'present'
  hydrationError: Error | null
  setProfile: (profile: Partial<OnboardingProfile>) => void
  resetProfile: () => void
}

export const useOnboardingStore = create<OnboardingState>()((set) => ({
  profile: initialOnboardingProfile,
  hydrationStatus: 'pending',
  storageKeyStatus: 'unknown',
  hydrationError: null,
  setProfile: (profile) =>
    set((state) => ({
      profile: {
        ...state.profile,
        ...profile,
      },
    })),
  resetProfile: () => set({ profile: initialOnboardingProfile }),
}))

let hydrationPromise: Promise<void> | null = null

export function hydrateOnboardingStore(force = false) {
  if (hydrationPromise && !force) {
    return hydrationPromise
  }

  useOnboardingStore.setState({
    hydrationStatus: 'pending',
    storageKeyStatus: 'unknown',
    hydrationError: null,
  })

  hydrationPromise = readSecureStoreItem(ONBOARDING_STORAGE_KEY)
    .then((result) => {
      if (!result.ok) {
        throw result.error
      }

      if (result.value === null) {
        useOnboardingStore.setState({
          profile: initialOnboardingProfile,
          hydrationStatus: 'ready',
          storageKeyStatus: 'absent',
          hydrationError: null,
        })
        return
      }

      const profile = parsePersistedOnboardingProfile(result.value)
      useOnboardingStore.setState({
        profile,
        hydrationStatus: 'ready',
        storageKeyStatus: 'present',
        hydrationError: null,
      })
    })
    .catch((caughtError) => {
      useOnboardingStore.setState({
        profile: initialOnboardingProfile,
        hydrationStatus: 'error',
        storageKeyStatus: 'unknown',
        hydrationError:
          caughtError instanceof Error
            ? caughtError
            : new Error('Could not read onboarding settings.'),
      })
    })

  return hydrationPromise
}

export async function persistOnboardingProfile(profile: OnboardingProfile) {
  const value = JSON.stringify({ state: { profile }, version: 0 })
  await writeSecureStoreItem(ONBOARDING_STORAGE_KEY, value)
  useOnboardingStore.setState({
    profile,
    hydrationStatus: 'ready',
    storageKeyStatus: 'present',
    hydrationError: null,
  })
}

export async function clearOnboardingProfile() {
  try {
    await deleteSecureStoreItem(ONBOARDING_STORAGE_KEY)
  } finally {
    hydrationPromise = null
    useOnboardingStore.setState({
      profile: initialOnboardingProfile,
      hydrationStatus: 'ready',
      storageKeyStatus: 'absent',
      hydrationError: null,
    })
  }
}

export function parsePersistedOnboardingProfile(value: string) {
  const parsed: unknown = JSON.parse(value)

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Saved onboarding settings are invalid.')
  }

  const state = 'state' in parsed ? parsed.state : null
  const profile =
    state && typeof state === 'object' && 'profile' in state
      ? state.profile
      : null

  if (!profile || typeof profile !== 'object') {
    throw new Error('Saved onboarding settings are invalid.')
  }

  const candidate = profile as Partial<OnboardingProfile>
  return {
    ...initialOnboardingProfile,
    ...candidate,
    cookingPreferences: Array.isArray(candidate.cookingPreferences)
      ? candidate.cookingPreferences
      : [],
    onboardingCompleted: candidate.onboardingCompleted === true,
  }
}
