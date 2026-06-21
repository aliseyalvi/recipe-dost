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

export type RecipeLinkDraft = {
  source_url: string
  platform: RecipePlatform
  user_note?: string
  pasted_caption?: string
  manual_ingredients?: string
  meal_type?: RecipeMealType
  cuisine?: string
  created_at: string
}
