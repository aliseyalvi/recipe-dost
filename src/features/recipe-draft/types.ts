export type RecipePlatform =
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'facebook'
  | 'other'

export type RecipeMealType =
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'snack'
  | 'dessert'
  | 'iftar'
  | 'other'

export type RecipeMetadataStatus = 'success' | 'partial' | 'failed'

export type RecipeLinkDraft = {
  source_url: string
  normalized_url?: string
  host?: string
  platform: RecipePlatform
  title?: string | null
  description?: string | null
  thumbnail_url?: string | null
  author_username?: string | null
  duration_seconds?: number | null
  metadata_status?: RecipeMetadataStatus
  requires_manual_caption?: boolean
  user_note?: string
  pasted_caption?: string
  manual_ingredients?: string
  meal_type?: RecipeMealType
  cuisine?: string
  created_at: string
}
