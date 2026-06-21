import { PlaceholderScreen } from '@/screens/placeholder-screen'
import { Button } from '@/ui/button'
import { ErrorState } from '@/ui/error-state'
import { Input } from '@/ui/input'
import { LoadingState } from '@/ui/loading-state'
import { TextArea } from '@/ui/text-area'
import { useState } from 'react'

export default function SaveRecipeRoute() {
  const [sourceUrl, setSourceUrl] = useState('')
  const [note, setNote] = useState('')

  return (
    <PlaceholderScreen
      screenName="save_recipe"
      eyebrow="Save link"
      title="Paste a recipe video URL"
      description="M1 only captures the shape of the flow. Metadata parsing and AI recipe cards will go through Supabase Edge Functions later."
      primaryAction={{ label: 'Back home', href: '/home' }}
      secondaryAction={{ label: 'View library', href: '/library' }}
    >
      <Input
        autoCapitalize="none"
        autoCorrect={false}
        label="Recipe URL"
        onChangeText={setSourceUrl}
        placeholder="https://..."
        value={sourceUrl}
      />
      <TextArea
        label="Optional note"
        onChangeText={setNote}
        placeholder="What should Recipe Dost remember?"
        value={note}
      />
      <Button label="Preview recipe" disabled fullWidth />
      <LoadingState message="Metadata loading state placeholder" />
      <ErrorState message="Metadata error state placeholder for retryable failures." />
    </PlaceholderScreen>
  )
}
