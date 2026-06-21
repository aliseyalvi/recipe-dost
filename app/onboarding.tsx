import {
  cookingLevelOptions,
  cookingPreferenceOptions,
  cuisineOptions,
  householdSizeOptions,
  languageOptions,
  mainUseOptions,
} from '@/features/onboarding/options'
import { saveOnboardingProfile } from '@/features/onboarding/profile-api'
import { useOnboardingStore } from '@/features/onboarding/onboarding-store'
import { ChoiceCard } from '@/features/onboarding/choice-card'
import { PreferenceChip } from '@/features/onboarding/preference-chip'
import { ProgressIndicator } from '@/features/onboarding/progress-indicator'
import { useUserProfileQuery } from '@/features/onboarding/use-user-profile-query'
import { useAuth } from '@/providers/auth-provider'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, spacing, typography } from '@/theme'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { ErrorState } from '@/ui/error-state'
import { LoadingState } from '@/ui/loading-state'
import { Screen } from '@/ui/screen'
import { useQueryClient } from '@tanstack/react-query'
import { Redirect, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Text, View } from 'react-native'

const totalSteps = 5

type StepId =
  | 'cooking_style'
  | 'preferred_language'
  | 'household_size'
  | 'cooking_level'
  | 'main_use'

const stepIds: StepId[] = [
  'cooking_style',
  'preferred_language',
  'household_size',
  'cooking_level',
  'main_use',
]

