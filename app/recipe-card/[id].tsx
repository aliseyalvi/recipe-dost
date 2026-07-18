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
import {
  AiRecipeHero,
  DetailChip,
  EditorialButton,
  EditorialSection,
  HeaderIconButton,
  RecipeDetailScaffold,
  RecipeStatGrid,
} from '@/features/recipe-detail/detail-presentation'
import { RecipeDetailActionMenu } from '@/features/recipe-detail/recipe-detail-action-menu'
import { AiReportSheet } from '@/features/ai-report/ai-report-sheet'
import { PlatformBadge } from '@/features/recipe-draft/platform-badge'
import {
  RecipeCard,
  GroceryItem,
  RecipeCardIngredient,
  RecipeCardStep,
  RecipeCardSubstitution,
  deleteRecipe,
  getRecipeCard,
  getLatestMediaJobForRecipe,
  toggleFavorite,
} from '@/lib/api/recipes'
import { getFriendlyApiErrorMessage } from '@/lib/api/errors'
import { useRefetchOnAppForeground } from '@/lib/query/use-refetch-on-app-foreground'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { borders, colors, radius, spacing, typography } from '@/theme'
import { AppBadge } from '@/ui/app-badge'
import { AppHeader } from '@/ui/app-header'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { EmptyState } from '@/ui/empty-state'
import { ErrorState } from '@/ui/error-state'
import { LoadingState } from '@/ui/loading-state'
import { Screen } from '@/ui/screen'
import {
  NestedHeaderIconButton,
  NestedScreenHeader,
} from '@/ui/screen-header'
import { UrduText } from '@/ui/urdu-text'
import { getPlatformIconName, type AppIconName } from '@/ui/app-icon'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as Clipboard from 'expo-clipboard'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Image, Linking, Pressable, Text, View } from 'react-native'

