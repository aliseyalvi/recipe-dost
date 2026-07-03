module.exports = ({ config }) => {
  const existingExtra = config.extra ?? {};

  return {
    expo: {
      name: "Recipe Dost",
      slug: "recipe-dost",
      scheme: "recipe-dost",
      version: "1.0.0",
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
        package: "com.recipedost.dev",
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
        "expo-secure-store",
        "expo-localization",
        "expo-sharing",
        "expo-sqlite",
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
        telemetryEnabled: process.env.APP_ENV === "production",
        eas: {
          ...(existingExtra.eas ?? {}),
          projectId: "bf6a2714-3cdd-4ecf-98c1-9f9b8c558bf0",
        },
      },
    },
  };
};
