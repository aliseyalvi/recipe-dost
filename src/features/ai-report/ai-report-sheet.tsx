import {
  AI_REPORT_CATEGORIES,
  AI_REPORT_NOTE_MAX_LENGTH,
  type AiReportCategory,
} from '@/features/ai-report/ai-report-model'
import { submitAiRecipeReport } from '@/lib/api/ai-reports'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, radius, spacing, typography } from '@/theme'
import { AppIcon } from '@/ui/app-icon'
import { Button } from '@/ui/button'
import { TextArea } from '@/ui/text-area'
import * as Application from 'expo-application'
import Constants from 'expo-constants'
import { useEffect, useRef, useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export function AiReportSheet({
  recipeCardId,
  visible,
  onClose,
}: {
  recipeCardId: string
  visible: boolean
  onClose: () => void
}) {
  const insets = useSafeAreaInsets()
  const { trackEvent } = usePostHog()
  const submitInFlight = useRef(false)
  const [category, setCategory] = useState<AiReportCategory | null>(null)
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) {
      setCategory(null)
      setNote('')
      setIsSubmitted(false)
      setError(null)
    }
  }, [visible])

  const submit = async () => {
    if (!category || submitInFlight.current || isSubmitted) return

    submitInFlight.current = true
    setIsSubmitting(true)
    setError(null)

    try {
      await submitAiRecipeReport({
        recipeCardId,
        category,
        note,
        appVersion:
          Constants.expoConfig?.version ?? Application.nativeApplicationVersion,
        buildNumber:
          Constants.expoConfig?.android?.versionCode?.toString() ??
          Application.nativeBuildVersion,
      })
      trackEvent('ai_recipe_report_submitted', { category })
      setIsSubmitted(true)
    } catch {
      setError('The report could not be submitted. Check your connection and retry.')
    } finally {
      submitInFlight.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      animationType="fade"
      transparent
      statusBarTranslucent
      visible={visible}
      onRequestClose={() => {
        if (!isSubmitting) onClose()
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close AI recipe report"
        onPress={() => {
          if (!isSubmitting) onClose()
        }}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.modalBackdrop }}
      >
        <Pressable
          accessibilityRole="none"
          onPress={(event) => event.stopPropagation()}
          style={{ maxHeight: '90%', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, borderColor: colors.primaryOutlineSoft, backgroundColor: colors.surfaceContainerLow }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: spacing.lg, paddingHorizontal: spacing.card, paddingTop: spacing.card, paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.md }}
          >
            <View style={{ width: 44, height: 4, alignSelf: 'center', borderRadius: radius.pill, backgroundColor: colors.outlineVariant }} />
            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
              <View style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.primaryWash }}>
                <AppIcon name="warning" color={colors.primary} size={22} />
              </View>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text selectable style={[typography.heading, { color: colors.onSurface }]}>Report AI Recipe</Text>
                <Text selectable style={[typography.body, { color: colors.onSurfaceVariant }]}>Tell us what needs review. This does not block normal recipe use.</Text>
              </View>
            </View>

            {isSubmitted ? (
              <View style={{ gap: spacing.md }}>
                <Text selectable style={[typography.body, { color: colors.accent }]}>Report submitted. Thank you for helping improve Recipe Dost.</Text>
                <Button label="Close" fullWidth onPress={onClose} />
              </View>
            ) : (
              <>
                <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
                  {AI_REPORT_CATEGORIES.map((item) => {
                    const selected = category === item.value
                    return (
                      <Pressable
                        key={item.value}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                        disabled={isSubmitting}
                        onPress={() => setCategory(item.value)}
                        style={({ pressed }) => ({ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: selected ? colors.primary : colors.outlineVariant, backgroundColor: selected ? colors.primaryWash : colors.glassElevated, paddingHorizontal: spacing.md, opacity: pressed || isSubmitting ? 0.65 : 1 })}
                      >
                        <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: 2, borderColor: selected ? colors.primary : colors.onSurfaceVariant }}>
                          {selected ? <View style={{ width: 9, height: 9, borderRadius: radius.pill, backgroundColor: colors.primary }} /> : null}
                        </View>
                        <Text selectable={false} style={[typography.body, { flex: 1, color: colors.onSurface }]}>{item.label}</Text>
                      </Pressable>
                    )
                  })}
                </View>

                <TextArea
                  label={`Optional note (${note.length}/${AI_REPORT_NOTE_MAX_LENGTH})`}
                  value={note}
                  maxLength={AI_REPORT_NOTE_MAX_LENGTH}
                  editable={!isSubmitting}
                  onChangeText={setNote}
                  placeholder="Add a short explanation"
                />
                {error ? <Text selectable style={[typography.caption, { color: colors.error }]}>{error}</Text> : null}
                <Button label={isSubmitting ? 'Submitting…' : 'Submit report'} fullWidth disabled={!category || isSubmitting} onPress={() => { void submit() }} />
                <Button label="Cancel" fullWidth variant="ghost" disabled={isSubmitting} onPress={onClose} />
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
