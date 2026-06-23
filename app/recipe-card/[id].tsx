import {
  RecipeContentLanguage,
  useRecipeContentLanguage,
} from '@/features/language/content-language'
import { ContentLanguageControl } from '@/features/language/content-language-control'
import {
  hasUrduScript,
  selectLocalizedText,
} from '@/features/language/localized-text'
import {
  detectRecipePlatform,
  getPlatformLabel,
  isValidHttpUrl,
} from '@/features/recipe-draft/platform'
import { PlatformBadge } from '@/features/recipe-draft/platform-badge'
import {
  RecipeCard,
  GroceryItem,
  RecipeCardIngredient,
  RecipeCardStep,
  RecipeCardSubstitution,
  getRecipeCard,
} from '@/lib/api/recipes'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, radius, spacing, typography } from '@/theme'
import { AppBadge } from '@/ui/app-badge'
import { AppHeader } from '@/ui/app-header'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { EmptyState } from '@/ui/empty-state'
import { ErrorState } from '@/ui/error-state'
import { LoadingState } from '@/ui/loading-state'
import { Screen } from '@/ui/screen'
import { UrduText } from '@/ui/urdu-text'
import { useQuery } from '@tanstack/react-query'
import * as Clipboard from 'expo-clipboard'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Linking, Text, View } from 'react-native'

export default function RecipeCardResultRoute() {
  const router = useRouter()
  const { track } = usePostHog()
  const { language: globalLanguage } = useRecipeContentLanguage()
  const [screenLanguage, setScreenLanguage] =
    useState<RecipeContentLanguage | null>(null)
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
  const contentLanguage = screenLanguage ?? globalLanguage
  const sourcePlatform = recipeCard.source_link
    ? detectRecipePlatform(recipeCard.source_link)
    : null
  const canOpenSource = isValidHttpUrl(recipeCard.source_link)
  const canViewGroceryList =
    recipeCard.grocery_items.length > 0 || recipeCard.ingredients.length > 0
  const titleSelection = selectLocalizedText({
    english: recipeCard.recipe_title_en ?? recipeCard.recipe_title,
    urdu: recipeCard.recipe_title_ur,
    language: contentLanguage,
    fallback: 'Untitled recipe',
  })

  const copyGroceryList = async () => {
    if (recipeCard.grocery_items.length === 0) {
      return
    }

    await Clipboard.setStringAsync(
      formatGroceryItemsCopy(recipeCard.grocery_items, contentLanguage)
    )
    track('grocery_list_copied', {
      item_count: recipeCard.grocery_items.length,
      checked_count: 0,
      has_recipe_title: Boolean(recipeCard.recipe_title?.trim()),
    })
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
    <Screen compact>
      <Card tone="warm">
        <View
          style={{
            overflow: 'hidden',
            aspectRatio: 1.55,
            borderRadius: radius.lg,
            backgroundColor: colors.surfaceMuted,
          }}
        >
          <View
            style={{
              flex: 1,
              justifyContent: 'flex-end',
              gap: spacing.sm,
              padding: spacing.lg,
            }}
          >
            <Text
              selectable={false}
              style={{
                color: colors.text,
                fontSize: 42,
                lineHeight: 46,
                fontWeight: '900',
              }}
            >
              Recipe Card
            </Text>
            <View
              style={{
                width: '70%',
                height: 8,
                borderRadius: radius.pill,
                backgroundColor: colors.primary,
              }}
            />
            <View
              style={{
                width: '46%',
                height: 8,
                borderRadius: radius.pill,
                backgroundColor: colors.accent,
              }}
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {sourcePlatform ? <PlatformBadge platform={sourcePlatform} /> : null}
          <AppBadge label="AI Card" tone="accent" />
          <AppBadge label={getConfidenceLabel(recipeCard.confidence)} />
        </View>
        <AppHeader
          eyebrow="AI recipe card"
          title={titleSelection.primary}
          subtitle={
            sourcePlatform ? `Source: ${getPlatformLabel(sourcePlatform)}` : undefined
          }
        />
        {titleSelection.usedFallback && contentLanguage === 'urdu' ? (
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Urdu script is available for newly generated cards.
          </Text>
        ) : null}
        {__DEV__ && recipeCard.model_used ? (
          <AppBadge label={`Model: ${recipeCard.model_used}`} />
        ) : null}
        <ContentLanguageControl
          value={contentLanguage}
          onChange={setScreenLanguage}
        />
      </Card>

      <Card tone="warm">
        <Text selectable style={[typography.heading, { color: colors.text }]}>
          Summary
        </Text>
        <LanguageTextBlock
          english={recipeCard.short_summary_en ?? recipeCard.short_summary}
          urdu={recipeCard.short_summary_ur}
          language={contentLanguage}
          muted
          fallback="No summary is available for this recipe card yet."
        />
      </Card>

      <InfoGrid recipeCard={recipeCard} />
      <IngredientsSection
        ingredients={recipeCard.ingredients}
        language={contentLanguage}
      />
      <StepsSection steps={recipeCard.steps} language={contentLanguage} />
      <GroceryListSection
        groceryItems={recipeCard.grocery_items}
        language={contentLanguage}
        onCopy={copyGroceryList}
      />
      {canViewGroceryList ? (
        <Button
          label="Open Grocery List"
          fullWidth
          variant="accent"
          onPress={() => router.push(`/grocery?recipeCardId=${recipeCard.id}`)}
        />
      ) : null}
      <SubstitutionsSection substitutions={recipeCard.substitutions} />
      <StorageSafetySection recipeCard={recipeCard} language={contentLanguage} />
      <MissingInfoSection recipeCard={recipeCard} language={contentLanguage} />

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
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <AppBadge label={`Prep: ${prepTime}`} />
        <AppBadge label={`Cook: ${cookTime}`} />
        <AppBadge label={`Servings: ${recipeCard.servings || 'Not specified'}`} />
        <AppBadge label={`Difficulty: ${titleCase(recipeCard.difficulty)}`} />
      </View>
    </Card>
  )
}

