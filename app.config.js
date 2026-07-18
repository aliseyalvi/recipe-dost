module.exports = ({ config }) => {
  const existingExtra = config.extra ?? {};
  const appEnv = process.env.APP_ENV === "production" ? "production" : "development";
  const appVariant = process.env.APP_VARIANT ?? appEnv;
  const isProduction = appEnv === "production" && appVariant === "production";
  const isPreview = appVariant === "preview";
  const isSentryDevelopmentTest =
    appEnv === "development" &&
    appVariant === "development" &&
    process.env.EXPO_PUBLIC_SENTRY_DEV_TEST === "true";
  const isPostHogDevelopmentTest =
    appEnv === "development" &&
    appVariant === "development" &&
    process.env.EXPO_PUBLIC_POSTHOG_DEV_TEST === "true";
  const sentryOrganization = process.env.SENTRY_ORG?.trim();
  const sentryProject = process.env.SENTRY_PROJECT?.trim();
  const sentrySourceMapPlugin =
    isProduction && sentryOrganization && sentryProject
      ? [
          [
            "@sentry/react-native/expo",
            {
              organization: sentryOrganization,
              project: sentryProject,
            },
          ],
        ]
      : [];
  const appName = isProduction
    ? "Recipe Dost"
    : isPreview
      ? "Recipe Dost Preview"
      : "Recipe Dost Dev";
  const androidPackage = isProduction ? "com.recipedost.app" : "com.recipedost.dev";

  return {
    expo: {
      name: appName,
      slug: "recipe-dost",
      scheme: "recipe-dost",
      version: "1.0.1",
      orientation: "portrait",
      icon: "./assets/images/icon.png",
      userInterfaceStyle: "dark",
      androidStatusBar: {
        translucent: false,
        barStyle: "light-content",
        backgroundColor: "#000000",
      },
      ios: {
        supportsTablet: true,
      },
      android: {
        package: androidPackage,
        versionCode: 3,
        blockedPermissions: [
          "android.permission.READ_EXTERNAL_STORAGE",
          "android.permission.WRITE_EXTERNAL_STORAGE",
        ],
        softwareKeyboardLayoutMode: "resize",
        adaptiveIcon: {
          foregroundImage: "./assets/images/adaptive-icon.png",
          backgroundColor: "#050505",
          // backgroundImage: "./assets/android-icon-background.png",
          // monochromeImage: "./assets/android-icon-monochrome.png",
        },
        intentFilters: [
          {
            action: "SEND",
            category: ["DEFAULT"],
            data: [{ mimeType: "text/plain" }, { mimeType: "text/*" }],
          },
        ],
        predictiveBackGestureEnabled: false,
      },
      web: {
        favicon: "./assets/images/favicon.png",
      },
      plugins: [
        "expo-router",
        "expo-font",
        "expo-secure-store",
        "expo-localization",
        "expo-sharing",
        "expo-sqlite",
        ...sentrySourceMapPlugin,
        [
          "expo-splash-screen",
          {
            image: "./assets/images/splash-icon.png",
            imageWidth: 200,
            resizeMode: "contain",
            backgroundColor: "#050505",
          },
        ],
        [
          "expo-share-intent",
          {
            androidIntentFilters: ["text/plain", "text/*"],
            androidMultiIntentFilters: [],
            disableIOS: true,
          },
        ],
      ],
      extra: {
        ...existingExtra,
        appEnv,
        appVariant,
        telemetryEnabled: isProduction,
        sentryTransmissionEnabled: isProduction || isSentryDevelopmentTest,
        posthogTransmissionEnabled: isProduction || isPostHogDevelopmentTest,
        eas: {
          ...(existingExtra.eas ?? {}),
          projectId: "bf6a2714-3cdd-4ecf-98c1-9f9b8c558bf0",
        },
      },
    },
  };
};
