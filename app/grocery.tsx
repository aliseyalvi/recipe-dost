import { PlaceholderScreen } from '@/screens/placeholder-screen'
import { EmptyState } from '@/ui/empty-state'
import { useRouter } from 'expo-router'

export default function GroceryRoute() {
  const router = useRouter()

  return (
    <PlaceholderScreen
      screenName="grocery"
      eyebrow="Cooking prep"
      title="Grocery list"
      description="Generated grocery lists will combine ingredients from selected recipe cards."
      primaryAction={{ label: 'Open library', href: '/library' }}
      secondaryAction={{ label: 'View paywall', href: '/paywall' }}
    >
      <EmptyState
        title="No grocery list yet"
        message="Create one later from saved recipe cards. Export and advanced limits stay behind Pro."
        actionLabel="Browse library"
        onActionPress={() => router.push('/library')}
      />
    </PlaceholderScreen>
  )
}
