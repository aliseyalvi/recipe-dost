import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, radius, spacing, typography } from '@/theme'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { Screen } from '@/ui/screen'
import { NestedScreenHeader } from '@/ui/screen-header'
import { useEffect, useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const deletedDataPoints = [
  'saved recipe links',
  'AI recipe cards',
  'grocery lists',
  'app profile and preferences',
] as const

export default function DeleteAccountDataSettingsRoute() {
  const { track } = usePostHog()
  const [confirmationPhase, setConfirmationPhase] = useState<
    'closed' | 'confirm' | 'unavailable'
  >('closed')

  useEffect(() => {
    track('settings_delete_account_data_viewed')
  }, [track])

  const handleReviewDeletion = () => {
    track('delete_account_data_request_placeholder_tapped')
    track('delete_account_data_confirmation_opened')
    setConfirmationPhase('confirm')
  }

  const handleConfirmDeletionRequest = () => {
    track('delete_account_data_request_unavailable_confirmed')
    setConfirmationPhase('unavailable')
  }

  return (
    <Screen compact>
      <NestedScreenHeader title="Delete account & data" fallbackRoute="/settings" />

      <Card tone="muted">
        <Text selectable style={[typography.heading, { color: colors.text }]}>
          Deletion request
        </Text>
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          A verified deletion flow will remove Recipe Dost app data linked to
          this profile.
        </Text>

        <View style={{ gap: spacing.sm }}>
          {deletedDataPoints.map((point) => (
            <View
              key={point}
              style={{
                flexDirection: 'row',
                gap: spacing.sm,
                alignItems: 'flex-start',
              }}
            >
              <Text
                selectable={false}
                style={[typography.body, { color: colors.danger }]}
              >
                {'-'}
              </Text>
              <Text
                selectable
                style={[typography.body, { flex: 1, color: colors.text }]}
              >
                {point}
              </Text>
            </View>
          ))}
        </View>

        <Text selectable style={[typography.body, { color: colors.danger }]}>
          This action cannot be undone.
        </Text>
      </Card>

      <Card tone="warm">
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          Automated deletion requests are not connected in this beta. Reviewing
          this action will not remove data or claim a request was submitted.
        </Text>
        <Button
          label="Review deletion request"
          variant="secondary"
          onPress={handleReviewDeletion}
        />
      </Card>

      <DeletionConfirmationSheet
        phase={confirmationPhase}
        onClose={() => setConfirmationPhase('closed')}
        onContinue={handleConfirmDeletionRequest}
      />
    </Screen>
  )
}

function DeletionConfirmationSheet({
  phase,
  onClose,
  onContinue,
}: {
  phase: 'closed' | 'confirm' | 'unavailable'
  onClose: () => void
  onContinue: () => void
}) {
  const insets = useSafeAreaInsets()
  const isUnavailable = phase === 'unavailable'

  return (
    <Modal
      animationType="fade"
      transparent
      statusBarTranslucent
      visible={phase !== 'closed'}
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close deletion request"
        onPress={onClose}
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: colors.modalBackdrop,
        }}
      >
        <Pressable
          accessibilityRole="none"
          onPress={(event) => event.stopPropagation()}
          style={{
            gap: spacing.lg,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            borderWidth: 1,
            borderColor: 'rgba(255, 180, 171, 0.30)',
            backgroundColor: colors.surfaceContainerLow,
            paddingHorizontal: spacing.card,
            paddingTop: spacing.card,
            paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.md,
          }}
        >
          <View
            style={{
              width: 44,
              height: 4,
              alignSelf: 'center',
              borderRadius: radius.pill,
              backgroundColor: colors.outlineVariant,
            }}
          />
          <View style={{ gap: spacing.sm }}>
            <Text
              selectable
              style={[typography.heading, { color: colors.onSurface }]}
            >
              {isUnavailable
                ? 'Request not submitted'
                : 'Request deletion of this profile?'}
            </Text>
            <Text
              selectable
              style={[typography.body, { color: colors.onSurfaceVariant }]}
            >
              {isUnavailable
                ? 'Automated deletion requests are not connected in this beta. No data was deleted and no request was submitted.'
                : 'This request would cover your Recipe Dost profile, saved recipes, AI recipe cards, grocery lists, and preferences.'}
            </Text>
            {!isUnavailable ? (
              <Text
                selectable
                style={[typography.caption, { color: colors.error }]}
              >
                A completed deletion cannot be undone.
              </Text>
            ) : null}
          </View>

          {isUnavailable ? (
            <Button label="Close" fullWidth onPress={onClose} />
          ) : (
            <View style={{ gap: spacing.sm }}>
              <Button
                label="Continue"
                fullWidth
                variant="secondary"
                onPress={onContinue}
              />
              <Button label="Cancel" fullWidth variant="ghost" onPress={onClose} />
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}
