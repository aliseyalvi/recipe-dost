import {
  detectRecipePlatform,
  getPlatformLabel,
} from '@/features/recipe-draft/platform'
import { useRecipeDraftStore } from '@/features/recipe-draft/recipe-draft-store'
import { validateRecipeUrl } from '@/features/recipe-draft/validation'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, spacing, typography } from '@/theme'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { Input } from '@/ui/input'
import { Screen } from '@/ui/screen'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Text, View } from 'react-native'

export default function SaveRecipeRoute() {
  const router = useRouter()
  const { track } = usePostHog()
  const { setDraft } = useRecipeDraftStore()
  const [sourceUrl, setSourceUrl] = useState('')
  const [hasBlurred, setHasBlurred] = useState(false)
  const validationResult = useMemo(
    () => validateRecipeUrl(sourceUrl),
    [sourceUrl]
  )
  const trimmedSourceUrl = validationResult.success
    ? validationResult.data
    : sourceUrl.trim()
  const validationMessage = validationResult.success
    ? null
    : validationResult.error.issues[0]?.message ?? 'Enter a valid recipe link.'
  const shouldShowError = hasBlurred && !validationResult.success

  const continueToPreview = () => {
    if (!validationResult.success) {
      track('link_validation_failed', {
        reason: 'invalid_url',
      })
      setHasBlurred(true)
      return
    }

    const platform = detectRecipePlatform(validationResult.data)

    setDraft({
      source_url: validationResult.data,
      platform,
      created_at: new Date().toISOString(),
    })
    track('link_pasted', {
      platform,
    })
    router.push('/recipe/preview')
  }

  return (
    <Screen>
      <View style={{ gap: spacing.md }}>
        <Text selectable style={[typography.title, { color: colors.text }]}>
          Save a recipe video
        </Text>
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          Paste a Reel, TikTok, Short, or food video link. We will turn it into
          a clean recipe card later.
        </Text>
      </View>

      <Card>
        <Input
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          label="Recipe video link"
          onBlur={() => {
            setHasBlurred(true)

            if (!validationResult.success && sourceUrl.trim().length > 0) {
              track('link_validation_failed', {
                reason: 'invalid_url',
              })
            }
          }}
          onChangeText={(value) => {
            setSourceUrl(value)
          }}
          onSubmitEditing={continueToPreview}
          placeholder="https://www.instagram.com/reel/..."
          returnKeyType="next"
          value={sourceUrl}
        />
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
          Works with Instagram, TikTok, YouTube, Facebook, and other recipe
          links.
        </Text>
        {shouldShowError && validationMessage ? (
          <Text selectable style={[typography.caption, { color: colors.danger }]}>
            {validationMessage}
          </Text>
        ) : null}
        {validationResult.success ? (
          <Text selectable style={[typography.caption, { color: colors.primary }]}>
            Looks good. Platform:{' '}
            {getPlatformLabel(detectRecipePlatform(trimmedSourceUrl))}.
          </Text>
        ) : null}
      </Card>

      <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
        Recipe Dost saves recipe cards and links, not video files.
      </Text>

      <Button
        label="Continue"
        fullWidth
        disabled={!validationResult.success}
        onPress={continueToPreview}
      />
    </Screen>
  )
}
