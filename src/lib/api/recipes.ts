import {
  RecipeLinkDraft,
  RecipeMetadataStatus,
  RecipePlatform,
} from '@/features/recipe-draft/types'
import { supabase } from '@/lib/supabase/client'
import { Database } from '@/types/supabase'

export type ParsedRecipeUrl = {
  platform: RecipePlatform
  title: string | null
  description: string | null
  thumbnail_url: string | null
  metadata_status: RecipeMetadataStatus
  requires_manual_caption: boolean
  source_url: string
  normalized_url: string
  host: string
}

type ParseRecipeUrlResponse =
  | {
      ok: true
      data: ParsedRecipeUrl
    }
  | {
      ok: false
      error: {
        code: string
        message: string
      }
    }

export type SavedRecipeItem = Pick<
  Database['public']['Tables']['recipe_items']['Row'],
  | 'id'
  | 'source_url'
  | 'platform'
  | 'title'
  | 'description'
  | 'thumbnail_url'
  | 'user_note'
  | 'pasted_caption'
  | 'manual_ingredients'
  | 'meal_type'
  | 'cuisine'
  | 'metadata_status'
  | 'created_at'
>

export async function parseRecipeUrl(sourceUrl: string) {
  const { data, error } =
    await supabase.functions.invoke<ParseRecipeUrlResponse>('parse-url', {
      body: {
        source_url: sourceUrl,
      },
    })

  if (error) {
    throw new Error('Could not check this recipe link. Please try again.')
  }

  if (!data) {
    throw new Error('Could not check this recipe link. Please try again.')
  }

  if (!data.ok) {
    throw new Error(data.error.message)
  }

  return data.data
}

export async function saveRecipeItem({
  draft,
  userId,
}: {
  draft: RecipeLinkDraft
  userId: string
}) {
  const { data, error } = await supabase
    .from('recipe_items')
    .insert({
      user_id: userId,
      source_url: draft.source_url,
      platform: draft.platform,
      title: draft.title ?? null,
      description: draft.description ?? null,
      thumbnail_url: draft.thumbnail_url ?? null,
      user_note: draft.user_note ?? null,
      pasted_caption: draft.pasted_caption ?? null,
      manual_ingredients: draft.manual_ingredients ?? null,
      meal_type: draft.meal_type ?? null,
      cuisine: draft.cuisine ?? null,
      metadata_status: draft.metadata_status ?? 'failed',
    })
    .select(
      'id, source_url, platform, title, description, thumbnail_url, user_note, pasted_caption, manual_ingredients, meal_type, cuisine, metadata_status, created_at'
    )
    .single()

  if (error) {
    throw new Error('Could not save this recipe link. Please try again.')
  }

  return data satisfies SavedRecipeItem
}

export async function getSavedRecipeItem(recipeId: string) {
  const { data, error } = await supabase
    .from('recipe_items')
    .select(
      'id, source_url, platform, title, description, thumbnail_url, user_note, pasted_caption, manual_ingredients, meal_type, cuisine, metadata_status, created_at'
    )
    .eq('id', recipeId)
    .single()

  if (error) {
    throw new Error('Could not load this saved recipe link.')
  }

  return data satisfies SavedRecipeItem
}