function IngredientsSection({
  ingredients,
  language,
}: {
  ingredients: RecipeCardIngredient[]
  language: RecipeContentLanguage
}) {
  return (
    <Card>
      <Text selectable style={[typography.heading, { color: colors.text }]}>
        Ingredients
      </Text>
      {ingredients.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          {ingredients.map((ingredient, index) => (
            <View
              key={`${ingredient.name}-${index}`}
              style={{
                gap: spacing.xs,
                borderRadius: radius.md,
                backgroundColor: colors.surfaceMuted,
                padding: spacing.md,
              }}
            >
              <LanguageTextBlock
                english={ingredient.name_en ?? ingredient.name}
                urdu={ingredient.name_ur}
                language={language}
              />
              <LanguageTextBlock
                english={`${ingredient.quantity}${
                  ingredient.notes_en ?? ingredient.notes
                    ? ` - ${ingredient.notes_en ?? ingredient.notes}`
                    : ''
                }`}
                urdu={ingredient.notes_ur}
                language={language}
                muted
              />
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

function StepsSection({
  steps,
  language,
}: {
  steps: RecipeCardStep[]
  language: RecipeContentLanguage
}) {
  return (
    <Card>
      <Text selectable style={[typography.heading, { color: colors.text }]}>
        Steps
      </Text>
      {steps.length > 0 ? (
        <View style={{ gap: spacing.lg }}>
          {steps.map((step, index) => (
            <View
              key={`${step.step_number}-${index}`}
              style={{
                gap: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: colors.surfaceMuted,
                padding: spacing.md,
              }}
            >
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: radius.pill,
                    backgroundColor: colors.primary,
                  }}
                >
                  <Text
                    selectable={false}
                    style={[typography.caption, { color: colors.primaryText }]}
                  >
                    {step.step_number}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <LanguageTextBlock
                    english={step.instruction_en ?? step.instruction}
                    urdu={step.instruction_ur}
                    language={language}
                  />
                </View>
              </View>
              {step.tip_en || step.tip_ur ? (
                <View
                  style={{
                    borderRadius: radius.sm,
                    backgroundColor: colors.accentSoft,
                    padding: spacing.md,
                  }}
                >
                  <LanguageTextBlock
                    english={step.tip_en}
                    urdu={step.tip_ur}
                    language={language}
                    muted
                  />
                </View>
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
  groceryItems,
  language,
  onCopy,
}: {
  groceryItems: GroceryItem[]
  language: RecipeContentLanguage
  onCopy: () => Promise<void>
}) {
  return (
    <Card>
      <Text selectable style={[typography.heading, { color: colors.text }]}>
        Grocery list
      </Text>
      {groceryItems.length > 0 ? (
        <>
          <View style={{ gap: spacing.sm }}>
            {groceryItems.map((item, index) => (
              <View key={`${item.id}-${index}`}>
                <LanguageTextBlock
                  english={`- ${item.label_en ?? item.label}${
                    item.quantity ? ` - ${item.quantity}` : ''
                  }`}
                  urdu={item.label_ur}
                  language={language}
                />
              </View>
            ))}
          </View>
          <Button
            label="Copy List"
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

function StorageSafetySection({
  recipeCard,
  language,
}: {
  recipeCard: RecipeCard
  language: RecipeContentLanguage
}) {
  if (!recipeCard.storage_tip && !recipeCard.safety_note) {
    return null
  }

  return (
    <Card>
      <Text selectable style={[typography.heading, { color: colors.text }]}>
        Storage and safety
      </Text>
      {recipeCard.storage_tip ? (
        <LanguageTextBlock
          english={recipeCard.storage_tip_en ?? recipeCard.storage_tip}
          urdu={recipeCard.storage_tip_ur}
          language={language}
          muted
        />
      ) : null}
      {recipeCard.safety_note ? (
        <LanguageTextBlock
          english={recipeCard.safety_note_en ?? recipeCard.safety_note}
          urdu={recipeCard.safety_note_ur}
          language={language}
          muted
        />
      ) : null}
    </Card>
  )
}

function MissingInfoSection({
  recipeCard,
  language,
}: {
  recipeCard: RecipeCard
  language: RecipeContentLanguage
}) {
  const missingInfo =
    language === 'urdu' && recipeCard.missing_info_ur.length > 0
      ? recipeCard.missing_info_ur
      : recipeCard.missing_info_en
  const secondaryMissingInfo =
    language === 'both' ? recipeCard.missing_info_ur : []

  if (missingInfo.length === 0) {
    return null
  }

  return (
    <Card tone="muted">
      <Text selectable style={[typography.heading, { color: colors.text }]}>
        Missing details
      </Text>
      <View style={{ gap: spacing.sm }}>
        {missingInfo.map((item, index) => (
          <Text
            key={`${item}-${index}`}
            selectable
            style={[typography.body, { color: colors.warning }]}
          >
            - {item}
          </Text>
        ))}
        {secondaryMissingInfo.map((item, index) => (
          <UrduText key={`${item}-${index}`} muted>
            {`- ${item}`}
          </UrduText>
        ))}
      </View>
    </Card>
  )
}

function LanguageTextBlock({
  english,
  urdu,
  language,
  muted = false,
  fallback,
}: {
  english?: string | null
  urdu?: string | null
  language: RecipeContentLanguage
  muted?: boolean
  fallback?: string
}) {
  const selection = selectLocalizedText({
    english,
    urdu,
    language,
    fallback,
  })

  if (language === 'urdu') {
    return selection.isRtl ? (
      <UrduText muted={muted}>{selection.primary}</UrduText>
    ) : (
      <View style={{ gap: spacing.xs }}>
        <Text
          selectable
          style={[
            typography.body,
            { color: muted ? colors.textMuted : colors.text },
          ]}
        >
          {selection.primary || 'Urdu not available for this older card'}
        </Text>
        {selection.usedFallback ? (
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Urdu script is available for newly generated cards.
          </Text>
        ) : null}
      </View>
    )
  }

  if (language === 'both') {
    return (
      <View style={{ gap: spacing.xs }}>
        {selection.primary ? (
          <Text
            selectable
            style={[
              typography.body,
              { color: muted ? colors.textMuted : colors.text },
            ]}
          >
            {selection.primary}
          </Text>
        ) : null}
        {selection.secondary ? (
          <View
            style={{
              borderRadius: radius.sm,
              backgroundColor: colors.accentSoft,
              padding: spacing.sm,
            }}
          >
            <UrduText muted={muted}>{selection.secondary}</UrduText>
          </View>
        ) : null}
      </View>
    )
  }

  return (
    <Text
      selectable
      style={[typography.body, { color: muted ? colors.textMuted : colors.text }]}
    >
      {selection.primary}
    </Text>
  )
}

function formatGroceryItemsCopy(
  groceryItems: GroceryItem[],
  language: RecipeContentLanguage
) {
  return groceryItems.map((item) => formatGroceryCopyItem(item, language)).join('\n')
}

function formatGroceryCopyItem(item: GroceryItem, language: RecipeContentLanguage) {
  const english = `${item.label_en ?? item.label}${item.quantity ? ` - ${item.quantity}` : ''}`
  const urdu = hasUrduScript(item.label_ur)
    ? `${item.label_ur}${item.quantity ? ` - ${item.quantity}` : ''}`
    : null

  if (language === 'urdu') {
    return `* ${urdu ?? english}`
  }

  if (language === 'both' && urdu) {
    return `* ${english}\n  ${urdu}`
  }

  return `* ${english}`
}

function getAnalyticsProperties(recipeCard: RecipeCard) {
  return {
    confidence: recipeCard.confidence,
    model_used: recipeCard.model_used,
    has_grocery_list: recipeCard.grocery_items.length > 0,
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
