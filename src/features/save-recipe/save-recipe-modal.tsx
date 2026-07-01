import { validateRecipeUrl } from '@/features/recipe-draft/validation'
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
  Text,
  View,
} from 'react-native'

type SaveRecipeModalContextValue = {
  openSaveRecipeModal: () => void
}

const SaveRecipeModalContext =
  createContext<SaveRecipeModalContextValue | null>(null)

export function SaveRecipeModalProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { track } = usePostHog()
  const [isVisible, setIsVisible] = useState(false)
  const [sourceUrl, setSourceUrl] = useState('')
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const validationResult = useMemo(
    () => validateRecipeUrl(sourceUrl),
    [sourceUrl]
  )
  const validationMessage = validationResult.success
    ? null
    : validationResult.error.issues[0]?.message ?? 'Enter a valid recipe link.'

  const openSaveRecipeModal = useCallback(() => {
    setIsVisible(true)
    setErrorMessage(null)
    setHasSubmitted(false)
    track('save_recipe_modal_opened')
  }, [track])

  const closeModal = useCallback(() => {
    if (isSaving) {
      return
    }

    setIsVisible(false)
    setSourceUrl('')
    setHasSubmitted(false)
    setErrorMessage(null)
  }, [isSaving])

  const upsertSavedItemInCache = useCallback(
    (savedItem: SavedRecipeItem) => {
      if (!user?.id) {
        return
      }

      const libraryItem = toRecipeLibraryItem(savedItem)

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
        upsertSavedItemInCache(result.recipe_item)
        track('metadata_refresh_completed', {
          metadata_status: result.metadata_status,
          has_error: Boolean(result.metadata_preview_error),
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

    setIsSaving(true)
    track('save_recipe_link_submitted')

    try {
      const savedItem = await saveRecipeLink(validationResult.data)

      track('save_recipe_link_saved', {
        platform: savedItem.platform ?? 'other',
        metadata_status: savedItem.metadata_status ?? 'pending',
      })
      upsertSavedItemInCache(savedItem)
      refetchRecipeLists()
      setIsVisible(false)
      setSourceUrl('')
      setHasSubmitted(false)
      router.navigate('/home')
      void refreshMetadataInBackground(savedItem.id)
    } catch (caughtError) {
      setErrorMessage(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not save this recipe link. Please try again.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SaveRecipeModalContext.Provider value={{ openSaveRecipeModal }}>
      {children}
      <Modal
        animationType="slide"
        transparent
        visible={isVisible}
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <Pressable
            accessibilityLabel="Close save recipe modal"
            style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.58)' }}
            onPress={closeModal}
          />
          <View
            style={{
              gap: spacing.lg,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              backgroundColor: colors.surface,
              padding: spacing.xl,
              paddingBottom: spacing.xl + spacing.md,
            }}
          >
            <View style={{ gap: spacing.xs }}>
              <Text selectable style={[typography.title, { color: colors.text }]}>
                Save recipe video
              </Text>
              <Text selectable style={[typography.body, { color: colors.textMuted }]}>
                Paste a TikTok, Instagram, YouTube, or Facebook recipe link.
              </Text>
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
              label={isSaving ? 'Saving...' : 'Save Recipe'}
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
  const filteredItems = items.filter((item) => item.id !== nextItem.id)
  const nextItems = [nextItem, ...filteredItems].sort(
    (firstItem, secondItem) =>
      new Date(secondItem.created_at).getTime() -
      new Date(firstItem.created_at).getTime()
  )

  return typeof limit === 'number' ? nextItems.slice(0, limit) : nextItems
}