export default function RecipeCardResultRoute() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { track } = usePostHog()
  const { language: globalLanguage } = useRecipeContentLanguage()
  const [screenLanguage, setScreenLanguage] =
    useState<RecipeContentLanguage | null>(null)
  const [isUpdatingFavorite, setIsUpdatingFavorite] = useState(false)
  const [isDeletingRecipe, setIsDeletingRecipe] = useState(false)
  const [isOptionsOpen, setIsOptionsOpen] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [recipeManagementError, setRecipeManagementError] = useState<Error | null>(
    null
  )
  const didTrackResultOpened = useRef(false)
  const { id } = useLocalSearchParams<{ id?: string }>()
  const recipeCardId = Array.isArray(id) ? id[0] : id
  const recipeCardQuery = useQuery({
    enabled: Boolean(recipeCardId),
    queryKey: ['recipe-card', recipeCardId],
    queryFn: () => getRecipeCard(recipeCardId ?? ''),
  })
  const mediaJobQuery = useQuery({
    enabled: Boolean(recipeCardQuery.data?.recipe_id),
    queryKey: ['media-job', 'recipe', recipeCardQuery.data?.recipe_id],
    queryFn: () => getLatestMediaJobForRecipe(recipeCardQuery.data?.recipe_id ?? ''),
  })

  const refetchRecipeCard = useCallback(
    () => Promise.all([recipeCardQuery.refetch(), mediaJobQuery.refetch()]),
    [mediaJobQuery.refetch, recipeCardQuery.refetch]
  )

  useFocusEffect(
    useCallback(() => {
      if (recipeCardId && !recipeCardQuery.isLoading) {
        void refetchRecipeCard()
      }
    }, [recipeCardId, recipeCardQuery.isLoading, refetchRecipeCard])
  )

  useRefetchOnAppForeground({
    enabled: Boolean(recipeCardId),
    refetch: refetchRecipeCard,
  })

  useEffect(() => {
    if (!recipeCardQuery.data) {
      return
    }

    const analyticsProperties = getAnalyticsProperties(recipeCardQuery.data)

    track('recipe_result_viewed', analyticsProperties)

    if (!didTrackResultOpened.current) {
      didTrackResultOpened.current = true
      track('recipe_result_opened', analyticsProperties)
    }
  }, [recipeCardQuery.data, track])

  if (!recipeCardId) {
    return (
      <Screen>
        <NestedScreenHeader
          title="AI Recipe"
          fallbackRoute="/"
        />
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
        <NestedScreenHeader
          title="AI Recipe"
          fallbackRoute="/"
        />
        <LoadingState message="Loading recipe card..." />
      </Screen>
    )
  }

  if (recipeCardQuery.error) {
    return (
      <Screen>
        <NestedScreenHeader
          title="AI Recipe"
          fallbackRoute="/"
        />
        <ErrorState
          title="Could not load recipe card"
          message={getFriendlyApiErrorMessage(
            recipeCardQuery.error,
            recipeCardQuery.error.message
          )}
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
        <NestedScreenHeader
          title="AI Recipe"
          fallbackRoute="/"
        />
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
  const thumbnailUrl =
    mediaJobQuery.data?.thumbnail_url ??
    mediaJobQuery.data?.source_metadata.uploaded_thumbnail_url
  const sourceMetadata = mediaJobQuery.data?.source_metadata
  const sourceCreator = getSafeSourceCreator(
    sourceMetadata?.author_username
  )
  const sourceDuration = sourceMetadata?.duration_seconds
  const sourcePlatformLabel = sourcePlatform
    ? getPlatformLabel(sourcePlatform)
    : sourceMetadata?.platform?.trim()
      ? titleCase(sourceMetadata.platform)
      : null

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

  const openTagSearch = (tag: string) => {
    track('recipe_tag_search_opened', {
      tag_count: recipeCard.tags.length,
    })
    router.push(`/library?query=${encodeURIComponent(tag)}`)
  }

  const invalidateRecipeManagement = () => {
    void queryClient.invalidateQueries({ queryKey: ['recent-recipes'] })
    void queryClient.invalidateQueries({ queryKey: ['recipe-library'] })
    void queryClient.invalidateQueries({ queryKey: ['recipe-item', recipeCard.recipe_id] })
    void queryClient.invalidateQueries({ queryKey: ['recipe-card'] })
    void queryClient.invalidateQueries({ queryKey: ['recipe-grocery-list'] })
    void queryClient.invalidateQueries({ queryKey: ['recipe-grocery-lists'] })
  }

  const handleToggleFavorite = async () => {
    if (isUpdatingFavorite || isDeletingRecipe) {
      return
    }

    setIsUpdatingFavorite(true)
    setRecipeManagementError(null)

    try {
      const isFavorite = await toggleFavorite(
        recipeCard.recipe_id,
        recipeCard.is_favorite
      )

      queryClient.setQueryData(['recipe-card', recipeCard.id], {
        ...recipeCard,
        is_favorite: isFavorite,
      })
      invalidateRecipeManagement()
      track('recipe_favorite_toggled', {
        platform: sourcePlatform ?? 'other',
        is_favorite: isFavorite,
        source: 'recipe_card_detail',
      })
    } catch {
      setRecipeManagementError(new Error('Could not update this favorite. Please try again.'))
      track('recipe_favorite_toggle_failed', {
        platform: sourcePlatform ?? 'other',
        source: 'recipe_card_detail',
      })
    } finally {
      setIsUpdatingFavorite(false)
    }
  }

  const handleDeleteRecipe = async () => {
    if (isDeletingRecipe) {
      return
    }

    setIsDeletingRecipe(true)
    setRecipeManagementError(null)

    try {
      await deleteRecipe(recipeCard.recipe_id)
      queryClient.removeQueries({ queryKey: ['recipe-card', recipeCard.id] })
      invalidateRecipeManagement()
      track('recipe_deleted', {
        platform: sourcePlatform ?? 'other',
        source: 'recipe_card_detail',
      })
      router.replace('/library')
    } catch {
      setRecipeManagementError(new Error('Could not delete this saved recipe. Please try again.'))
      track('recipe_delete_failed', {
        platform: sourcePlatform ?? 'other',
        source: 'recipe_card_detail',
      })
    } finally {
      setIsDeletingRecipe(false)
    }
  }

  const redesignedResult = (
    <>
    <RecipeDetailScaffold
      title="Recipe Dost"
      fallbackRoute="/library"
      rightActions={
        <HeaderIconButton
          label="Recipe options"
          icon="more-vertical"
          onPress={() => setIsOptionsOpen(true)}
        />
      }
    >
      <AiRecipeHero
        thumbnailUrl={thumbnailUrl ?? null}
        title={titleSelection.primary}
        tags={recipeCard.tags}
        onTagPress={openTagSearch}
      />

      {sourcePlatformLabel || sourceCreator || sourceDuration || canOpenSource ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: spacing.sm,
          }}
        >
          {sourcePlatformLabel ? (
            <DetailChip icon={getPlatformIconName(sourcePlatformLabel)} label={sourcePlatformLabel} accent />
          ) : null}
          {sourceCreator ? <DetailChip icon="creator" label={sourceCreator} /> : null}
          {typeof sourceDuration === 'number' && sourceDuration > 0 ? (
            <DetailChip icon="clock" label={formatSourceDuration(sourceDuration)} />
          ) : null}
          {canOpenSource ? (
            <DetailChip icon="link" label="Original source" />
          ) : null}
        </View>
      ) : null}

      {titleSelection.usedFallback && contentLanguage === 'urdu' ? (
        <Text selectable style={[typography.caption, { color: colors.onSurfaceVariant, textAlign: 'center' }]}>
          Urdu script is available for newly generated cards.
        </Text>
      ) : null}

      <ContentLanguageControl
        value={contentLanguage}
        onChange={setScreenLanguage}
      />

      <RecipeStatGrid stats={getAiRecipeStats(recipeCard)} />

      {shouldShowLowConfidenceWarning(recipeCard) ? (
        <View
          style={{
            gap: spacing.sm,
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: colors.warning,
            backgroundColor: colors.warningSurface,
            padding: spacing.cardPadding,
          }}
        >
          <Text selectable style={[typography.heading, { color: colors.warning }]}>
            Review recipe details
          </Text>
          <Text selectable style={[typography.body, { color: colors.onSurface }]}>
            This AI recipe may be missing details. Check the original video before cooking.
          </Text>
        </View>
      ) : null}

      <EditorialSection title="The Story">
        <LanguageTextBlock
          english={recipeCard.short_summary_en ?? recipeCard.short_summary}
          urdu={recipeCard.short_summary_ur}
          language={contentLanguage}
          muted
          fallback="No summary is available for this recipe card yet."
        />
      </EditorialSection>

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
        <EditorialButton
          label="Open Grocery List"
          icon="grocery"
          variant="primary"
          onPress={() =>
            router.push(
              `/grocery?recipeCardId=${recipeCard.id}&returnTo=${encodeURIComponent(
                `/recipe-card/${recipeCard.id}`
              )}`
            )
          }
        />
      ) : null}
      <SubstitutionsSection substitutions={recipeCard.substitutions} />
      <StorageSafetySection recipeCard={recipeCard} language={contentLanguage} />
      <MissingInfoSection recipeCard={recipeCard} language={contentLanguage} />

      {recipeManagementError ? (
        <View
          style={{
            gap: spacing.sm,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.error,
            backgroundColor: colors.dangerSurface,
            padding: spacing.lg,
          }}
        >
          <Text selectable style={[typography.heading, { color: colors.error }]}>
            Could not update recipe
          </Text>
          <Text selectable style={[typography.body, { color: colors.onSurface }]}>
            {recipeManagementError.message}
          </Text>
        </View>
      ) : null}

    </RecipeDetailScaffold>
    <RecipeDetailActionMenu
      visible={isOptionsOpen}
      title={titleSelection.primary}
      subtitle={sourcePlatformLabel}
      isFavorite={recipeCard.is_favorite}
      isFavoriteUpdating={isUpdatingFavorite}
      isDeleting={isDeletingRecipe}
      canOpenOriginal={canOpenSource}
      canViewSource={Boolean(recipeCard.recipe_id)}
      errorMessage={recipeManagementError?.message}
      onClose={() => setIsOptionsOpen(false)}
      onOpenOriginal={() => {
        void openOriginalSource()
      }}
      onViewSource={() =>
        router.push(
          `/recipe/${recipeCard.recipe_id}?returnTo=${encodeURIComponent(
            `/recipe-card/${recipeCard.id}`
          )}`
        )
      }
      onToggleFavorite={() => {
        void handleToggleFavorite()
      }}
      onDelete={() => {
        void handleDeleteRecipe()
      }}
      onReport={() => setIsReportOpen(true)}
    />
    <AiReportSheet
      recipeCardId={recipeCard.id}
      visible={isReportOpen}
      onClose={() => setIsReportOpen(false)}
    />
    </>
  )

  if (Boolean(recipeCard.id)) {
    return redesignedResult
  }

  return (
    <Screen compact>
      <NestedScreenHeader
        title="AI Recipe"
        fallbackRoute="/"
        rightActions={
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            <NestedHeaderIconButton
              accessibilityLabel={
                recipeCard.is_favorite
                  ? 'Remove recipe from favorites'
                  : 'Add recipe to favorites'
              }
              icon={recipeCard.is_favorite ? 'heart' : 'heart-outline'}
              onPress={() => {
                void handleToggleFavorite()
              }}
            />
            {canOpenSource ? (
              <NestedHeaderIconButton
                accessibilityLabel="Open original video"
                icon="external"
                onPress={() => {
                  void openOriginalSource()
                }}
              />
            ) : null}
          </View>
        }
      />
      <Card tone="warm">
        <View
          style={{
            overflow: 'hidden',
            aspectRatio: 1.55,
            borderRadius: radius.lg,
            backgroundColor: colors.surfaceMuted,
          }}
        >
          {thumbnailUrl ? (
            <Image
              source={{ uri: thumbnailUrl }}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
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
          )}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {sourcePlatform ? <PlatformBadge platform={sourcePlatform} /> : null}
          <AppBadge label="AI Card" tone="accent" />
          {recipeCard.is_favorite ? <AppBadge label="Favorite" tone="accent" /> : null}
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
        <ContentLanguageControl
          value={contentLanguage}
          onChange={setScreenLanguage}
        />
      </Card>

      {shouldShowLowConfidenceWarning(recipeCard) ? (
        <Card tone="muted">
          <Text selectable style={[typography.heading, { color: colors.warning }]}>
            Review recipe details
          </Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            This AI recipe may be missing details. Check the original video
            before cooking.
          </Text>
        </Card>
      ) : null}

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

      <TagsSection tags={recipeCard.tags} onTagPress={openTagSearch} />
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
          onPress={() =>
            router.push(
              `/grocery?recipeCardId=${recipeCard.id}&returnTo=${encodeURIComponent(
                `/recipe-card/${recipeCard.id}`
              )}`
            )
          }
        />
      ) : null}
      <SubstitutionsSection substitutions={recipeCard.substitutions} />
      <StorageSafetySection recipeCard={recipeCard} language={contentLanguage} />
      <MissingInfoSection recipeCard={recipeCard} language={contentLanguage} />

      {recipeManagementError ? (
        <Card tone="muted">
          <Text selectable style={[typography.heading, { color: colors.warning }]}>
            Could not update recipe management
          </Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            {recipeManagementError.message}
          </Text>
        </Card>
      ) : null}

      <View style={{ gap: spacing.md }}>
        <Button
          label="Back to Home"
          fullWidth
          onPress={() => router.replace('/home')}
        />
      </View>
    </Screen>
  )
}

