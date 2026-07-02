import { validateRecipeUrl } from '@/features/recipe-draft/validation'
import { detectRecipePlatform } from '@/features/recipe-draft/platform'
import {
  RecipeLibraryItem,
  SavedRecipeItem,
  refreshRecipeMetadata,
  saveRecipeLink,
} from '@/lib/api/recipes'
import { useAuth } from '@/providers/auth-provider'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, radius, spacing, typography } from '@/theme'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type SaveRecipeModalContextValue = {
  openSaveRecipeModal: (options?: SaveRecipeModalOpenOptions) => void
}

type SaveRecipeModalOpenOptions = {
  initialUrl?: string
  source?: 'manual' | 'share_intent'
  sourceHint?: string
}

const SaveRecipeModalContext =
  createContext<SaveRecipeModalContextValue | null>(null)

export function SaveRecipeModalProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { track } = usePostHog()
  const [isVisible, setIsVisible] = useState(false)
  const [sourceUrl, setSourceUrl] = useState('')
  const [modalSource, setModalSource] =
    useState<SaveRecipeModalOpenOptions['source']>('manual')
  const [sourceHint, setSourceHint] = useState<string | null>(null)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [bannerMessage, setBannerMessage] = useState<string | null>(null)
  const validationResult = useMemo(
    () => validateRecipeUrl(sourceUrl),
    [sourceUrl]
  )
  const validationMessage = validationResult.success
    ? null
    : validationResult.error.issues[0]?.message ?? 'Enter a valid recipe link.'

  const openSaveRecipeModal = useCallback((options?: SaveRecipeModalOpenOptions) => {
    const initialUrl = options?.initialUrl?.trim()

    if (
      isVisible &&
      options?.source === 'share_intent' &&
      initialUrl &&
      sourceUrl === initialUrl
    ) {
      return
    }

    if (initialUrl) {
      setSourceUrl(initialUrl)
    } else {
      setSourceUrl('')
    }

    setModalSource(options?.source ?? 'manual')
    setSourceHint(options?.sourceHint ?? null)
    setIsVisible(true)
    setBannerMessage(null)
    setErrorMessage(null)
    setHasSubmitted(false)
    track('save_recipe_modal_opened', {
      source: options?.source ?? 'manual',
      has_initial_url: Boolean(initialUrl),
    })
  }, [isVisible, sourceUrl, track])

  const closeModal = useCallback(() => {
    if (isSaving) {
      return
    }

    setIsVisible(false)
    setSourceUrl('')
    setModalSource('manual')
    setSourceHint(null)
    setHasSubmitted(false)
    setErrorMessage(null)
  }, [isSaving])

  const upsertSavedItemInCache = useCallback(
    (savedItem: SavedRecipeItem | RecipeLibraryItem) => {
      if (!user?.id) {
        return
      }

      const libraryItem =
        'latest_card' in savedItem ? savedItem : toRecipeLibraryItem(savedItem)

      queryClient.setQueryData<RecipeLibraryItem[]>(
        ['recent-recipes', user.id],
        (currentItems) => upsertRecipeLibraryItem(currentItems, libraryItem, 6)
      )
      queryClient.setQueryData<RecipeLibraryItem[]>(
        ['recipe-library', user.id],
        (currentItems) => upsertRecipeLibraryItem(currentItems, libraryItem)
      )
    },
    [queryClient, user?.id]
  )

  const removeSavedItemFromCache = useCallback(
    (savedItem: RecipeLibraryItem) => {
      if (!user?.id) {
        return
      }

      const removeItem = (currentItems: RecipeLibraryItem[] | undefined) =>
        (currentItems ?? []).filter(
          (item) =>
            item.id !== savedItem.id && item.source_url !== savedItem.source_url
        )

      queryClient.setQueryData<RecipeLibraryItem[]>(
        ['recent-recipes', user.id],
        removeItem
      )
      queryClient.setQueryData<RecipeLibraryItem[]>(
        ['recipe-library', user.id],
        removeItem
      )
    },
    [queryClient, user?.id]
  )

  const refetchRecipeLists = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['recent-recipes'] })
    void queryClient.invalidateQueries({ queryKey: ['recipe-library'] })
    void queryClient.invalidateQueries({ queryKey: ['usage-summary'] })
  }, [queryClient])

  const refreshMetadataInBackground = useCallback(
    async (recipeItemId: string) => {
      track('metadata_refresh_started')

      try {
        const result = await refreshRecipeMetadata(recipeItemId)
        track('metadata_refresh_completed', {
          metadata_status: result.metadata_status,
          worker_status: result.worker_status,
          error_code: result.error_code,
          title_present: result.title_present,
          thumbnail_present: result.thumbnail_present,
        })
      } catch (caughtError) {
        track('metadata_refresh_completed', {
          metadata_status: 'failed',
          has_error: true,
        })
      } finally {
        refetchRecipeLists()
      }
    },
    [refetchRecipeLists, track, upsertSavedItemInCache]
  )

  const submitRecipeLink = async () => {
    if (isSaving) {
      return
    }

    setHasSubmitted(true)
    setErrorMessage(null)

    if (!validationResult.success) {
      return
    }

    const recipeUrl = validationResult.data
    const recipePlatform = savedPlatformFromUrl(recipeUrl)
    const optimisticItem = createOptimisticRecipeLibraryItem({
      sourceUrl: recipeUrl,
      platform: recipePlatform,
    })

    setIsSaving(true)
    track('save_recipe_link_submitted')
    if (modalSource === 'share_intent') {
      track('shared_recipe_save_started', {
        platform: recipePlatform,
      })
    }

    setIsVisible(false)
    setSourceUrl('')
    setModalSource('manual')
    setSourceHint(null)
    setHasSubmitted(false)
    setErrorMessage(null)
    upsertSavedItemInCache(optimisticItem)
    router.navigate('/home')

    try {
      const savedItem = await saveRecipeLink(recipeUrl)

      track('save_recipe_link_saved', {
        platform: savedItem.platform ?? 'other',
        metadata_status: savedItem.metadata_status ?? 'pending',
      })
      if (modalSource === 'share_intent') {
        track('shared_recipe_save_completed', {
          platform: savedItem.platform ?? recipePlatform,
          metadata_status: savedItem.metadata_status ?? 'pending',
        })
      }
      upsertSavedItemInCache(savedItem)
      refetchRecipeLists()
      void refreshMetadataInBackground(savedItem.id)
    } catch (caughtError) {
      removeSavedItemFromCache(optimisticItem)
      setBannerMessage('Could not save this link. Please try again.')
      refetchRecipeLists()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SaveRecipeModalContext.Provider value={{ openSaveRecipeModal }}>
      {children}
      {bannerMessage ? (
        <View
          style={{
            position: 'absolute',
            top: insets.top + spacing.md,
            right: spacing.lg,
            left: spacing.lg,
            zIndex: 20,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            padding: spacing.md,
            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.3)',
          }}
        >
          <Text selectable style={[typography.body, { color: colors.text }]}>
            {bannerMessage}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setBannerMessage(null)}
            style={{ marginTop: spacing.sm }}
          >
            <Text
              selectable={false}
              style={[typography.caption, { color: colors.primary, fontWeight: '800' }]}
            >
              Dismiss
            </Text>
          </Pressable>
        </View>
      ) : null}
      <Modal
        animationType="slide"
        transparent
        visible={isVisible}
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
          style={{ flex: 1 }}
        >
          <Pressable
            accessibilityLabel="Close save recipe modal"
            style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.58)' }}
            onPress={closeModal}
          />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
          >
            <View
              style={{
                gap: spacing.lg,
                borderTopLeftRadius: radius.lg,
                borderTopRightRadius: radius.lg,
                backgroundColor: colors.surface,
                padding: spacing.xl,
                paddingBottom: spacing.xl + spacing.md + insets.bottom,
              }}
            >
              <View style={{ gap: spacing.xs }}>
                <Text selectable style={[typography.title, { color: colors.text }]}>
                  Save recipe video
                </Text>
                <Text selectable style={[typography.body, { color: colors.textMuted }]}>
                  Paste a TikTok, Instagram, YouTube, or Facebook recipe link.
                </Text>
                {sourceHint ? (
                  <Text selectable style={[typography.caption, { color: colors.primary }]}>
                    {sourceHint}
                  </Text>
                ) : null}
              </View>

              <Input
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSaving}
                keyboardType="url"
                label="URL"
                onChangeText={(value) => {
                  setSourceUrl(value)
                  if (errorMessage) {
                    setErrorMessage(null)
                  }
                }}
                onSubmitEditing={() => {
                  void submitRecipeLink()
                }}
                placeholder="https://www.instagram.com/reel/..."
                returnKeyType="done"
                value={sourceUrl}
              />

              {hasSubmitted && validationMessage ? (
                <Text selectable style={[typography.caption, { color: colors.danger }]}>
                  {validationMessage}
                </Text>
              ) : null}

              {errorMessage ? (
                <Text selectable style={[typography.caption, { color: colors.danger }]}>
                  {errorMessage}
                </Text>
              ) : null}

              <Button
                label="Save Recipe"
                fullWidth
                disabled={isSaving}
                onPress={() => {
                  void submitRecipeLink()
                }}
              />

              <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
                We save links and recipe cards, not videos.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SaveRecipeModalContext.Provider>
  )
}

