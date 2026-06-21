import { PlaceholderScreen } from '@/screens/placeholder-screen'
import { EmptyState } from '@/ui/empty-state'
import { useRouter } from 'expo-router'

export default function HomeRoute() {
  const router = useRouter()

  return (
    <PlaceholderScreen
      screenName="home"
      eyebrow="Today"
      title="Your recipe workspace"
      description="Recent recipe cards and quick actions will live here after the save flow is connected."
      primaryAction={{ label: 'Save a recipe link', href: '/save-recipe' }}
      secondaryAction={{ label: 'Open library', href: '/library' }}
    >
      <EmptyState
        title="No saved recipes yet"
        message="Start with a link from Instagram, TikTok, YouTube Shorts, or another public recipe source."
        actionLabel="Add first link"
        onActionPress={() => router.push('/save-recipe')}
      />
    </PlaceholderScreen>
  )
}
