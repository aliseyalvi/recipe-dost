import { PlaceholderScreen } from '@/screens/placeholder-screen'

export default function SaveRecipeRoute() {
  return (
    <PlaceholderScreen
      screenName="save_recipe"
      eyebrow="Coming next"
      title="Save Link flow is coming next."
      description="This will be built in M5."
      primaryAction={{ label: 'Back home', href: '/home' }}
      secondaryAction={{ label: 'View library', href: '/library' }}
    />
  )
}
