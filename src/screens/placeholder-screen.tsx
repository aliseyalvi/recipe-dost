import { useTrackScreen } from '@/analytics/use-track-screen'
import { colors, spacing, typography } from '@/theme'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { Screen } from '@/ui/screen'
import { Href, useRouter } from 'expo-router'
import { ReactNode } from 'react'
import { Text, View } from 'react-native'

type Action = {
  label: string
  href: Href
}

type Props = {
  screenName: string
  eyebrow: string
  title: string
  description: string
  primaryAction?: Action
  secondaryAction?: Action
  children?: ReactNode
}

export function PlaceholderScreen({
  screenName,
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
  children,
}: Props) {
  const router = useRouter()
  useTrackScreen(screenName)

  return (
    <Screen>
      <View style={{ gap: spacing.md }}>
        <Text
          selectable
          style={[
            typography.caption,
            { color: colors.accent, textTransform: 'uppercase' },
          ]}
        >
          {eyebrow}
        </Text>
        <Text selectable style={[typography.title, { color: colors.text }]}>
          {title}
        </Text>
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          {description}
        </Text>
      </View>

      {children ? <View style={{ gap: spacing.lg }}>{children}</View> : null}

      <Card>
        <Text selectable style={[typography.heading, { color: colors.text }]}>
          Milestone M1 placeholder
        </Text>
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          This screen is wired for navigation, theme, i18n, query, and no-op
          observability providers. Backend and AI behavior will be added in a
          later milestone through Supabase Edge Functions.
        </Text>
      </Card>

      <View style={{ gap: spacing.md }}>
        {primaryAction ? (
          <Button
            label={primaryAction.label}
            onPress={() => router.push(primaryAction.href)}
            fullWidth
          />
        ) : null}
        {secondaryAction ? (
          <Button
            label={secondaryAction.label}
            onPress={() => router.push(secondaryAction.href)}
            variant="secondary"
            fullWidth
          />
        ) : null}
      </View>
    </Screen>
  )
}
