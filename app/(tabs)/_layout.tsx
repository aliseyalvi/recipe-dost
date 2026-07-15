import { useSaveRecipeModal } from '@/features/save-recipe/save-recipe-modal'
import { borders, colors, radius, shadows, spacing, typography } from '@/theme'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { AppIcon, type AppIconName } from '@/ui/app-icon'
import { Tabs } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const tabIcons = {
  home: { inactive: 'home-outline', active: 'home' },
  library: { inactive: 'library-outline', active: 'library' },
  grocery: { inactive: 'grocery-outline', active: 'grocery' },
  settings: { inactive: 'settings-outline', active: 'settings' },
} as const satisfies Record<
  string,
  { inactive: AppIconName; active: AppIconName }
>

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
    navigate: (name: string, params?: Record<string, string>) => void
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
        bottom: spacing.sm + insets.bottom,
        left: spacing.lg,
        minHeight: 74,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: radius.card,
        borderCurve: 'continuous',
        ...borders.subtle,
        ...shadows.floating,
        backgroundColor: colors.glassSurface,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
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
    navigate: (name: string, params?: Record<string, string>) => void
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
      accessibilityLabel={`Open ${getTabLabel(route.name)} tab`}
      accessibilityState={{ selected: isActive }}
      onPress={() => {
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        })

        if (!event.defaultPrevented) {
          track('tab_changed', { tab: route.name })
          navigation.navigate(
            route.name,
            route.name === 'library' ? { tab: 'recent' } : undefined
          )
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
      <View style={{ opacity: isActive ? 1 : 0.62 }}>
        <AppIcon
          name={
            isActive
              ? tabIcons[route.name].active
              : tabIcons[route.name].inactive
          }
          color={isActive ? colors.primary : colors.onSurfaceVariant}
          size={24}
        />
      </View>
      <Text
        selectable={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[
          typography.caption,
          {
            color: isActive ? colors.primary : colors.onSurfaceVariant,
            fontWeight: isActive ? '800' : '700',
            textAlign: 'center',
            opacity: isActive ? 1 : 0.62,
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
  const { openSaveRecipeModal } = useSaveRecipeModal()
  const { track } = usePostHog()

  return (
    <View style={{ width: 68, alignItems: 'center' }}>
      <Pressable
        accessibilityLabel="Add recipe"
        accessibilityRole="button"
        onPress={() => {
          track('tab_changed', { tab: 'add' })
          openSaveRecipeModal()
        }}
        style={({ pressed }) => ({
          width: 60,
          height: 60,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 3,
          borderColor: colors.background,
          borderRadius: radius.pill,
          backgroundColor: colors.primaryContainer,
          opacity: pressed ? 0.84 : 1,
          transform: [{ translateY: -17 }],
          ...shadows.fab,
        })}
      >
        <AppIcon name="add" color={colors.onPrimaryContainer} size={32} />
      </Pressable>
      <Text
        selectable={false}
        style={[
          typography.caption,
          {
            position: 'absolute',
            bottom: 1,
            color: colors.primary,
            fontWeight: '800',
          },
        ]}
      >
        Add
      </Text>
    </View>
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
