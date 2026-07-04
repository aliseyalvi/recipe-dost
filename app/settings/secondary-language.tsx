import {
  SUPPORTED_SECONDARY_RECIPE_LANGUAGES,
} from '@/features/settings/secondary-recipe-language'
import type { SecondaryRecipeLanguage } from '@/features/settings/secondary-recipe-language'
import { useSecondaryRecipeLanguagePreference } from '@/features/settings/use-secondary-recipe-language-preference'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, radius, spacing, typography } from '@/theme'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { EmptyState } from '@/ui/empty-state'
import { ErrorState } from '@/ui/error-state'
import { LoadingState } from '@/ui/loading-state'
import { Screen } from '@/ui/screen'
import { NestedScreenHeader } from '@/ui/screen-header'
import { useEffect } from 'react'
import { Pressable, Text, View } from 'react-native'

export default function SecondaryLanguageSettingsRoute() {
  const languageOptions: readonly SecondaryRecipeLanguage[] =
    SUPPORTED_SECONDARY_RECIPE_LANGUAGES
  const { track } = usePostHog()
  const {
    profileQuery,
    selectedLanguage,
    saveLanguage,
    isSaving,
    saveError,
  } = useSecondaryRecipeLanguagePreference()

  useEffect(() => {
    track('settings_secondary_language_viewed')
  }, [track])

  if (profileQuery.isLoading) {
    return (
      <Screen compact>
        <NestedScreenHeader
          title="Secondary recipe language"
          fallbackRoute="/settings"
        />
        <LoadingState message="Loading language preference..." />
      </Screen>
    )
  }

  if (profileQuery.error) {
    return (
      <Screen compact>
        <NestedScreenHeader
          title="Secondary recipe language"
          fallbackRoute="/settings"
        />
        <ErrorState
          title="Could not load language preference"
          message="Check your connection and try again."
          retryLabel="Retry"
          onRetry={() => {
            void profileQuery.refetch()
          }}
        />
      </Screen>
    )
  }

  if (languageOptions.length === 0) {
    return (
      <Screen compact>
        <NestedScreenHeader
          title="Secondary recipe language"
          fallbackRoute="/settings"
        />
        <EmptyState
          title="No languages yet"
          message="Secondary recipe languages will appear here when they are available."
        />
      </Screen>
    )
  }

  return (
    <Screen compact>
      <NestedScreenHeader
        title="Secondary recipe language"
        fallbackRoute="/settings"
      />

      <Card>
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          Recipe Dost can include recipe insights in a second language alongside
          English.
        </Text>

        <View style={{ gap: spacing.sm }}>
          {languageOptions.map((language) => {
            const isSelected = selectedLanguage.code === language.code

            return (
              <Pressable
                key={language.code}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                disabled={isSaving}
                onPress={() => {
                  track('secondary_recipe_language_option_tapped', {
                    code: language.code,
                  })
                  saveLanguage(language.code)
                }}
                style={({ pressed }) => ({
                  minHeight: 64,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: spacing.md,
                  borderWidth: 1,
                  borderColor: isSelected ? colors.accent : colors.border,
                  borderRadius: radius.md,
                  backgroundColor: isSelected
                    ? colors.accentSoft
                    : colors.surfaceMuted,
                  opacity: pressed ? 0.78 : isSaving ? 0.68 : 1,
                  padding: spacing.md,
                })}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    selectable
                    style={[
                      typography.body,
                      { color: colors.text, fontWeight: '800' },
                    ]}
                  >
                    {language.label}
                  </Text>
                  <Text
                    selectable
                    style={[typography.caption, { color: colors.textMuted }]}
                  >
                    {language.nativeLabel}
                  </Text>
                </View>
                <Text
                  selectable={false}
                  style={[
                    typography.caption,
                    {
                      color: isSelected ? colors.accent : colors.textMuted,
                      fontWeight: '900',
                    },
                  ]}
                >
                  {isSelected ? 'Selected' : 'Choose'}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
          More languages coming later.
        </Text>

        {saveError ? (
          <View style={{ gap: spacing.sm }}>
            <Text selectable style={[typography.caption, { color: colors.danger }]}>
              Could not save language preference.
            </Text>
            <Button
              label="Retry Urdu"
              variant="secondary"
              disabled={isSaving}
              onPress={() => {
                saveLanguage('ur')
              }}
            />
          </View>
        ) : null}
      </Card>
    </Screen>
  )
}
