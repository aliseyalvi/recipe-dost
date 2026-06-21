import * as Localization from 'expo-localization'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const resources = {
  en: {
    translation: {
      appName: 'Recipe Dost',
      welcomeTitle: 'Save recipe videos as clean recipe cards',
    },
  },
} as const

const languageCode = Localization.getLocales()[0]?.languageCode ?? 'en'

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    compatibilityJSON: 'v4',
    fallbackLng: 'en',
    lng: languageCode,
    resources,
    interpolation: {
      escapeValue: false,
    },
  })
}

export { i18n }
