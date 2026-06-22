import {
  RecipeContentLanguage,
  useRecipeContentLanguage,
} from '@/features/language/content-language'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, radius, spacing, typography } from '@/theme'
import { Pressable, Text, View } from 'react-native'

const languageOptions: { label: string; value: RecipeContentLanguage }[] = [
  { label: 'English', value: 'english' },
  { label: 'اردو', value: 'urdu' },
  { label: 'Both', value: 'both' },
]

export function ContentLanguageControl({
  value,
  onChange,
}: {
  value?: RecipeContentLanguage
  onChange?: (value: RecipeContentLanguage) => void
}) {
  const { language, setLanguage } = useRecipeContentLanguage()
  const { track } = usePostHog()
  const selectedValue = value ?? language

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.xs,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceMuted,
        padding: spacing.xs,
      }}
    >
      {languageOptions.map((option) => {
        const isSelected = selectedValue === option.value

        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => {
              if (onChange) {
                onChange(option.value)
              } else {
                setLanguage(option.value)
                track('language_preference_changed', { value: option.value })
              }
            }}
            style={({ pressed }) => ({
              minHeight: 38,
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.pill,
              backgroundColor: isSelected ? colors.primary : 'transparent',
              opacity: pressed ? 0.82 : 1,
              paddingHorizontal: spacing.sm,
            })}
          >
            <Text
              selectable={false}
              style={[
                typography.caption,
                {
                  color: isSelected ? colors.primaryText : colors.textMuted,
                  fontWeight: '800',
                  textAlign: 'center',
                },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
