import {
  RecipeLinkDraft,
  RecipeMetadataStatus,
  RecipePlatform,
} from '@/features/recipe-draft/types'
import { supabase } from '@/lib/supabase/client'
import { Database, Json } from '@/types/supabase'

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

export type GeneratedMockRecipeCard = {
  recipe_card_id: string
  recipe_id: string
  recipe_title: string
  confidence: 'low'
}

type GenerateMockRecipeCardResponse =
  | {
      ok: true
      data: GeneratedMockRecipeCard
      usage: {
        free_recipe_cards_remaining: number
        should_show_paywall: boolean
      }
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

type RecipeCardRow = Pick<
  Database['public']['Tables']['recipe_cards']['Row'],
  | 'id'
  | 'recipe_id'
  | 'user_id'
  | 'recipe_title'
  | 'short_summary'
  | 'ingredients_json'
  | 'steps_json'
  | 'time_json'
  | 'servings'
  | 'difficulty'
  | 'grocery_list_json'
  | 'tags_json'
  | 'substitutions_json'
  | 'storage_tip'
  | 'safety_note'
  | 'confidence'
  | 'missing_info_json'
  | 'source_link'
  | 'model_used'
  | 'prompt_version'
  | 'created_at'
  | 'updated_at'
>

export type RecipeCardIngredient = {
  name: string
  quantity: string
  notes?: string
}

export type RecipeCardStep = {
  step_number: number
  instruction: string
  urdu_or_roman_urdu_tip?: string
}

export type RecipeCardSubstitution = {
  original: string
  substitute: string
  reason?: string
}

export type RecipeCardTime = {
  prep_time_minutes: number | null
  cook_time_minutes: number | null
}

export type RecipeCard = Omit<
  RecipeCardRow,
  | 'ingredients_json'
  | 'steps_json'
  | 'time_json'
  | 'grocery_list_json'
  | 'tags_json'
  | 'substitutions_json'
  | 'missing_info_json'
> & {
  ingredients: RecipeCardIngredient[]
  steps: RecipeCardStep[]
  time: RecipeCardTime
  grocery_list: string[]
  tags: string[]
  substitutions: RecipeCardSubstitution[]
  missing_info: string[]
}

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

export async function generateMockRecipeCard(recipeId: string) {
  const { data, error } =
    await supabase.functions.invoke<GenerateMockRecipeCardResponse>(
      'generate-card',
      {
        body: {
          recipe_id: recipeId,
        },
      }
    )

  if (error) {
    throw new Error('Could not generate the mock recipe card. Please try again.')
  }

  if (!data) {
    throw new Error('Could not generate the mock recipe card. Please try again.')
  }

  if (!data.ok) {
    throw new Error(data.error.message)
  }

  return data
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

export async function getRecipeCard(recipeCardId: string) {
  const { data, error } = await supabase
    .from('recipe_cards')
    .select(
      'id, recipe_id, user_id, recipe_title, short_summary, ingredients_json, steps_json, time_json, servings, difficulty, grocery_list_json, tags_json, substitutions_json, storage_tip, safety_note, confidence, missing_info_json, source_link, model_used, prompt_version, created_at, updated_at'
    )
    .eq('id', recipeCardId)
    .single()

  if (error) {
    throw new Error('Could not load this recipe card.')
  }

  return normalizeRecipeCard(data satisfies RecipeCardRow)
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

function normalizeRecipeCard(row: RecipeCardRow): RecipeCard {
  return {
    ...row,
    ingredients: getIngredients(row.ingredients_json),
    steps: getSteps(row.steps_json),
    time: getRecipeCardTime(row.time_json),
    grocery_list: getStringArray(row.grocery_list_json),
    tags: getStringArray(row.tags_json),
    substitutions: getSubstitutions(row.substitutions_json),
    missing_info: getStringArray(row.missing_info_json),
  }
}

function getIngredients(value: Json): RecipeCardIngredient[] {
  return getArray(value)
    .map((item) => {
      const record = getRecord(item)
      const name = getString(record?.name)

      if (!name) {
        return null
      }

      const ingredient: RecipeCardIngredient = {
        name,
        quantity: getString(record?.quantity) || 'estimated',
      }

      const notes = getString(record?.notes)

      if (notes) {
        ingredient.notes = notes
      }

      return ingredient
    })
    .filter((item): item is RecipeCardIngredient => Boolean(item))
}

function getSteps(value: Json): RecipeCardStep[] {
  return getArray(value)
    .map((item, index) => {
      const record = getRecord(item)
      const instruction = getString(record?.instruction)

      if (!instruction) {
        return null
      }

      const step: RecipeCardStep = {
        step_number: getNumber(record?.step_number) ?? index + 1,
        instruction,
      }

      const tip = getString(record?.urdu_or_roman_urdu_tip)

      if (tip) {
        step.urdu_or_roman_urdu_tip = tip
      }

      return step
    })
    .filter((item): item is RecipeCardStep => Boolean(item))
}

function getSubstitutions(value: Json): RecipeCardSubstitution[] {
  return getArray(value)
    .map((item) => {
      const record = getRecord(item)
      const original = getString(record?.original)
      const substitute = getString(record?.substitute)

      if (!original || !substitute) {
        return null
      }

      const substitution: RecipeCardSubstitution = {
        original,
        substitute,
      }

      const reason = getString(record?.reason)

      if (reason) {
        substitution.reason = reason
      }

      return substitution
    })
    .filter((item): item is RecipeCardSubstitution => Boolean(item))
}

function getRecipeCardTime(value: Json): RecipeCardTime {
  const record = getRecord(value)

  return {
    prep_time_minutes: getNumber(record?.prep_time_minutes),
    cook_time_minutes: getNumber(record?.cook_time_minutes),
  }
}

function getStringArray(value: Json): string[] {
  return getArray(value)
    .map((item) => {
      if (typeof item === 'string') {
        return item.trim()
      }

      const record = getRecord(item)
      return getString(record?.name) || getString(record?.label)
    })
    .filter((item): item is string => Boolean(item))
}

function getArray(value: Json | undefined): unknown[] {
  const parsedValue = parseMaybeJson(value)

  return Array.isArray(parsedValue) ? parsedValue : []
}

function getRecord(value: unknown): Record<string, unknown> | null {
  const parsedValue = parseMaybeJson(value)

  if (
    typeof parsedValue === 'object' &&
    parsedValue !== null &&
    !Array.isArray(parsedValue)
  ) {
    return parsedValue as Record<string, unknown>
  }

  return null
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null
}

function getNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
