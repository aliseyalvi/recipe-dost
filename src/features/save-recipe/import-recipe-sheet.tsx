import { extractFirstRecipeUrlFromText } from '@/features/share-intent/extract-url'
import { colors, radius, spacing, typography } from '@/theme'
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet'
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet'
import type { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import * as Clipboard from 'expo-clipboard'
import { useCallback, useState } from 'react'
import type { RefObject } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import type { TextInput as GestureTextInput } from 'react-native-gesture-handler'
import { AppIcon } from '@/ui/app-icon'

type ClipboardResult = 'pasted' | 'empty' | 'failed'

type Props = {
  sheetRef: RefObject<BottomSheetModalMethods | null>
  inputRef: RefObject<GestureTextInput | undefined>
  snapPoints: (string | number)[]
  bottomInset: number
  sourceUrl: string
  sourceHint: string | null
  isSaving: boolean
  validationMessage: string | null
  errorMessage: string | null
  onChangeUrl: (value: string) => void
  onClientError: (message: string | null) => void
  onClipboardResult: (result: ClipboardResult) => void
  onSubmit: () => void
  onRequestClose: () => void
  onDismiss: () => void
  onChange: (index: number) => void
}

const instructions = [
  'Find a recipe on Instagram, TikTok, or YouTube',
  'Tap Share or copy the link, then choose Recipe Dost',
  'We’ll save the link and prepare the recipe preview',
] as const

export function ImportRecipeSheet({
  sheetRef,
  inputRef,
  snapPoints,
  bottomInset,
  sourceUrl,
  sourceHint,
  isSaving,
  validationMessage,
  errorMessage,
  onChangeUrl,
  onClientError,
  onClipboardResult,
  onSubmit,
  onRequestClose,
  onDismiss,
  onChange,
}: Props) {
  const [isFocused, setIsFocused] = useState(false)
  const canSubmit = sourceUrl.trim().length > 0 && !validationMessage && !isSaving

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close Import Recipe sheet"
        onPress={onRequestClose}
        style={[props.style, { backgroundColor: colors.modalBackdrop }]}
      />
    ),
    [onRequestClose]
  )

  const pasteFromClipboard = async () => {
    try {
      const clipboardText = (await Clipboard.getStringAsync()).trim()

      if (!clipboardText) {
        onClientError('Clipboard does not contain a recipe link.')
        onClipboardResult('empty')
        return
      }

      const sharedUrl = extractFirstRecipeUrlFromText(clipboardText)
      onChangeUrl(sharedUrl ?? clipboardText)
      onClientError(null)
      onClipboardResult('pasted')
      inputRef.current?.focus?.()
    } catch {
      onClientError('Could not read the clipboard. Paste the link manually.')
      onClipboardResult('failed')
    }
  }

  return (
    <BottomSheetModal
      ref={sheetRef}
      backdropComponent={renderBackdrop}
      bottomInset={0}
      enableBlurKeyboardOnGesture
      enableContentPanningGesture={false}
      enableDismissOnClose
      enableDynamicSizing={false}
      enableHandlePanningGesture={!isSaving}
      enableOverDrag={false}
      enablePanDownToClose={!isSaving}
      index={0}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      onDismiss={onDismiss}
      onChange={onChange}
      snapPoints={snapPoints}
      backgroundStyle={{
        borderTopWidth: 1,
        borderColor: colors.outlineVariant,
        borderTopLeftRadius: radius.lg,
        borderTopRightRadius: radius.lg,
        backgroundColor: colors.surface,
      }}
      handleIndicatorStyle={{
        width: 48,
        height: 5,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceContainerHighest,
      }}
      handleStyle={{
        paddingTop: spacing.lg,
        paddingBottom: spacing.sm,
      }}
    >
      <BottomSheetScrollView
        bounces={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          gap: spacing.cardGap,
          paddingHorizontal: spacing.mobileMargin,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xxl + bottomInset,
        }}
      >
        <View
          style={{
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text selectable style={[typography.title, { color: colors.onSurface }]}>
            Import Recipe
          </Text>
          <Pressable
            accessibilityLabel="Close Import Recipe sheet"
            accessibilityRole="button"
            disabled={isSaving}
            onPress={onRequestClose}
            hitSlop={8}
            style={({ pressed }) => ({
              position: 'absolute',
              right: 0,
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.pill,
              backgroundColor: colors.surfaceContainerHigh,
              opacity: isSaving ? 0.45 : pressed ? 0.72 : 1,
            })}
          >
            <AppIcon name="close" color={colors.onSurfaceVariant} size={24} />
          </Pressable>
        </View>

        <View style={{ gap: spacing.md }}>
          {instructions.map((instruction, index) => (
            <View
              key={instruction}
              style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}
            >
              <Text
                selectable={false}
                style={[typography.body, { color: colors.primary, fontWeight: '800' }]}
              >
                {index + 1}.
              </Text>
              <Text
                selectable
                style={[typography.body, { flex: 1, color: colors.onSurfaceVariant }]}
              >
                {instruction}
              </Text>
            </View>
          ))}
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Works with Instagram, TikTok, and YouTube.
          </Text>
          {sourceHint ? (
            <Text selectable style={[typography.caption, { color: colors.primary }]}>
              {sourceHint}
            </Text>
          ) : null}
        </View>

        <View style={{ gap: spacing.sm }}>
          <View style={{ position: 'relative' }}>
            <BottomSheetTextInput
              ref={inputRef}
              accessibilityLabel="Recipe URL"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSaving}
              keyboardType="url"
              onBlur={() => setIsFocused(false)}
              onChangeText={(value) => {
                onChangeUrl(value)
                onClientError(null)
              }}
              onFocus={() => {
                setIsFocused(true)
                sheetRef.current?.snapToIndex(1)
              }}
              onSubmitEditing={() => {
                if (canSubmit) {
                  onSubmit()
                }
              }}
              placeholder="Paste recipe link here…"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              selectionColor={colors.primary}
              style={[
                typography.body,
                {
                  minHeight: 58,
                  borderWidth: 1,
                  borderColor: isFocused ? colors.primary : colors.outlineVariant,
                  borderRadius: radius.md,
                  backgroundColor: colors.inputSurface,
                  color: colors.onSurface,
                  paddingLeft: spacing.lg,
                  paddingRight: 54,
                },
              ]}
              value={sourceUrl}
            />
            {sourceUrl.length > 0 ? (
              <Pressable
                accessibilityLabel="Clear recipe URL"
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => {
                  onChangeUrl('')
                  onClientError(null)
                  inputRef.current?.focus?.()
                }}
                hitSlop={8}
                style={({ pressed }) => ({
                  position: 'absolute',
                  top: 9,
                  right: 8,
                  width: 40,
                  height: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isSaving ? 0.42 : pressed ? 0.7 : 1,
                })}
              >
                <AppIcon name="close" color={colors.primary} size={24} />
              </Pressable>
            ) : null}
          </View>

          {validationMessage && sourceUrl.trim().length > 0 ? (
            <Text
              accessibilityLiveRegion="polite"
              selectable
              style={[typography.caption, { color: colors.error }]}
            >
              {validationMessage}
            </Text>
          ) : null}

          {errorMessage ? (
            <Text
              accessibilityLiveRegion="polite"
              selectable
              style={[typography.caption, { color: colors.error }]}
            >
              {errorMessage}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={() => {
              void pasteFromClipboard()
            }}
            style={({ pressed }) => ({
              minHeight: 44,
              flexDirection: 'row',
              alignItems: 'center',
              alignSelf: 'flex-start',
              gap: spacing.sm,
              opacity: isSaving ? 0.45 : pressed ? 0.72 : 1,
            })}
          >
            <AppIcon name="copy" color={colors.primary} size={18} />
            <Text
              selectable={false}
              style={[typography.body, { color: colors.primary, fontWeight: '700' }]}
            >
              Paste from clipboard
            </Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={!canSubmit}
          onPress={onSubmit}
          style={({ pressed }) => ({
            minHeight: 58,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            borderRadius: radius.card,
            borderCurve: 'continuous',
            backgroundColor: colors.primaryContainer,
            opacity: !canSubmit ? 0.42 : pressed ? 0.82 : 1,
          })}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.onPrimaryContainer} />
          ) : (
            <AppIcon name="link" color={colors.onPrimaryContainer} size={20} />
          )}
          <Text
            selectable={false}
            style={[
              typography.body,
              { color: colors.onPrimaryContainer, fontWeight: '800' },
            ]}
          >
            {isSaving ? 'Saving…' : 'Save Recipe'}
          </Text>
        </Pressable>

        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
          We save links and recipe cards, not videos.
        </Text>
      </BottomSheetScrollView>
    </BottomSheetModal>
  )
}
