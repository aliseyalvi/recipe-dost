module.exports = {
  expo: {
    name: 'recipe-dost',
    slug: 'recipe-dost',
    scheme: 'recipe-dost',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      intentFilters: [
        {
          action: 'SEND',
          category: ['DEFAULT'],
          data: [{ mimeType: 'text/plain' }, { mimeType: 'text/*' }],
        },
      ],
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-localization',
      'expo-sharing',
      'expo-sqlite',
    ],
    extra: {
      telemetryEnabled: process.env.APP_ENV === 'production',
    },
  },
}
