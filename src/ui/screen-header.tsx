import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, radius, spacing, typography } from '@/theme'
import { useRouter } from 'expo-router'
import type { Href } from 'expo-router'
import { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'

type Props = {
  title: string
  showBack?: boolean
  onBack?: () => void
  fallbackRoute?: Href
  rightActions?: ReactNode
  subtitle?: string
}

export function NestedScreenHeader({
  title,
  showBack = true,
  onBack,
  fallbackRoute = '/',
  rightActions,
  subtitle,
}: Props) {
  const router = useRouter()
  const { track } = usePostHog()

  const goBack = () => {
    if (onBack) {
      onBack()
      return
    }

    track('navigation_back_tapped', {
      title,
      fallback_route:
        typeof fallbackRoute === 'string' ? fallbackRoute : 'object_route',
    })

    if (router.canGoBack()) {
      router.back()
      return
    }

    router.replace(fallbackRoute)
  }

  return (
    <View
      style={{
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
        backgroundColor: colors.background,
      }}
    >
      <View
        style={{
          minWidth: 0,
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        {showBack ? (
          <NestedHeaderIconButton
            accessibilityLabel="Go back"
            icon="‹"
            onPress={goBack}
          />
        ) : null}
        <View style={{ minWidth: 0, flex: 1 }}>
          <Text
            selectable
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[typography.heading, { color: colors.text }]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              selectable
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[typography.caption, { color: colors.textMuted }]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {rightActions ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
          }}
        >
          {rightActions}
        </View>
      ) : null}
    </View>
  )
}

export function NestedHeaderIconButton({
  accessibilityLabel,
  icon,
  onPress,
}: {
  accessibilityLabel: string
  icon: string
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.pill,
        backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
        opacity: pressed ? 0.82 : 1,
      })}
    >
      <Text
        selectable={false}
        style={{
          color: colors.text,
          fontSize: icon === '‹' ? 34 : 22,
          lineHeight: icon === '‹' ? 36 : 26,
          fontWeight: '700',
        }}
      >
        {icon}
      </Text>
    </Pressable>
  )
}
