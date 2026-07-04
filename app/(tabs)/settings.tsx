import {
  DevIdentityPanel,
  shouldShowDevIdentityPanel,
} from '@/features/dev-tools/dev-identity-panel'
import { getAiAccessState } from '@/lib/api/ai-access'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { useAuth } from '@/providers/auth-provider'
import { colors, radius, spacing, typography } from '@/theme'
import { AppHeader } from '@/ui/app-header'
import { Card } from '@/ui/card'
import { Screen } from '@/ui/screen'
import { useQuery } from '@tanstack/react-query'
import Constants from 'expo-constants'
import * as Application from 'expo-application'
import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'

type SettingsRowProps = {
  marker: string
  title: string
  subtitle: string
  value?: string
  danger?: boolean
  onPress?: () => void
}

const appVersion =
  Application.nativeApplicationVersion ??
  Constants.expoConfig?.version ??
  '1.0.0'

export default function SettingsRoute() {
  const router = useRouter()
  const { user } = useAuth()
  const { track } = usePostHog()
  const aiAccessQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ['ai-access-state', user?.id, 'settings'],
    queryFn: getAiAccessState,
  })
  const showDeveloperSection = shouldShowDevIdentityPanel(aiAccessQuery.data)
  const userIdentifier = user?.id ? shortId(user.id) : null

  useEffect(() => {
    track('settings_screen_viewed')
  }, [track])

  const showPlaceholder = (row: string, message: string) => {
    track('settings_placeholder_tapped', { row })
    Alert.alert('Coming soon', message)
  }

  return (
    <Screen compact tabBarPadding>
      <AppHeader
        eyebrow="Settings"
        title="Settings"
        subtitle="Manage your app profile, preferences, privacy, and support."
      />

      <SettingsSection title="Profile">
        <SettingsRow
          marker="P"
          title={user?.email ?? 'Guest profile'}
          subtitle="Your saved recipes are linked to this app profile."
          value={userIdentifier ?? 'Starting'}
        />
      </SettingsSection>

      <SettingsSection title="Subscription" tone="warm">
        <SettingsRow
          marker="$"
          title="Free plan"
          subtitle="3 free AI recipe cards included."
        />
        <SettingsRow
          marker="+"
          title="Upgrade to Premium"
          subtitle="Premium is coming next."
          onPress={() =>
            showPlaceholder('upgrade_to_premium', 'Premium is coming next.')
          }
        />
        <SettingsRow
          marker="R"
          title="Restore purchases"
          subtitle="Restore support will arrive with Premium."
          onPress={() =>
            showPlaceholder(
              'restore_purchases',
              'Restore purchases is coming soon.'
            )
          }
        />
      </SettingsSection>

      <SettingsSection title="Recipe Preferences">
        <SettingsRow
          marker="L"
          title="Secondary recipe language"
          subtitle="Urdu / اردو"
          onPress={() => {
            track('settings_row_tapped', {
              row: 'secondary_recipe_language',
            })
            router.push('/settings/secondary-language')
          }}
        />
      </SettingsSection>

      <SettingsSection title="Appearance">
        <SettingsRow
          marker="T"
          title="Theme"
          subtitle="System default"
          onPress={() =>
            showPlaceholder('theme', 'Theme options are coming later.')
          }
        />
      </SettingsSection>

      <SettingsSection title="Privacy & Data">
        <SettingsRow
          marker="i"
          title="Privacy & data usage"
          subtitle="Plain-language details before launch."
          onPress={() => {
            track('settings_row_tapped', {
              row: 'privacy_data_usage',
            })
            router.push('/settings/privacy-data')
          }}
        />
        <SettingsRow
          marker="!"
          title="Delete account & data"
          subtitle="Request deletion before backend automation."
          danger
          onPress={() => {
            track('settings_row_tapped', {
              row: 'delete_account_data',
            })
            router.push('/settings/delete-account-data')
          }}
        />
      </SettingsSection>

      <SettingsSection title="Support">
        <SettingsRow
          marker="?"
          title="Contact support"
          subtitle="Support contact is coming soon."
          onPress={() =>
            showPlaceholder('contact_support', 'Contact support is coming soon.')
          }
        />
        <SettingsRow
          marker="V"
          title="App version"
          subtitle={appVersion}
        />
      </SettingsSection>

      {showDeveloperSection ? (
        <View style={{ gap: spacing.md }}>
          <SectionTitle title="Developer" />
          <DeveloperDiagnosticsCard
            role={aiAccessQuery.data?.role ?? (__DEV__ ? 'Development' : 'Unknown')}
            accessState={
              aiAccessQuery.data
                ? getDeveloperAccessLabel(aiAccessQuery.data)
                : aiAccessQuery.isLoading
                  ? 'Loading access'
                  : 'Access unavailable'
            }
          />
          <DevIdentityPanel />
        </View>
      ) : null}
    </Screen>
  )
}

