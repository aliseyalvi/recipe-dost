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
import { UsagePill } from '@/features/usage/usage-limit-card'
import { saveRecipeItem } from '@/lib/api/recipes'
import { getUsageSummary } from '@/lib/api/usage'
import { useAuth } from '@/providers/auth-provider'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, radius, spacing, typography } from '@/theme'
import { AppHeader } from '@/ui/app-header'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { EmptyState } from '@/ui/empty-state'
import { ErrorState } from '@/ui/error-state'
import { LoadingState } from '@/ui/loading-state'
import { Screen } from '@/ui/screen'
import { TextArea } from '@/ui/text-area'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Image, Text, View } from 'react-native'

export default function RecipePreviewRoute() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { track } = usePostHog()
  const { clearDraft, draft, updateDraft } = useRecipeDraftStore()
  const [userNote, setUserNote] = useState(draft?.user_note ?? '')
  const [pastedCaption, setPastedCaption] = useState(draft?.pasted_caption ?? '')
  const [manualIngredients, setManualIngredients] = useState(
    draft?.manual_ingredients ?? ''
  )
  const [mealType, setMealType] = useState<RecipeMealType | undefined>(
    draft?.meal_type
  )
  const [cuisine, setCuisine] = useState(draft?.cuisine ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<Error | null>(null)
  const didTrackLimitReached = useRef(false)
  const hasValidDraftUrl = isValidHttpUrl(draft?.source_url)
  const usageSummaryQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ['usage-summary', user?.id],
    queryFn: getUsageSummary,
  })
  const usageSummary = usageSummaryQuery.data

  useEffect(() => {
    if (draft) {
      track('recipe_save_preview_viewed', {
        platform: draft.platform,
        metadata_status: draft.metadata_status ?? 'failed',
        requires_manual_caption: draft.requires_manual_caption ?? true,
      })
    }
  }, [draft, track])

  useEffect(() => {
    if (
      !usageSummary ||
      usageSummary.canSaveLink ||
      didTrackLimitReached.current
    ) {
      return
    }

    didTrackLimitReached.current = true
    track('usage_limit_reached', {
      limit_type: 'saved_links',
      used: usageSummary.savedLinksUsed,
      limit: usageSummary.limits.savedLinks,
    })
  }, [track, usageSummary])

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

  const metadataStatus = draft.metadata_status ?? 'failed'
  const requiresManualCaption = draft.requires_manual_caption ?? true
  const thumbnailUrl = isValidHttpUrl(draft.thumbnail_url)
    ? draft.thumbnail_url
    : null
  const needsAccuracyInput =
    isUnsupportedVideoPlatform(draft.platform) &&
    !pastedCaption.trim() &&
    !manualIngredients.trim()

  const saveDraft = async () => {
    if (!hasValidDraftUrl) {
      return
    }

    const nextNote = sanitizeOptionalText(userNote)
    const nextCaption = sanitizeOptionalText(pastedCaption)
    const nextIngredients = sanitizeOptionalText(manualIngredients)
    const nextCuisine = sanitizeOptionalText(cuisine)
    const analyticsProps = {
      platform: draft.platform,
      metadata_status: metadataStatus,
      requires_manual_caption: requiresManualCaption,
      has_note: Boolean(nextNote),
      has_caption: Boolean(nextCaption),
      has_manual_ingredients: Boolean(nextIngredients),
    }

    if (!user?.id) {
      const nextError = new Error(
        'Please wait for your Recipe Dost session and try again.'
      )

      setSaveError(nextError)
      track('recipe_link_save_failed', analyticsProps)
      return
    }

    const nextUsageSummary =
      usageSummary ??
      (await usageSummaryQuery.refetch()).data

    if (!nextUsageSummary) {
      const nextError = new Error('Could not check free plan usage. Please try again.')

      setSaveError(nextError)
      return
    }

    if (!nextUsageSummary.canSaveLink) {
      track('usage_limit_reached', {
        limit_type: 'saved_links',
        used: nextUsageSummary.savedLinksUsed,
        limit: nextUsageSummary.limits.savedLinks,
      })
      setSaveError(null)
      return
    }

    setIsSaving(true)
    setSaveError(null)

    const nextDraft = {
      ...draft,
      user_note: nextNote,
      pasted_caption: nextCaption,
      manual_ingredients: nextIngredients,
      meal_type: mealType,
      cuisine: nextCuisine,
    }

    try {
      updateDraft(nextDraft)
      const savedRecipe = await saveRecipeItem({
        draft: nextDraft,
        userId: user.id,
      })

      void queryClient.invalidateQueries({
        queryKey: ['recent-recipes', user.id],
      })
      void queryClient.invalidateQueries({
        queryKey: ['usage-summary', user.id],
      })
      track('recipe_link_saved', analyticsProps)
      clearDraft()
      setIsSaving(false)
      router.replace(`/recipe/${savedRecipe.id}`)
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error
          ? caughtError
          : new Error('Could not save this recipe link. Please try again.')

      setSaveError(nextError)
      setIsSaving(false)
      track('recipe_link_save_failed', analyticsProps)
    }
  }

  return (
    <Screen compact>
      <AppHeader
        eyebrow="Preview"
        title="Recipe details"
        subtitle="Add quick context before saving."
      />

      <Card tone="warm">
        <PlatformBadge platform={draft.platform} />
        {thumbnailUrl ? (
          <Image
            accessibilityLabel="Recipe thumbnail"
            source={{ uri: thumbnailUrl }}
            style={{
              width: '100%',
              aspectRatio: 16 / 9,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceMuted,
            }}
          />
        ) : null}
        {draft.title ? (
          <Text selectable style={[typography.heading, { color: colors.text }]}>
            {draft.title}
          </Text>
        ) : null}
        <View style={{ gap: spacing.xs }}>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Source
          </Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            {getReadableSource(draft.source_url)}
          </Text>
        </View>
        <View style={{ gap: spacing.xs }}>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Metadata status
          </Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            {metadataStatus === 'failed'
              ? 'Manual caption recommended'
              : metadataStatus}
          </Text>
        </View>
        {metadataStatus === 'failed' ? (
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Paste the caption or add quick notes if the recipe details are not
            obvious from the link.
          </Text>
        ) : null}
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
          Detected as {getPlatformLabel(draft.platform)}. Recipe Dost saves the
          link and recipe card details, not the video file.
        </Text>
      </Card>

      {usageSummary ? (
        <UsagePill
          label="Saved recipe links left"
          value={`${usageSummary.savedLinksRemaining}`}
        />
      ) : null}

      {usageSummary && !usageSummary.canSaveLink ? (
        <EmptyState
          title="Free saved recipe limit reached"
          message="You have used your free saved recipe links. Pro upgrade is coming next."
          actionLabel="View Library"
          onActionPress={() => router.replace('/library')}
        />
      ) : null}

      {usageSummaryQuery.error ? (
        <ErrorState
          title="Could not check usage"
          message={usageSummaryQuery.error.message}
          retryLabel="Retry"
          onRetry={() => {
            void usageSummaryQuery.refetch()
          }}
        />
      ) : null}

      {needsAccuracyInput ? (
        <Card tone="muted">
          <Text selectable style={[typography.heading, { color: colors.warning }]}>
            Help AI identify the recipe
          </Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            AI accuracy improves when you paste the caption or visible
            ingredients.
          </Text>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Recipe Dost does not download or analyze Instagram, TikTok, or
            Facebook videos from their links.
          </Text>
        </Card>
      ) : null}

      <Card tone="warm">
        <TextArea
          label="Paste caption for better accuracy"
          onChangeText={setPastedCaption}
          placeholder="Paste the recipe caption here if available."
          value={pastedCaption}
        />
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
          Captions usually give AI the best ingredient and step clues.
        </Text>
      </Card>
      <Card tone="warm">
        <TextArea
          label="Add visible ingredients if the caption is missing"
          onChangeText={setManualIngredients}
          placeholder="Example: chicken, pasta, cream, garlic..."
          value={manualIngredients}
        />
      </Card>
      <Card>
        <TextArea
          label="Your note"
          onChangeText={setUserNote}
          placeholder="Example: make it less spicy, good for dinner."
          value={userNote}
        />
      </Card>

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

      {isSaving ? <LoadingState message="Saving recipe link..." /> : null}
      {saveError ? (
        <ErrorState
          title="Could not save link"
          message={saveError.message}
          retryLabel="Retry"
          onRetry={() => {
            void saveDraft()
          }}
        />
      ) : null}

      <View style={{ gap: spacing.md }}>
        <Button
          label="Save Link"
          fullWidth
          disabled={
            !hasValidDraftUrl ||
            isSaving ||
            usageSummaryQuery.isLoading ||
            Boolean(usageSummary && !usageSummary.canSaveLink)
          }
          onPress={() => {
            void saveDraft()
          }}
        />
        <Button
          label="Back"
          fullWidth
          variant="secondary"
          disabled={isSaving}
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

function isUnsupportedVideoPlatform(platform: string) {
  return (
    platform === 'instagram' ||
    platform === 'tiktok' ||
    platform === 'facebook'
  )
}
