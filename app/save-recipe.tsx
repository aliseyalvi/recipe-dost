import { LoadingState } from '@/ui/loading-state'
import { Screen } from '@/ui/screen'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'

export default function SaveRecipeRoute() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/home')
  }, [router])

  return (
    <Screen>
      <LoadingState message="Opening Home..." />
    </Screen>
  )
}
