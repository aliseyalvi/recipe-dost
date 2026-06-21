import { AppProviders } from '@/providers/app-providers'
import { StatusBar } from 'expo-status-bar'
import Stack from 'expo-router/stack'
import { colors } from '@/theme'

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerBackTitle: 'Back',
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ title: 'Recipe Dost' }} />
        <Stack.Screen name="onboarding" options={{ title: 'Onboarding' }} />
        <Stack.Screen name="home" options={{ title: 'Home' }} />
        <Stack.Screen name="library" options={{ title: 'Library' }} />
        <Stack.Screen name="grocery" options={{ title: 'Grocery List' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="save-recipe" options={{ title: 'Save Recipe' }} />
        <Stack.Screen name="recipe/preview" options={{ title: 'Preview' }} />
        <Stack.Screen name="recipe/[id]" options={{ title: 'Saved Recipe' }} />
        <Stack.Screen name="recipe-card/[id]" options={{ title: 'Recipe Card' }} />
        <Stack.Screen name="recipe/ready" options={{ title: 'Recipe Card' }} />
        <Stack.Screen name="paywall" options={{ title: 'Recipe Dost Pro' }} />
      </Stack>
    </AppProviders>
  )
}
