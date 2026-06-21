import { OnboardingProfile } from '@/features/onboarding/types'
import { supabase } from '@/lib/supabase/client'
import { Tables } from '@/types/supabase'

export type UserProfileRow = Tables<'user_profiles'>

export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select(
      'user_id, language, household_size, cooking_level, cuisine_preference, main_use, cooking_preferences, onboarding_completed'
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

export async function saveOnboardingProfile({
  userId,
  profile,
  onboardingCompleted,
}: {
  userId: string
  profile: OnboardingProfile
  onboardingCompleted: boolean
}) {
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(
      {
        user_id: userId,
        cuisine_preference: profile.cuisinePreference,
        language: profile.language,
        household_size: profile.householdSize,
        cooking_level: profile.cookingLevel,
        main_use: profile.mainUse,
        cooking_preferences: profile.cookingPreferences,
        onboarding_completed: onboardingCompleted,
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}