function SettingsSection({
  children,
  title,
  tone = 'default',
}: {
  children: ReactNode
  title: string
  tone?: 'default' | 'warm' | 'muted'
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <SectionTitle title={title} />
      <Card tone={tone}>{children}</Card>
    </View>
  )
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Text
      selectable
      style={[
        typography.caption,
        {
          color: colors.textMuted,
          fontWeight: '800',
          textTransform: 'uppercase',
        },
      ]}
    >
      {title}
    </Text>
  )
}

function SettingsRow({
  marker,
  title,
  subtitle,
  value,
  danger = false,
  onPress,
}: SettingsRowProps) {
  const content = (
    <>
      <View
        style={{
          width: 34,
          height: 34,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.sm,
          backgroundColor: danger ? colors.dangerSurface : colors.surfaceMuted,
        }}
      >
        <Text
          selectable={false}
          style={[
            typography.caption,
            {
              color: danger ? colors.danger : colors.accent,
              fontWeight: '900',
            },
          ]}
        >
          {marker}
        </Text>
      </View>
      <View style={{ minWidth: 0, flex: 1, gap: 2 }}>
        <Text
          selectable
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[
            typography.body,
            { color: danger ? colors.danger : colors.text, fontWeight: '800' },
          ]}
        >
          {title}
        </Text>
        <Text
          selectable
          numberOfLines={2}
          ellipsizeMode="tail"
          style={[typography.caption, { color: colors.textMuted }]}
        >
          {subtitle}
        </Text>
      </View>
      {value ? (
        <Text
          selectable
          numberOfLines={1}
          ellipsizeMode="middle"
          style={[typography.caption, { color: colors.textMuted }]}
        >
          {value}
        </Text>
      ) : null}
      {onPress ? (
        <Text
          selectable={false}
          style={[typography.body, { color: colors.textMuted, fontWeight: '900' }]}
        >
          {'>'}
        </Text>
      ) : null}
    </>
  )

  if (!onPress) {
    return (
      <View
        style={{
          minHeight: 58,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        {content}
      </View>
    )
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 58,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        borderRadius: radius.md,
        opacity: pressed ? 0.78 : 1,
      })}
    >
      {content}
    </Pressable>
  )
}

function DeveloperDiagnosticsCard({
  role,
  accessState,
}: {
  role: string
  accessState: string
}) {
  return (
    <Card tone="muted">
      <Text selectable style={[typography.heading, { color: colors.text }]}>
        Access diagnostics
      </Text>
      <SettingsRow marker="D" title="Role" subtitle={role} />
      <SettingsRow marker="A" title="AI access" subtitle={accessState} />
      <SettingsRow marker="S" title="Supabase" subtitle="Anonymous auth enabled" />
      <SettingsRow marker="R" title="RevenueCat" subtitle="Not initialized" />
    </Card>
  )
}

function shortId(value: string) {
  return `${value.slice(0, 8)}...`
}

function getDeveloperAccessLabel(access: {
  premiumActive: boolean
  isTestUser: boolean
  remaining: number | null
  reason: string
}) {
  if (access.premiumActive) {
    return 'Premium'
  }

  if (access.isTestUser) {
    return 'Tester'
  }

  if (access.reason === 'limit_reached') {
    return 'Limit reached'
  }

  return access.remaining === null ? 'Unlimited' : `${access.remaining} remaining`
}
