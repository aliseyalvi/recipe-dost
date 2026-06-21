import {
  detectRecipePlatform,
  getPlatformLabel,
  isValidHttpUrl,
} from '@/features/recipe-draft/platform'
import { PlatformBadge } from '@/features/recipe-draft/platform-badge'
import {
  RecipeCard,
  RecipeCardIngredient,
  RecipeCardStep,
  RecipeCardSubstitution,
  getRecipeCard,
} from '@/lib/api/recipes'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, radius, spacing, typography } from '@/theme'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { EmptyState } from '@/ui/empty-state'
import { ErrorState } from '@/ui/error-state'
import { LoadingState } from '@/ui/loading-state'
import { Screen } from '@/ui/screen'
import { useQuery } from '@tanstack/react-query'
import * as Clipboard from 'expo-clipboard'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { Linking, Text, View } from 'react-native'

export default function RecipeCardResultRoute() {
  const router = useRouter()
  const { track } = usePostHog()
  const { id } = useLocalSearchParams<{ id?: string }>()
  const recipeCardId = Array.isArray(id) ? id[0] : id
  const recipeCardQuery = useQuery({
    enabled: Boolean(recipeCardId),
    queryKey: ['recipe-card', recipeCardId],
    queryFn: () => getRecipeCard(recipeCardId ?? ''),
  })

  useEffect(() => {
    if (!recipeCardQuery.data) {
      return
    }

    track('recipe_result_viewed', getAnalyticsProperties(recipeCardQuery.data))
  }, [recipeCardQuery.data, track])

  if (!recipeCardId) {
    return (
      <Screen>
        <EmptyState
          title="Recipe card not found"
          message="Go back home and open a generated recipe card again."
          actionLabel="Back to Home"
          onActionPress={() => router.replace('/home')}
        />
      </Screen>
    )
  }

  if (recipeCardQuery.isLoading) {
    return (
      <Screen>
        <LoadingState message="Loading recipe card..." />
      </Screen>
    )
  }

  if (recipeCardQuery.error) {
    return (
      <Screen>
        <ErrorState
          title="Could not load recipe card"
          message={recipeCardQuery.error.message}
          retryLabel="Retry"
          onRetry={() => {
            void recipeCardQuery.refetch()
          }}
          secondaryActionLabel="Back to Home"
          onSecondaryAction={() => router.replace('/home')}
        />
      </Screen>
    )
  }

  if (!recipeCardQuery.data) {
    return (
      <Screen>
        <EmptyState
          title="Recipe card not found"
          message="Go back home and open a generated recipe card again."
          actionLabel="Back to Home"
          onActionPress={() => router.replace('/home')}
        />
      </Screen>
    )
  }

  const recipeCard = recipeCardQuery.data
  const sourcePlatform = recipeCard.source_link
    ? detectRecipePlatform(recipeCard.source_link)
    : null
  const canOpenSource = isValidHttpUrl(recipeCard.source_link)

  const copyGroceryList = async () => {
    if (recipeCard.grocery_list.length === 0) {
      return
    }

    await Clipboard.setStringAsync(recipeCard.grocery_list.join('\n'))
    track('grocery_list_copied', getAnalyticsProperties(recipeCard))
  }

  const openOriginalSource = async () => {
    if (!recipeCard.source_link || !canOpenSource) {
      return
    }

    const canOpenUrl = await Linking.canOpenURL(recipeCard.source_link)

    if (canOpenUrl) {
      await Linking.openURL(recipeCard.source_link)
      track('original_source_opened', getAnalyticsProperties(recipeCard))
    }
  }

  return (
    <Screen>
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {sourcePlatform ? <PlatformBadge platform={sourcePlatform} /> : null}
          <StatusBadge label={getConfidenceLabel(recipeCard.confidence)} />
        </View>
        <Text selectable style={[typography.title, { color: colors.text }]}>
          {recipeCard.recipe_title?.trim() || 'Untitled recipe'}
        </Text>
        {sourcePlatform ? (
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Source: {getPlatformLabel(sourcePlatform)}
          </Text>
        ) : null}
        {recipeCard.model_used === 'mock' ? (
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Mock recipe card - real AI generation is coming next.
          </Text>
        ) : null}
      </View>

      <Card>
        <Text selectable style={[typography.heading, { color: colors.text }]}>
          Summary
        </Text>
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          {recipeCard.short_summary?.trim() ||
            'No summary is available for this recipe card yet.'}
        </Text>
      </Card>

      <InfoGrid recipeCard={recipeCard} />
      <IngredientsSection ingredients={recipeCard.ingredients} />
      <StepsSection steps={recipeCard.steps} />
      <GroceryListSection
        groceryList={recipeCard.grocery_list}
        onCopy={copyGroceryList}
      />
      <SubstitutionsSection substitutions={recipeCard.substitutions} />
      <StorageSafetySection recipeCard={recipeCard} />
      <MissingInfoSection missingInfo={recipeCard.missing_info} />

      {canOpenSource ? (
        <Button
          label="Open Original Recipe"
          fullWidth
          variant="secondary"
          onPress={() => {
            void openOriginalSource()
          }}
        />
      ) : null}

      <View style={{ gap: spacing.md }}>
        <Button
          label="Back to Home"
          fullWidth
          onPress={() => router.replace('/home')}
        />
        <Button
          label="Save another recipe"
          fullWidth
          variant="secondary"
          onPress={() => router.push('/save-recipe')}
        />
      </View>
    </Screen>
  )
}

