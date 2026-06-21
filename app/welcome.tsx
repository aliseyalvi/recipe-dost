import { PlaceholderScreen } from '@/screens/placeholder-screen'
import { useTranslation } from 'react-i18next'

export default function WelcomeRoute() {
  const { t } = useTranslation()

  return (
    <PlaceholderScreen
      screenName="welcome"
      eyebrow={t('appName')}
      title={t('welcomeTitle')}
      description="Paste or share a recipe link, then turn it into ingredients, steps, notes, and a grocery list."
      primaryAction={{ label: 'Start onboarding', href: '/onboarding' }}
      secondaryAction={{ label: 'Go to home', href: '/home' }}
    />
  )
}