export function useSaveRecipeModal() {
  const value = useContext(SaveRecipeModalContext)

  if (!value) {
    throw new Error('useSaveRecipeModal must be used inside SaveRecipeModalProvider.')
  }

  return value
}

function toRecipeLibraryItem(savedItem: SavedRecipeItem): RecipeLibraryItem {
  return {
    id: savedItem.id,
    source_url: savedItem.source_url,
    platform: savedItem.platform,
    title: savedItem.title,
    thumbnail_url: savedItem.thumbnail_url,
    metadata_status: savedItem.metadata_status,
    user_note: savedItem.user_note,
    pasted_caption: savedItem.pasted_caption,
    manual_ingredients: savedItem.manual_ingredients,
    meal_type: savedItem.meal_type,
    cuisine: savedItem.cuisine,
    created_at: savedItem.created_at,
    updated_at: savedItem.updated_at,
    latest_card: null,
    latest_media_job: null,
  }
}

function upsertRecipeLibraryItem(
  currentItems: RecipeLibraryItem[] | undefined,
  nextItem: RecipeLibraryItem,
  limit?: number
) {
  const items = currentItems ?? []
  const filteredItems = items.filter(
    (item) => item.id !== nextItem.id && item.source_url !== nextItem.source_url
  )
  const nextItems = [nextItem, ...filteredItems].sort(
    (firstItem, secondItem) =>
      new Date(secondItem.created_at).getTime() -
      new Date(firstItem.created_at).getTime()
  )

  return typeof limit === 'number' ? nextItems.slice(0, limit) : nextItems
}

function savedPlatformFromUrl(sourceUrl: string) {
  return detectRecipePlatform(sourceUrl)
}

function createOptimisticRecipeLibraryItem({
  sourceUrl,
  platform,
}: {
  sourceUrl: string
  platform: ReturnType<typeof detectRecipePlatform>
}): RecipeLibraryItem {
  const timestamp = new Date().toISOString()

  return {
    id: `optimistic-${Date.now()}`,
    source_url: sourceUrl,
    platform,
    title: 'Saving recipe link...',
    thumbnail_url: null,
    metadata_status: 'saving',
    user_note: null,
    pasted_caption: null,
    manual_ingredients: null,
    meal_type: null,
    cuisine: null,
    created_at: timestamp,
    updated_at: timestamp,
    latest_card: null,
    latest_media_job: null,
  }
}
