import { ContentLanguageControl } from '@/features/language/content-language-control'
import {
  DevIdentityPanel,
  shouldShowDevIdentityPanel,
} from '@/features/dev-tools/dev-identity-panel'
import { getAiAccessState } from '@/lib/api/ai-access'
import { useAuth } from '@/providers/auth-provider'
import { colors, spacing, typography } from '@/theme'
import { AppHeader } from '@/ui/app-header'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { Screen } from '@/ui/screen'
import { useQuery } from '@tanstack/react-query'
import { Text, View } from 'react-native'

export default function SettingsRoute() {
  const { user } = useAuth()
  const aiAccessQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ['ai-access-state', user?.id, 'settings'],
    queryFn: getAiAccessState,
  })

  return (
    <Screen compact tabBarPadding>
      <AppHeader
        eyebrow="Settings"
        title="Settings"
        subtitle="Account, plan, app, and support."
      />

      <Card>
        <Text selectable style={[typography.heading, { color: colors.text }]}>
          Account
        </Text>
        <SettingsRow label="Account" value="Guest mode" />
        <SettingsRow
          label="Anonymous user"
          value={user?.id ? shortId(user.id) : 'Starting session'}
        />
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
          Sign-in and account linking are coming later.
        </Text>
      </Card>

      <Card tone="warm">
        <Text selectable style={[typography.heading, { color: colors.text }]}>
          Plan
        </Text>
        <SettingsRow label="Plan" value="Free plan" />
        <SettingsRow
          label="AI recipes left"
          value={
            aiAccessQuery.data
              ? getAiRecipesLeftValue(aiAccessQuery.data)
              : aiAccessQuery.isLoading
                ? 'Loading'
                : 'Unavailable'
          }
        />
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          Basic organizer features stay free. AI recipe cards will be monetized
          after free tries.
        </Text>
        {aiAccessQuery.error ? (
          <View style={{ gap: spacing.sm }}>
            <Text selectable style={[typography.caption, { color: colors.danger }]}>
              Could not load plan usage.
            </Text>
            <Button
              label="Retry usage"
              variant="secondary"
              onPress={() => {
                void aiAccessQuery.refetch()
              }}
            />
          </View>
        ) : null}
        <Button label="Upgrade coming next" disabled variant="secondary" />
        <Button label="Restore coming later" disabled variant="ghost" />
      </Card>

      <Card>
        <Text selectable style={[typography.heading, { color: colors.text }]}>
          App
        </Text>
        <SettingsRow label="Theme" value="Warm dark" />
        <SettingsRow label="Video storage" value="Not used" />
      </Card>

      <Card>
        <Text selectable style={[typography.heading, { color: colors.text }]}>
          Language
        </Text>
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          Recipe content language
        </Text>
        <ContentLanguageControl />
      </Card>

      {shouldShowDevIdentityPanel() ? (
        <DevIdentityPanel />
      ) : null}

      {__DEV__ ? (
        <Card>
          <Text selectable style={[typography.heading, { color: colors.text }]}>
            Development
          </Text>
          <SettingsRow label="Telemetry" value="Placeholder only" />
          <SettingsRow label="RevenueCat" value="Not initialized" />
          <SettingsRow label="Supabase" value="Anonymous auth enabled" />
        </Card>
      ) : null}

      <Card>
        <Text selectable style={[typography.heading, { color: colors.text }]}>
          Support
        </Text>
        <SettingsRow label="Help" value="Coming later" />
        <SettingsRow label="Privacy" value="Before launch" />
        <SettingsRow label="Terms" value="Before launch" />
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          Support, privacy, terms, and account deletion will be added before
          launch.
        </Text>
      </Card>

    </Screen>
  )
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
      }}
    >
      <Text selectable style={[typography.body, { flex: 1, color: colors.text }]}>
        {label}
      </Text>
      <Text
        selectable
        style={[typography.body, { color: colors.textMuted, textAlign: 'right' }]}
      >
        {value}
      </Text>
    </View>
  )
}

function shortId(value: string) {
  return `${value.slice(0, 8)}...`
}

function getAiRecipesLeftValue(access: {
  role: string
  isTestUser: boolean
  premiumActive: boolean
  remaining: number | null
  reason: string
}) {
  if (access.role === 'admin') {
    return 'Admin'
  }

  if (access.isTestUser || access.role === 'tester') {
    return 'Tester'
  }

  if (access.premiumActive) {
    return 'Pro'
  }

  if (access.reason === 'limit_reached') {
    return '0'
  }

  return access.remaining === null ? '-' : `${access.remaining}`
}
