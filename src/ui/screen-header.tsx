import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, radius, spacing, typography } from '@/theme'
import { useLocalSearchParams, useRouter } from 'expo-router'
import type { Href } from 'expo-router'
import { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { AppIcon, type AppIconName } from '@/ui/app-icon'

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
  const { returnTo: returnToParam } = useLocalSearchParams<{
    returnTo?: string | string[]
  }>()
  const returnToRoute = getReturnToRoute(returnToParam)

  const goBack = () => {
    if (onBack) {
      onBack()
      return
    }

    const fallback = returnToRoute ?? fallbackRoute

    track('navigation_back_tapped', {
      title,
      fallback_route:
        typeof fallback === 'string' ? fallback : 'object_route',
    })

    if (router.canGoBack()) {
      router.back()
      return
    }

    if (returnToRoute) {
      router.replace(returnToRoute)
      return
    }

    router.replace(fallback)
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
            icon="back"
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

function getReturnToRoute(value: string | string[] | undefined): Href | null {
  const route = Array.isArray(value) ? value[0] : value

  if (!route || !route.startsWith('/') || route.startsWith('//')) {
    return null
  }

  return route as Href
}

export function NestedHeaderIconButton({
  accessibilityLabel,
  icon,
  onPress,
}: {
  accessibilityLabel: string
  icon: AppIconName
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
      <AppIcon name={icon} color={colors.text} size={22} />
    </Pressable>
  )
}
