import { clearOnboardingProfile } from '@/features/onboarding/onboarding-store'
import { deleteCurrentAccount } from '@/lib/api/account-deletion'
import { useAuth } from '@/providers/auth-provider'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { useRevenueCat } from '@/providers/revenuecat-provider'
import { colors, radius, spacing, typography } from '@/theme'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { Screen } from '@/ui/screen'
import { NestedScreenHeader } from '@/ui/screen-header'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LegalLinks } from '@/features/legal/legal-links'

const deletedDataPoints = [
  'saved recipe links and metadata',
  'AI recipe cards and AI-content reports',
  'grocery lists and collections',
  'usage, subscription, profile, and preference records',
] as const

type DeletionPhase = 'closed' | 'confirm' | 'deleting' | 'success'

export default function DeleteAccountDataSettingsRoute() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { clearDeletedSession, retry: startFreshSession } = useAuth()
  const { track, trackEvent } = usePostHog()
  const { resetForAccountDeletion } = useRevenueCat()
  const deletionInFlight = useRef(false)
  const [phase, setPhase] = useState<DeletionPhase>('closed')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    track('settings_delete_account_data_viewed')
  }, [track])

  const handleConfirmDeletion = async () => {
    if (deletionInFlight.current) return

    deletionInFlight.current = true
    setPhase('deleting')
    setError(null)

    try {
      await deleteCurrentAccount()
      trackEvent('account_deletion_completed', undefined)
      queryClient.clear()
      await Promise.allSettled([
        resetForAccountDeletion(),
        clearOnboardingProfile(),
        clearDeletedSession(),
      ])
      setPhase('success')
    } catch {
      setError(
        'Account deletion was not completed. Your account and data remain in place. Check your connection or session, then retry.'
      )
      setPhase('confirm')
    } finally {
      deletionInFlight.current = false
    }
  }

  const handleStartFresh = async () => {
    await startFreshSession()
    router.replace('/welcome')
  }

  return (
    <Screen compact>
      <NestedScreenHeader title="Delete account & data" fallbackRoute="/settings" />

      <Card tone="muted">
        <Text selectable style={[typography.heading, { color: colors.text }]}>Delete permanently</Text>
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>Deleting this Recipe Dost account permanently removes:</Text>
        <View style={{ gap: spacing.sm }}>
          {deletedDataPoints.map((point) => (
            <View key={point} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
              <Text selectable={false} style={[typography.body, { color: colors.danger }]}>{'-'}</Text>
              <Text selectable style={[typography.body, { flex: 1, color: colors.text }]}>{point}</Text>
            </View>
          ))}
        </View>
        <Text selectable style={[typography.body, { color: colors.danger }]}>This action cannot be undone. An active Google Play subscription must still be cancelled in Google Play.</Text>
      </Card>

      <Card tone="warm">
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>The request is authenticated by your current app session. Recipe Dost never sends an account ID from this screen as deletion authority.</Text>
        <Button label="Delete account & data" variant="secondary" onPress={() => { setError(null); setPhase('confirm') }} />
        <LegalLinks types={['account_deletion', 'privacy_policy']} />
      </Card>

      <DeletionConfirmationSheet
        error={error}
        phase={phase}
        onClose={() => {
          if (phase !== 'deleting') setPhase('closed')
        }}
        onConfirm={() => { void handleConfirmDeletion() }}
        onStartFresh={() => { void handleStartFresh() }}
      />
    </Screen>
  )
}

function DeletionConfirmationSheet({
  error,
  phase,
  onClose,
  onConfirm,
  onStartFresh,
}: {
  error: string | null
  phase: DeletionPhase
  onClose: () => void
  onConfirm: () => void
  onStartFresh: () => void
}) {
  const insets = useSafeAreaInsets()
  const isDeleting = phase === 'deleting'
  const isSuccess = phase === 'success'

  return (
    <Modal animationType="fade" transparent statusBarTranslucent visible={phase !== 'closed'} onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close account deletion" onPress={onClose} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.modalBackdrop }}>
        <Pressable accessibilityRole="none" onPress={(event) => event.stopPropagation()} style={{ gap: spacing.lg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(255, 180, 171, 0.30)', backgroundColor: colors.surfaceContainerLow, paddingHorizontal: spacing.card, paddingTop: spacing.card, paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.md }}>
          <View style={{ width: 44, height: 4, alignSelf: 'center', borderRadius: radius.pill, backgroundColor: colors.outlineVariant }} />
          <View style={{ gap: spacing.sm }}>
            <Text selectable style={[typography.heading, { color: colors.onSurface }]}>{isSuccess ? 'Account deleted' : isDeleting ? 'Deleting account…' : 'Permanently delete this account?'}</Text>
            <Text selectable style={[typography.body, { color: colors.onSurfaceVariant }]}>{isSuccess ? 'Your previous Recipe Dost account and linked app records were deleted. You are signed out.' : isDeleting ? 'Keep Recipe Dost open while the secure deletion request finishes.' : 'This removes your profile, saved recipes, AI cards, grocery data, reports, usage, and subscription metadata. It cannot be undone.'}</Text>
            {error ? <Text selectable style={[typography.caption, { color: colors.error }]}>{error}</Text> : null}
          </View>

          {isSuccess ? (
            <Button label="Start fresh" fullWidth onPress={onStartFresh} />
          ) : (
            <View style={{ gap: spacing.sm }}>
              <Button label={isDeleting ? 'Deleting…' : 'Delete permanently'} fullWidth variant="secondary" disabled={isDeleting} onPress={onConfirm} />
              <Button label="Cancel" fullWidth variant="ghost" disabled={isDeleting} onPress={onClose} />
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}
