import { PlaceholderScreen } from '@/screens/placeholder-screen'
import { EmptyState } from '@/ui/empty-state'
import { useRouter } from 'expo-router'

export default function LibraryRoute() {
  const router = useRouter()

  return (
    <PlaceholderScreen
      screenName="library"
      eyebrow="Library"
      title="Saved links and recipe cards"
      description="Search, collections, tags, meal type, and platform filters will be added after core data is connected."
      primaryAction={{ label: 'Save recipe', href: '/save-recipe' }}
      secondaryAction={{ label: 'Open grocery list', href: '/grocery' }}
    >
      <EmptyState
        title="Library is empty"
        message="Saved recipe links and generated cards will appear here."
        actionLabel="Save a link"
        onActionPress={() => router.push('/save-recipe')}
      />
    </PlaceholderScreen>
  )
}
