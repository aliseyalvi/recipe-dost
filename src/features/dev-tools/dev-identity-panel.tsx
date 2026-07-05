import {
  DevAnonymousIdentity,
  createFreshAnonymousDevIdentity,
  getSavedDevIdentities,
  saveCurrentDevIdentity,
  switchToSavedDevIdentity,
} from '@/features/dev-tools/dev-identities'
import { getNormalizedSubscriptionStatus } from '@/features/subscription/normalized-subscription-status'
import { getAiAccessState } from '@/lib/api/ai-access'
import type { AiAccessState } from '@/lib/api/ai-access'
import { useAuth } from '@/providers/auth-provider'
import { colors, spacing, typography } from '@/theme'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { Input } from '@/ui/input'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as Clipboard from 'expo-clipboard'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Text, View } from 'react-native'

export function shouldShowDevIdentityPanel(access?: AiAccessState | null) {
  return (
    __DEV__ ||
    access?.role === 'admin' ||
    access?.role === 'tester' ||
    access?.isTestUser === true
  )
}

export function DevIdentityPanel() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [savedIdentities, setSavedIdentities] = useState<
    DevAnonymousIdentity[]
  >([])
  const [targetUserId, setTargetUserId] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [isSwitchingUser, setIsSwitchingUser] = useState(false)

  const accessQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ['ai-access-state', user?.id],
    queryFn: getAiAccessState,
  })

  const currentSavedIdentity = useMemo(
    () => savedIdentities.find((identity) => identity.userId === user?.id),
    [savedIdentities, user?.id]
  )
  const subscriptionStatus = useMemo(
    () =>
      getNormalizedSubscriptionStatus({
        aiAccess: accessQuery.data,
        isAiAccessLoading: accessQuery.isLoading,
        revenueCatState: {
          isPremium: false,
        },
      }),
    [accessQuery.data, accessQuery.isLoading]
  )

  useEffect(() => {
    void refreshSavedIdentities()
  }, [user?.id])

  const refreshSavedIdentities = async () => {
    setSavedIdentities(await getSavedDevIdentities())
  }

  const clearQueryCacheForIdentityChange = async () => {
    await queryClient.cancelQueries()
    queryClient.clear()
  }

  const handleCopyUserId = async () => {
    if (!user?.id) {
      return
    }

    await Clipboard.setStringAsync(user.id)
    setStatusMessage('Copied current user id.')
    setErrorMessage(null)
  }

  const handleRefreshAccess = async () => {
    setStatusMessage(null)
    setErrorMessage(null)
    await saveCurrentDevIdentity()
    await refreshSavedIdentities()
    await accessQuery.refetch()
  }

  const handleCreateFreshUser = async () => {
    setIsCreatingUser(true)
    setStatusMessage(null)
    setErrorMessage(null)

    try {
      const identity = await createFreshAnonymousDevIdentity()
      await clearQueryCacheForIdentityChange()
      await refreshSavedIdentities()
      setStatusMessage(`Created fresh user ${shortId(identity.userId)}.`)
      router.replace('/')
    } catch (caughtError) {
      setErrorMessage(getErrorMessage(caughtError))
    } finally {
      setIsCreatingUser(false)
    }
  }

  const handleSwitchUser = async () => {
    setIsSwitchingUser(true)
    setStatusMessage(null)
    setErrorMessage(null)

    try {
      const identity = await switchToSavedDevIdentity(targetUserId)
      await clearQueryCacheForIdentityChange()
      await refreshSavedIdentities()
      setTargetUserId('')
      setStatusMessage(`Switched to ${shortId(identity.userId)}.`)
      router.replace('/')
    } catch (caughtError) {
      setErrorMessage(getErrorMessage(caughtError))
    } finally {
      setIsSwitchingUser(false)
    }
  }

  return (
    <Card tone="muted">
      <Text selectable style={[typography.heading, { color: colors.text }]}>
        Dev Identity
      </Text>
      <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
        Local anonymous-session tools only. Roles still change from Supabase SQL.
      </Text>

      <DevRow label="User ID" value={user?.id ?? 'Starting session'} />
      <DevRow
        label="Anonymous"
        value={user?.is_anonymous === undefined ? 'Unknown' : yesNo(user.is_anonymous)}
      />
      <DevRow
        label="Saved here"
        value={currentSavedIdentity ? 'Yes' : 'Not yet'}
      />

      {accessQuery.data ? (
        <>
          <DevRow label="Role" value={accessQuery.data.role} />
          <DevRow label="Plan" value={subscriptionStatus.statusTitle} />
          <DevRow label="Quota" value={subscriptionStatus.statusSubtitle} />
          <DevRow
            label="Used successful"
            value={`${accessQuery.data.usedSuccessfulGenerations}`}
          />
          <DevRow label="Free limit" value={`${accessQuery.data.freeLimit}`} />
          <DevRow
            label="Remaining"
            value={
              accessQuery.data.remaining === null
                ? 'No limit set'
                : `${accessQuery.data.remaining}`
            }
          />
          <DevRow label="Premium" value={yesNo(accessQuery.data.premiumActive)} />
          <DevRow label="Tester" value={yesNo(accessQuery.data.isTestUser)} />
          <DevRow label="Access" value={accessQuery.data.reason} />
        </>
      ) : (
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
          {accessQuery.isLoading
            ? 'Loading AI access state...'
            : 'AI access state unavailable.'}
        </Text>
      )}

      {accessQuery.error ? (
        <Text selectable style={[typography.caption, { color: colors.danger }]}>
          Could not load AI access state.
        </Text>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <Button
          label="Copy User ID"
          variant="secondary"
          disabled={!user?.id}
          onPress={() => {
            void handleCopyUserId()
          }}
        />
        <Button
          label="Refresh Access State"
          variant="secondary"
          onPress={() => {
            void handleRefreshAccess()
          }}
        />
        <Button
          label={
            isCreatingUser
              ? 'Creating Fresh User...'
              : 'Create Fresh Anonymous Test User'
          }
          variant="accent"
          disabled={isCreatingUser || isSwitchingUser}
          onPress={() => {
            void handleCreateFreshUser()
          }}
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Input
          label="Switch to saved user id"
          autoCapitalize="none"
          autoCorrect={false}
          value={targetUserId}
          onChangeText={setTargetUserId}
          placeholder="Paste a user id saved on this device"
        />
        <Button
          label={isSwitchingUser ? 'Switching User...' : 'Switch User'}
          variant="secondary"
          disabled={isCreatingUser || isSwitchingUser || !targetUserId.trim()}
          onPress={() => {
            void handleSwitchUser()
          }}
        />
      </View>

      {savedIdentities.length > 0 ? (
        <View style={{ gap: spacing.xs }}>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Saved anonymous users
          </Text>
          {savedIdentities.slice(0, 5).map((identity) => (
            <Text
              key={identity.userId}
              selectable
              onPress={() => setTargetUserId(identity.userId)}
              style={[typography.caption, { color: colors.text }]}
            >
              {shortId(identity.userId)}
              {identity.userId === user?.id ? ' (current)' : ''}
            </Text>
          ))}
        </View>
      ) : null}

      {statusMessage ? (
        <Text selectable style={[typography.caption, { color: colors.accent }]}>
          {statusMessage}
        </Text>
      ) : null}
      {errorMessage ? (
        <Text selectable style={[typography.caption, { color: colors.danger }]}>
          {errorMessage}
        </Text>
      ) : null}
    </Card>
  )
}

function DevRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
      }}
    >
      <Text selectable style={[typography.caption, { flex: 1, color: colors.text }]}>
        {label}
      </Text>
      <Text
        selectable
        style={[
          typography.caption,
          { flex: 1, color: colors.textMuted, textAlign: 'right' },
        ]}
      >
        {value}
      </Text>
    </View>
  )
}

function yesNo(value: boolean) {
  return value ? 'Yes' : 'No'
}

function shortId(value: string) {
  return `${value.slice(0, 8)}...`
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Dev identity action failed.'
}
