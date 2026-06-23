import { colors, radius, spacing, typography } from '@/theme'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { Tabs, useRouter } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const tabIcons = {
  home: '⌂',
  library: '▰',
  grocery: '▤',
  settings: '⚙',
} as const

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
      }}
      tabBar={(props) => <RecipeDostTabBar {...props} />}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="library" options={{ title: 'Library' }} />
      <Tabs.Screen name="grocery" options={{ title: 'Grocery' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  )
}

function RecipeDostTabBar({
  state,
  navigation,
}: {
  state: {
    index: number
    routes: { key: string; name: string }[]
  }
  navigation: {
    emit: (event: {
      type: 'tabPress'
      target: string
      canPreventDefault: true
    }) => { defaultPrevented: boolean }
    navigate: (name: string) => void
  }
}) {
  const insets = useSafeAreaInsets()
  const visibleRoutes = state.routes.filter(isTabRoute)
  const [home, library, grocery, settings] = visibleRoutes

  return (
    <View
      style={{
        position: 'absolute',
        right: spacing.lg,
        bottom: spacing.md + insets.bottom,
        left: spacing.lg,
        minHeight: 76,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        boxShadow: '0 18px 40px rgba(0, 0, 0, 0.45)',
      }}
    >
      <TabButton
        route={home}
        activeRouteName={state.routes[state.index]?.name}
        navigation={navigation}
      />
      <TabButton
        route={library}
        activeRouteName={state.routes[state.index]?.name}
        navigation={navigation}
      />
      <CenterSaveButton />
      <TabButton
        route={grocery}
        activeRouteName={state.routes[state.index]?.name}
        navigation={navigation}
      />
      <TabButton
        route={settings}
        activeRouteName={state.routes[state.index]?.name}
        navigation={navigation}
      />
    </View>
  )
}

function TabButton({
  route,
  activeRouteName,
  navigation,
}: {
  route: { key: string; name: keyof typeof tabIcons } | undefined
  activeRouteName: string | undefined
  navigation: {
    emit: (event: {
      type: 'tabPress'
      target: string
      canPreventDefault: true
    }) => { defaultPrevented: boolean }
    navigate: (name: string) => void
  }
}) {
  const { track } = usePostHog()

  if (!route) {
    return <View style={{ flex: 1 }} />
  }

  const isActive = activeRouteName === route.name

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      onPress={() => {
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        })

        if (!event.defaultPrevented) {
          track('tab_changed', { tab: route.name })
          navigation.navigate(route.name)
        }
      }}
      style={({ pressed }) => ({
        minHeight: 54,
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        opacity: pressed ? 0.78 : 1,
      })}
    >
      <Text
        selectable={false}
        style={{
          color: isActive ? colors.primary : colors.textMuted,
          fontSize: route.name === 'settings' ? 22 : 24,
          lineHeight: 26,
          fontWeight: '800',
        }}
      >
        {tabIcons[route.name]}
      </Text>
      <Text
        selectable={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[
          typography.caption,
          {
            color: isActive ? colors.primary : colors.textMuted,
            fontWeight: isActive ? '800' : '700',
            textAlign: 'center',
          },
        ]}
      >
        {getTabLabel(route.name)}
      </Text>
    </Pressable>
  )
}

function isTabRoute(
  route: { key: string; name: string }
): route is { key: string; name: keyof typeof tabIcons } {
  return route.name in tabIcons
}

function CenterSaveButton() {
  const router = useRouter()

  return (
    <Pressable
      accessibilityLabel="Save Recipe"
      accessibilityRole="button"
      onPress={() => router.push('/save-recipe')}
      style={({ pressed }) => ({
        width: 72,
        height: 72,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.pill,
        backgroundColor: colors.primary,
        opacity: pressed ? 0.84 : 1,
        transform: [{ translateY: -18 }],
        boxShadow: '0 12px 28px rgba(255, 73, 61, 0.34)',
      })}
    >
      <Text
        selectable={false}
        style={{
          color: colors.primaryText,
          fontSize: 40,
          lineHeight: 44,
          fontWeight: '500',
        }}
      >
        +
      </Text>
    </Pressable>
  )
}

function getTabLabel(routeName: keyof typeof tabIcons) {
  switch (routeName) {
    case 'home':
      return 'Home'
    case 'library':
      return 'Library'
    case 'grocery':
      return 'Grocery'
    case 'settings':
      return 'Settings'
  }
}