export default function OnboardingRoute() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const profileQuery = useUserProfileQuery()
  const { user } = useAuth()
  const { track } = usePostHog()
  const { profile, setProfile, toggleCookingPreference } = useOnboardingStore()
  const [stepIndex, setStepIndex] = useState(0)
  const [saveError, setSaveError] = useState<Error | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const currentStep = stepIds[stepIndex]

  useEffect(() => {
    track('onboarding_step_viewed', {
      step_id: currentStep,
      step_number: stepIndex + 1,
    })
  }, [currentStep, stepIndex, track])

  const canContinue = useMemo(() => {
    switch (currentStep) {
      case 'cooking_style':
        return Boolean(profile.cuisinePreference)
      case 'preferred_language':
        return Boolean(profile.language)
      case 'household_size':
        return Boolean(profile.householdSize)
      case 'cooking_level':
        return Boolean(profile.cookingLevel)
      case 'main_use':
        return Boolean(profile.mainUse)
    }
  }, [currentStep, profile])

  if (profileQuery.data?.onboarding_completed) {
    return <Redirect href="/home" />
  }

  const goBack = () => {
    setSaveError(null)
    setStepIndex((index) => Math.max(0, index - 1))
  }

  const goForward = () => {
    setSaveError(null)

    if (stepIndex < totalSteps - 1) {
      setStepIndex((index) => index + 1)
      return
    }

    void finishOnboarding()
  }

  const finishOnboarding = async () => {
    if (!user?.id) {
      setSaveError(new Error('Anonymous session is not ready yet.'))
      return
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      await saveOnboardingProfile({
        userId: user.id,
        profile,
        onboardingCompleted: true,
      })
      setProfile({ onboardingCompleted: true })
      track('onboarding_completed')
      await queryClient.invalidateQueries({ queryKey: ['user-profile', user.id] })
      router.replace('/home')
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error
          ? caughtError
          : new Error('Could not save onboarding.')
      )
    } finally {
      setIsSaving(false)
    }
  }

  const continueLater = async () => {
    if (user?.id) {
      setProfile({ onboardingCompleted: false })

      try {
        await saveOnboardingProfile({
          userId: user.id,
          profile: {
            ...profile,
            onboardingCompleted: false,
          },
          onboardingCompleted: false,
        })
        await queryClient.invalidateQueries({ queryKey: ['user-profile', user.id] })
      } catch {
        // Local persisted profile is enough for this escape hatch.
      }
    }

    router.replace('/home')
  }

  const trackOption = (optionId: string) => {
    track('onboarding_option_selected', {
      step_id: currentStep,
      option_id: optionId,
    })
  }

  if (isSaving) {
    return (
      <Screen>
        <ProgressIndicator currentStep={totalSteps} totalSteps={totalSteps} />
        <LoadingState message="Saving your setup..." />
      </Screen>
    )
  }

  if (saveError) {
    return (
      <Screen>
        <ProgressIndicator
          currentStep={stepIndex + 1}
          totalSteps={totalSteps}
        />
        <ErrorState
          title="Could not save setup"
          message={saveError.message}
          retryLabel="Retry"
          onRetry={() => {
            void finishOnboarding()
          }}
          secondaryActionLabel="Continue Later"
          onSecondaryAction={() => {
            void continueLater()
          }}
        />
      </Screen>
    )
  }

  return (
    <Screen>
      <ProgressIndicator currentStep={stepIndex + 1} totalSteps={totalSteps} />

      {currentStep === 'cooking_style' ? (
        <Card>
          <QuestionHeader question="What do you cook most?" />
          <View style={{ gap: spacing.md }}>
            {cuisineOptions.map((option) => (
              <ChoiceCard
                key={option.value}
                label={option.label}
                value={option.value}
                selected={profile.cuisinePreference === option.value}
                onPress={(value) => {
                  setProfile({ cuisinePreference: value })
                  trackOption(value)
                }}
              />
            ))}
          </View>
        </Card>
      ) : null}

      {currentStep === 'preferred_language' ? (
        <Card>
          <QuestionHeader
            question="How should Recipe Dost explain recipes?"
            helper="You can change this later in Settings."
          />
          <View style={{ gap: spacing.md }}>
            {languageOptions.map((option) => (
              <ChoiceCard
                key={option.value}
                label={option.label}
                value={option.value}
                selected={profile.language === option.value}
                onPress={(value) => {
                  setProfile({ language: value })
                  trackOption(value)
                  track('language_selected', { language: value })
                }}
              />
            ))}
          </View>
        </Card>
      ) : null}

      {currentStep === 'household_size' ? (
        <Card>
          <QuestionHeader
            question="How many people do you usually cook for?"
            helper="We will estimate servings and grocery quantities better."
          />
          <View style={{ gap: spacing.md }}>
            {householdSizeOptions.map((option) => (
              <ChoiceCard
                key={option.value}
                label={option.label}
                value={option.value}
                selected={profile.householdSize === option.value}
                onPress={(value) => {
                  setProfile({ householdSize: value })
                  trackOption(value)
                }}
              />
            ))}
          </View>
        </Card>
      ) : null}

      {currentStep === 'cooking_level' ? (
        <Card>
          <QuestionHeader
            question="What is your cooking level?"
            helper="Beginner mode gives simpler steps and extra tips."
          />
          <View style={{ gap: spacing.md }}>
            {cookingLevelOptions.map((option) => (
              <ChoiceCard
                key={option.value}
                label={option.label}
                value={option.value}
                selected={profile.cookingLevel === option.value}
                onPress={(value) => {
                  setProfile({ cookingLevel: value })
                  trackOption(value)
                }}
              />
            ))}
          </View>
        </Card>
      ) : null}

      {currentStep === 'main_use' ? (
        <Card>
          <QuestionHeader question="What do you want to use Recipe Dost for?" />
          <View style={{ gap: spacing.md }}>
            {mainUseOptions.map((option) => (
              <ChoiceCard
                key={option.value}
                label={option.label}
                value={option.value}
                selected={profile.mainUse === option.value}
                onPress={(value) => {
                  setProfile({ mainUse: value })
                  trackOption(value)
                }}
              />
            ))}
          </View>

          <View style={{ gap: spacing.md }}>
            <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
              Optional preferences
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {cookingPreferenceOptions.map((option) => (
                <PreferenceChip
                  key={option.value}
                  label={option.label}
                  value={option.value}
                  selected={profile.cookingPreferences.includes(option.value)}
                  onPress={(value) => {
                    toggleCookingPreference(value)
                    track('onboarding_option_selected', {
                      step_id: 'optional_preferences',
                      option_id: value,
                    })
                  }}
                />
              ))}
            </View>
          </View>
        </Card>
      ) : null}

      <View style={{ gap: spacing.md }}>
        <Button
          label={stepIndex === totalSteps - 1 ? 'Finish Setup' : 'Continue'}
          fullWidth
          disabled={!canContinue}
          onPress={goForward}
        />
        {stepIndex > 0 ? (
          <Button label="Back" fullWidth variant="secondary" onPress={goBack} />
        ) : null}
      </View>
    </Screen>
  )
}

function QuestionHeader({
  question,
  helper,
}: {
  question: string
  helper?: string
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text selectable style={[typography.heading, { color: colors.text }]}>
        {question}
      </Text>
      {helper ? (
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          {helper}
        </Text>
      ) : null}
    </View>
  )
}
