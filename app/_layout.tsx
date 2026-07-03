import { AppProviders } from "@/providers/app-providers";
import { StatusBar } from "expo-status-bar";
import Stack from "expo-router/stack";
import { colors } from "@/theme";

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerShown: false,
          headerBackTitle: "Back",
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text, fontWeight: "800" },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ title: "Recipe Dost" }} />
        <Stack.Screen name="onboarding" options={{ title: "Onboarding" }} />
        <Stack.Screen name="save-recipe" options={{ title: "Save Recipe" }} />
        <Stack.Screen name="share-recipe" options={{ title: "Share Recipe" }} />
        <Stack.Screen name="recipe/preview" options={{ title: "Preview" }} />
        <Stack.Screen
          name="recipe/[id]"
          options={{ headerShown: true, title: "Saved Recipe" }}
        />
        <Stack.Screen
          name="recipe-card/[id]"
          options={{ headerShown: true, title: "AI Recipe" }}
        />
        <Stack.Screen name="recipe/ready" options={{ title: "Recipe Card" }} />
        <Stack.Screen name="paywall" options={{ title: "Recipe Dost Pro" }} />
      </Stack>
    </AppProviders>
  );
}
