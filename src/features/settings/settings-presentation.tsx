import type { NormalizedSubscriptionStatus } from '@/features/subscription/normalized-subscription-status'
import { borders, colors, radius, shadows, spacing, typography } from '@/theme'
import { AppBadge } from '@/ui/app-badge'
import { AppIcon, type AppIconName } from '@/ui/app-icon'
import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'

export type SettingsIconName =
  | 'profile'
  | 'premium'
  | 'upgrade'
  | 'manage'
  | 'restore'
  | 'refresh'
  | 'language'
  | 'theme'
  | 'privacy'
  | 'delete'
  | 'support'
  | 'version'
  | 'developer'

export type SettingsFeedbackTone = 'info' | 'success' | 'error'

type SettingsRowProps = {
  icon: SettingsIconName
  title: string
  subtitle: string
  value?: string
  danger?: boolean
  disabled?: boolean
  busy?: boolean
  onPress?: () => void
  accessibilityHint?: string
}

const settingsIconMap: Record<SettingsIconName, AppIconName> = {
  profile: 'profile',
  premium: 'ai-recipe',
  upgrade: 'ai-recipe',
  manage: 'external',
  restore: 'restore',
  refresh: 'refresh',
  language: 'language',
  theme: 'theme',
  privacy: 'privacy',
  delete: 'trash',
  support: 'support',
  version: 'info',
  developer: 'developer',
}

export function SettingsHeader() {
  return (
    <View style={{ gap: spacing.sm, paddingTop: spacing.xs }}>
      <Text
        selectable
        style={[
          typography.hero,
          {
            color: colors.onSurface,
            fontStyle: 'italic',
            letterSpacing: -0.45,
          },
        ]}
      >
        Settings
      </Text>
      <Text
        selectable
        style={[typography.body, { maxWidth: 360, color: colors.textMuted }]}
      >
        Manage your app profile, preferences, privacy, and support.
      </Text>
    </View>
  )
}

export function SettingsSection({
  children,
  title,
}: {
  children: ReactNode
  title: string
}) {
  return (
    <View style={{ gap: spacing.md }}>
      <Text
        selectable
        style={[
          typography.label,
          {
            color: colors.onSurfaceVariant,
            fontWeight: '800',
            letterSpacing: 1.15,
          },
        ]}
      >
        {title}
      </Text>
      {children}
    </View>
  )
}

export function SettingsPanel({
  children,
  featured = false,
}: {
  children: ReactNode
  featured?: boolean
}) {
  return (
    <View
      style={{
        overflow: 'hidden',
        borderRadius: radius.card,
        borderCurve: 'continuous',
        backgroundColor: colors.glassSurface,
        paddingHorizontal: spacing.lg,
        ...(featured
          ? {
              borderWidth: 1,
              borderColor: colors.primaryOutlineSoft,
              experimental_backgroundImage:
                'linear-gradient(135deg, rgba(255, 179, 176, 0.12) 0%, rgba(30, 31, 35, 0.97) 42%, rgba(18, 19, 23, 0.98) 100%)',
              ...shadows.card,
            }
          : borders.subtle),
      }}
    >
      {children}
    </View>
  )
}

export function SettingsDivider() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        height: 1,
        marginLeft: 52,
        backgroundColor: colors.outlineVariant,
        opacity: 0.42,
      }}
    />
  )
}

export function ProfileSettingsCard({ identifier }: { identifier: string }) {
  return (
    <SettingsPanel>
      <View
        accessible
        accessibilityLabel={`Anonymous Account ID ${identifier}`}
        style={{
          minHeight: 92,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.lg,
          paddingVertical: spacing.lg,
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: colors.primaryOutlineSoft,
            backgroundColor: colors.primaryWash,
          }}
        >
          <Text
            selectable={false}
            style={[
              typography.heading,
              { color: colors.primary, fontStyle: 'italic', fontWeight: '700' },
            ]}
          >
            R
          </Text>
        </View>
        <View style={{ minWidth: 0, flex: 1, gap: spacing.xs }}>
          <Text
            selectable
            style={[typography.body, { color: colors.onSurface, fontWeight: '800' }]}
          >
            Anonymous Account ID
          </Text>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Support may request this non-secret ID to locate your anonymous account. Press and hold the ID to copy it.
          </Text>
          <Text
            selectable
            numberOfLines={1}
            ellipsizeMode="middle"
            style={[typography.caption, { color: colors.tertiary, fontWeight: '700' }]}
          >
            {identifier}
          </Text>
        </View>
      </View>
    </SettingsPanel>
  )
}