function InfoGrid({ recipeCard }: { recipeCard: RecipeCard }) {
  const difficulty = recipeCard.difficulty?.trim()
  const servings = recipeCard.servings?.trim()

  return (
    <Card>
      <Text selectable style={[typography.heading, { color: colors.text }]}>
        Time and serving
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {recipeCard.time.prep_time_minutes ? (
          <AppBadge label={`Prep: ${formatMinutes(recipeCard.time.prep_time_minutes)}`} />
        ) : null}
        {recipeCard.time.cook_time_minutes ? (
          <AppBadge label={`Cook: ${formatMinutes(recipeCard.time.cook_time_minutes)}`} />
        ) : null}
        {isKnownStatValue(servings) ? (
          <AppBadge label={`Servings: ${servings}`} />
        ) : null}
        {isKnownStatValue(difficulty) ? (
          <AppBadge label={`Difficulty: ${titleCase(difficulty ?? null)}`} />
        ) : null}
      </View>
    </Card>
  )
}

function TagsSection({
  tags,
  onTagPress,
}: {
  tags: string[]
  onTagPress: (tag: string) => void
}) {
  if (tags.length === 0) {
    return null
  }

  return (
    <Card>
      <Text selectable style={[typography.heading, { color: colors.text }]}>
        Tags
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {tags.slice(0, 8).map((tag) => (
          <Pressable
            key={tag}
            accessibilityRole="button"
            accessibilityLabel={`Search for ${titleCase(tag)} recipes`}
            hitSlop={4}
            onPress={() => onTagPress(tag)}
            style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
          >
            <AppBadge label={titleCase(tag)} tone="primary" />
          </Pressable>
        ))}
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
    <EditorialSection
      title="The Ingredients"
      subtitle="Essential components for this recipe"
    >
      {ingredients.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          {ingredients.map((ingredient, index) => (
            <View
              key={`${ingredient.name}-${index}`}
              style={{
                gap: spacing.xs,
                borderRadius: radius.card,
                ...borders.subtle,
                backgroundColor: colors.surfaceContainerLow,
                padding: spacing.cardPadding,
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
        <Text selectable style={[typography.body, { color: colors.onSurfaceVariant }]}>
          No ingredients are available yet.
        </Text>
      )}
    </EditorialSection>
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
    <EditorialSection title="Recipe Steps">
      {steps.length > 0 ? (
        <View style={{ gap: spacing.lg }}>
          {steps.map((step, index) => (
            <View
              key={`${step.step_number}-${index}`}
              style={{
                gap: spacing.sm,
                borderRadius: radius.card,
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.08)',
                backgroundColor: colors.surfaceContainerLow,
                padding: spacing.cardPadding,
              }}
            >
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: radius.pill,
                    backgroundColor: colors.primaryContainer,
                  }}
                >
                  <Text
                    selectable={false}
                    style={[typography.body, { color: colors.onPrimaryContainer, fontWeight: '800' }]}
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
        <Text selectable style={[typography.body, { color: colors.onSurfaceVariant }]}>
          No steps are available yet.
        </Text>
      )}
    </EditorialSection>
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
    source_mode: recipeCard.source_mode ?? 'legacy_unknown',
    has_grocery_list: recipeCard.grocery_items.length > 0,
    has_missing_info: recipeCard.missing_info.length > 0,
  }
}

function shouldShowLowConfidenceWarning(recipeCard: RecipeCard) {
  return (
    recipeCard.confidence?.trim().toLowerCase() === 'low' &&
    (
      recipeCard.missing_info.length > 0 ||
      recipeCard.ingredients.length < 3 ||
      recipeCard.steps.length < 2
    )
  )
}

function getAiRecipeStats(recipeCard: RecipeCard) {
  const stats: { icon: AppIconName; label: string; value: string }[] = []

  if (recipeCard.time.prep_time_minutes) {
    stats.push({
      icon: 'clock',
      label: 'Prep time',
      value: `${recipeCard.time.prep_time_minutes} min`,
    })
  }

  if (recipeCard.time.cook_time_minutes) {
    stats.push({
      icon: 'flame',
      label: 'Cook time',
      value: `${recipeCard.time.cook_time_minutes} min`,
    })
  }

  if (isKnownStatValue(recipeCard.servings)) {
    stats.push({ icon: 'servings', label: 'Servings', value: recipeCard.servings!.trim() })
  }

  if (isKnownStatValue(recipeCard.difficulty)) {
    stats.push({
      icon: 'ai-recipe',
      label: 'Difficulty',
      value: titleCase(recipeCard.difficulty!),
    })
  }

  return stats
}

function isKnownStatValue(value: string | null | undefined) {
  const normalized = value?.trim().toLocaleLowerCase()
  return Boolean(
    normalized &&
      normalized !== 'unknown' &&
      normalized !== 'not specified' &&
      normalized !== 'n/a'
  )
}

function getSafeSourceCreator(value: string | null | undefined) {
  const candidate = value?.trim()

  if (!candidate || /^(?:https?:\/\/|www\.)/i.test(candidate)) {
    return null
  }

  return candidate
}

function formatSourceDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60

  return minutes > 0
    ? `${minutes}m${remainder ? ` ${remainder}s` : ''}`
    : `${remainder}s`
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
