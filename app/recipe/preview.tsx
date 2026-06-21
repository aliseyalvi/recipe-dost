import { ChoiceCard } from '@/features/onboarding/choice-card'
import { cuisineOptions, mealTypeOptions } from '@/features/recipe-draft/options'
import {
  getReadableSource,
  getPlatformLabel,
  isValidHttpUrl,
} from '@/features/recipe-draft/platform'
import { PlatformBadge } from '@/features/recipe-draft/platform-badge'
import { useRecipeDraftStore } from '@/features/recipe-draft/recipe-draft-store'
import { RecipeMealType } from '@/features/recipe-draft/types'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, spacing, typography } from '@/theme'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { EmptyState } from '@/ui/empty-state'
import { ErrorState } from '@/ui/error-state'
import { Screen } from '@/ui/screen'
import { TextArea } from '@/ui/text-area'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

export default function RecipePreviewRoute() {
  const router = useRouter()
  const { track } = usePostHog()
  const { draft, updateDraft } = useRecipeDraftStore()
  const [userNote, setUserNote] = useState(draft?.user_note ?? '')
  const [pastedCaption, setPastedCaption] = useState(draft?.pasted_caption ?? '')
  const [manualIngredients, setManualIngredients] = useState(
    draft?.manual_ingredients ?? ''
  )
  const [mealType, setMealType] = useState<RecipeMealType | undefined>(
    draft?.meal_type
  )
  const [cuisine, setCuisine] = useState(draft?.cuisine ?? '')
  const hasValidDraftUrl = isValidHttpUrl(draft?.source_url)

  useEffect(() => {
    if (draft) {
      track('recipe_save_preview_viewed', {
        platform: draft.platform,
      })
    }
  }, [draft, track])

  if (!draft) {
    return (
      <Screen>
        <EmptyState
          title="No link ready to preview"
          message="Start by pasting a recipe video link."
          actionLabel="Paste a link"
          onActionPress={() => router.replace('/save-recipe')}
        />
      </Screen>
    )
  }

  if (!hasValidDraftUrl) {
    return (
      <Screen>
        <ErrorState
          title="No recipe link found"
          message="Please paste a recipe video link first."
          retryLabel="Go back"
          onRetry={() => router.replace('/save-recipe')}
        />
      </Screen>
    )
  }

  const saveDraft = () => {
    const nextNote = sanitizeOptionalText(userNote)
    const nextCaption = sanitizeOptionalText(pastedCaption)
    const nextIngredients = sanitizeOptionalText(manualIngredients)
    const nextCuisine = sanitizeOptionalText(cuisine)

    updateDraft({
      user_note: nextNote,
      pasted_caption: nextCaption,
      manual_ingredients: nextIngredients,
      meal_type: mealType,
      cuisine: nextCuisine,
    })
    track('recipe_link_draft_saved', {
      platform: draft.platform,
      has_note: Boolean(nextNote),
      has_caption: Boolean(nextCaption),
      has_manual_ingredients: Boolean(nextIngredients),
      has_meal_type: Boolean(mealType),
      has_cuisine: Boolean(nextCuisine),
    })
    router.push('/recipe/ready')
  }

  return (
    <Screen>
      <View style={{ gap: spacing.md }}>
        <Text selectable style={[typography.title, { color: colors.text }]}>
          Add recipe details
        </Text>
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          If we cannot read the caption, your notes help AI create a better
          recipe card.
        </Text>
      </View>

      <Card>
        <PlatformBadge platform={draft.platform} />
        <View style={{ gap: spacing.xs }}>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Source
          </Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            {getReadableSource(draft.source_url)}
          </Text>
        </View>
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
          Detected as {getPlatformLabel(draft.platform)}. Recipe Dost saves the
          link and recipe card details, not the video file.
        </Text>
      </Card>

      <TextArea
        label="Your note"
        onChangeText={setUserNote}
        placeholder="Example: I want to make this for dinner, less spicy."
        value={userNote}
      />
      <TextArea
        label="Paste caption"
        onChangeText={setPastedCaption}
        placeholder="Paste the recipe caption here if available."
        value={pastedCaption}
      />
      <TextArea
        label="Manual ingredients"
        onChangeText={setManualIngredients}
        placeholder="Example: chicken, pasta, cream, garlic..."
        value={manualIngredients}
      />

      <Card>
        <Text selectable style={[typography.heading, { color: colors.text }]}>
          Meal type
        </Text>
        <View style={{ gap: spacing.md }}>
          {mealTypeOptions.map((option) => (
            <ChoiceCard
              key={option.value}
              label={option.label}
              value={option.value}
              selected={mealType === option.value}
              onPress={(value) => setMealType(value)}
            />
          ))}
        </View>
      </Card>

      <Card>
        <Text selectable style={[typography.heading, { color: colors.text }]}>
          Cuisine
        </Text>
        <View style={{ gap: spacing.md }}>
          {cuisineOptions.map((option) => (
            <ChoiceCard
              key={option.value}
              label={option.label}
              value={option.value}
              selected={cuisine === option.value}
              onPress={(value) => setCuisine(value)}
            />
          ))}
        </View>
      </Card>

      <View style={{ gap: spacing.md }}>
        <Button
          label="Save Link"
          fullWidth
          disabled={!hasValidDraftUrl}
          onPress={saveDraft}
        />
        <Button
          label="Back"
          fullWidth
          variant="secondary"
          onPress={() => router.back()}
        />
      </View>
    </Screen>
  )
}

function sanitizeOptionalText(value: string) {
  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : undefined
}