export function SubscriptionStatusCard({
  detailText,
  errorMessage,
  status,
}: {
  detailText: string | null
  errorMessage?: string | null
  status: NormalizedSubscriptionStatus
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${status.statusTitle}. ${status.statusSubtitle}`}
      style={{
        gap: spacing.md,
        paddingBottom: spacing.lg,
        paddingTop: spacing.card,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
        }}
      >
        <AppBadge
          label={status.statusTitle}
          tone={status.isPremium ? 'primary' : 'default'}
        />
        <SettingsIcon name={status.isPremium ? 'premium' : 'profile'} featured />
      </View>
      <View style={{ gap: spacing.xs }}>
        <Text
          selectable
          style={[
            typography.heading,
            { color: colors.onSurface, fontStyle: 'italic', fontWeight: '700' },
          ]}
        >
          {status.statusTitle}
        </Text>
        <Text selectable style={[typography.body, { color: colors.onSurfaceVariant }]}>
          {status.statusSubtitle}
        </Text>
      </View>
      <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
        {status.isPremium
          ? 'Premium AI recipe access is active for this app profile.'
          : 'Save recipe links, metadata preview, library search, and grocery viewing stay free.'}
      </Text>
      {detailText ? (
        <Text selectable style={[typography.caption, { color: colors.tertiary }]}>
          {detailText}
        </Text>
      ) : null}
      {errorMessage ? (
        <SettingsFeedback message={errorMessage} tone="error" />
      ) : null}
    </View>
  )
}

export function SettingsFeedback({
  message,
  tone = 'info',
}: {
  message: string
  tone?: SettingsFeedbackTone
}) {
  const isError = tone === 'error'
  const isSuccess = tone === 'success'
  const foreground = isError
    ? colors.error
    : isSuccess
      ? colors.success
      : colors.tertiary
  const backgroundColor = isError
    ? colors.dangerSurface
    : isSuccess
      ? colors.successContainer
      : 'rgba(0, 106, 133, 0.20)'

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: foreground,
        backgroundColor,
        padding: spacing.md,
      }}
    >
      <Text selectable style={[typography.caption, { color: foreground }]}>
        {message}
      </Text>
    </View>
  )
}

export function SettingsRow({
  icon,
  title,
  subtitle,
  value,
  danger = false,
  disabled = false,
  busy = false,
  onPress,
  accessibilityHint,
}: SettingsRowProps) {
  const content = (
    <>
      <SettingsIcon name={icon} danger={danger} />
      <View style={{ minWidth: 0, flex: 1, gap: 2 }}>
        <Text
          selectable
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[
            typography.body,
            {
              color: danger ? colors.error : colors.onSurface,
              fontWeight: '700',
            },
          ]}
        >
          {title}
        </Text>
        <Text
          selectable
          numberOfLines={3}
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
          ellipsizeMode="tail"
          style={[
            typography.caption,
            { maxWidth: 112, color: colors.onSurfaceVariant, textAlign: 'right' },
          ]}
        >
          {value}
        </Text>
      ) : null}
      {busy ? (
        <ActivityIndicator
          color={danger ? colors.error : colors.primary}
          size="small"
        />
      ) : onPress ? (
        <AppIcon name="forward" color={colors.outline} size={20} />
      ) : null}
    </>
  )

  const commonStyle = {
    minHeight: 72,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    paddingVertical: spacing.md,
  }

  if (!onPress) {
    return (
      <View style={[commonStyle, disabled ? { opacity: 0.52 } : null]}>
        {content}
      </View>
    )
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy, disabled }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        commonStyle,
        {
          marginHorizontal: -spacing.sm,
          borderRadius: radius.md,
          paddingHorizontal: spacing.sm,
          backgroundColor: pressed ? colors.primaryWash : 'transparent',
          opacity: disabled ? 0.52 : pressed ? 0.78 : 1,
        },
      ]}
    >
      {content}
    </Pressable>
  )
}

export function SettingsIcon({
  name,
  danger = false,
  featured = false,
}: {
  name: SettingsIconName
  danger?: boolean
  featured?: boolean
}) {
  const foreground = danger
    ? colors.error
    : name === 'language' || name === 'privacy'
      ? colors.tertiary
      : colors.primary

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: featured ? 44 : 40,
        height: featured ? 44 : 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: danger
          ? 'rgba(255, 180, 171, 0.32)'
          : colors.primaryOutlineSoft,
        backgroundColor: danger ? colors.dangerSurface : colors.primaryWash,
      }}
    >
      <AppIcon
        name={settingsIconMap[name]}
        color={foreground}
        size={featured ? 22 : 19}
      />
    </View>
  )
}