function InfoGrid({ recipeCard }: { recipeCard: RecipeCard }) {
  const prepTime = formatMinutes(recipeCard.time.prep_time_minutes)
  const cookTime = formatMinutes(recipeCard.time.cook_time_minutes)

  return (
    <Card>
      <Text selectable style={[typography.heading, { color: colors.text }]}>
        Time and serving
      </Text>
      <View style={{ gap: spacing.sm }}>
        <InfoRow label="Prep" value={prepTime} />
        <InfoRow label="Cook" value={cookTime} />
        <InfoRow label="Servings" value={recipeCard.servings || 'Not specified'} />
        <InfoRow label="Difficulty" value={titleCase(recipeCard.difficulty)} />
      </View>
    </Card>
  )
}

function IngredientsSection({
  ingredients,
}: {
  ingredients: RecipeCardIngredient[]
}) {
  return (
    <Card>
      <Text selectable style={[typography.heading, { color: colors.text }]}>
        Ingredients
      </Text>
      {ingredients.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          {ingredients.map((ingredient, index) => (
            <View key={`${ingredient.name}-${index}`} style={{ gap: spacing.xs }}>
              <Text selectable style={[typography.body, { color: colors.text }]}>
                {ingredient.name}
              </Text>
              <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
                {ingredient.quantity}
                {ingredient.notes ? ` - ${ingredient.notes}` : ''}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          No ingredients are available yet.
        </Text>
      )}
    </Card>
  )
}

function StepsSection({ steps }: { steps: RecipeCardStep[] }) {
  return (
    <Card>
      <Text selectable style={[typography.heading, { color: colors.text }]}>
        Steps
      </Text>
      {steps.length > 0 ? (
        <View style={{ gap: spacing.lg }}>
          {steps.map((step, index) => (
            <View key={`${step.step_number}-${index}`} style={{ gap: spacing.xs }}>
              <Text selectable style={[typography.body, { color: colors.text }]}>
                {step.step_number}. {step.instruction}
              </Text>
              {step.urdu_or_roman_urdu_tip ? (
                <Text
                  selectable
                  style={[typography.caption, { color: colors.textMuted }]}
                >
                  {step.urdu_or_roman_urdu_tip}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          No steps are available yet.
        </Text>
      )}
    </Card>
  )
}

function GroceryListSection({
  groceryList,
  onCopy,
}: {
  groceryList: string[]
  onCopy: () => Promise<void>
}) {
  return (
    <Card>
      <Text selectable style={[typography.heading, { color: colors.text }]}>
        Grocery list
      </Text>
      {groceryList.length > 0 ? (
        <>
          <View style={{ gap: spacing.sm }}>
            {groceryList.map((item, index) => (
              <Text
                key={`${item}-${index}`}
                selectable
                style={[typography.body, { color: colors.text }]}
              >
                - {item}
              </Text>
            ))}
          </View>
          <Button
            label="Copy Grocery List"
            variant="secondary"
            onPress={() => {
              void onCopy()
            }}
          />
        </>
      ) : (
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          No grocery list is available yet.
        </Text>
      )}
    </Card>
  )
}

function SubstitutionsSection({
  substitutions,
}: {
  substitutions: RecipeCardSubstitution[]
}) {
  if (substitutions.length === 0) {
    return null
  }

  return (
    <Card>
      <Text selectable style={[typography.heading, { color: colors.text }]}>
        Substitutions
      </Text>
      <View style={{ gap: spacing.md }}>
        {substitutions.map((substitution, index) => (
          <View
            key={`${substitution.original}-${substitution.substitute}-${index}`}
            style={{ gap: spacing.xs }}
          >
            <Text selectable style={[typography.body, { color: colors.text }]}>
              {substitution.original}
              {' -> '}
              {substitution.substitute}
            </Text>
            {substitution.note ? (
              <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
                {substitution.note}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </Card>
  )
}

function StorageSafetySection({ recipeCard }: { recipeCard: RecipeCard }) {
  if (!recipeCard.storage_tip && !recipeCard.safety_note) {
    return null
  }

  return (
    <Card>
      <Text selectable style={[typography.heading, { color: colors.text }]}>
        Storage and safety
      </Text>
      {recipeCard.storage_tip ? (
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          {recipeCard.storage_tip}
        </Text>
      ) : null}
      {recipeCard.safety_note ? (
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          {recipeCard.safety_note}
        </Text>
      ) : null}
    </Card>
  )
}

function MissingInfoSection({ missingInfo }: { missingInfo: string[] }) {
  if (missingInfo.length === 0) {
    return null
  }

  return (
    <Card>
      <Text selectable style={[typography.heading, { color: colors.text }]}>
        Missing details
      </Text>
      <View style={{ gap: spacing.sm }}>
        {missingInfo.map((item, index) => (
          <Text
            key={`${item}-${index}`}
            selectable
            style={[typography.body, { color: colors.textMuted }]}
          >
            - {item}
          </Text>
        ))}
      </View>
    </Card>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
      }}
    >
      <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
        {label}
      </Text>
      <Text selectable style={[typography.body, { color: colors.text }]}>
        {value}
      </Text>
    </View>
  )
}

function StatusBadge({ label }: { label: string }) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceMuted,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
      }}
    >
      <Text selectable style={[typography.caption, { color: colors.primary }]}>
        {label}
      </Text>
    </View>
  )
}

function getAnalyticsProperties(recipeCard: RecipeCard) {
  return {
    confidence: recipeCard.confidence,
    model_used: recipeCard.model_used,
    has_grocery_list: recipeCard.grocery_list.length > 0,
    has_missing_info: recipeCard.missing_info.length > 0,
  }
}

function getConfidenceLabel(confidence: string | null) {
  const normalizedConfidence = confidence?.trim().toLowerCase()

  if (
    normalizedConfidence === 'low' ||
    normalizedConfidence === 'medium' ||
    normalizedConfidence === 'high'
  ) {
    return `Confidence: ${normalizedConfidence}`
  }

  return 'Confidence: unknown'
}

function formatMinutes(value: number | null) {
  return value === null ? 'Not specified' : `${value} min`
}

function titleCase(value: string | null) {
  if (!value) {
    return 'Not specified'
  }

  return value
    .replaceAll('_', ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
