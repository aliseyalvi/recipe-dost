import { supabase } from '@/lib/supabase/client'

export type RecentRecipeItem = {
  id: string
  source_url: string
  platform: string | null
  title: string | null
  thumbnail_url: string | null
  metadata_status: string | null
  created_at: string
}

export async function getRecentRecipes() {
  const { data, error } = await supabase
    .from('recipe_items')
    .select('id, source_url, platform, title, thumbnail_url, metadata_status, created_at')
    .order('created_at', { ascending: false })
    .limit(3)

  if (error) {
    throw error
  }

  return data satisfies RecentRecipeItem[]
}
