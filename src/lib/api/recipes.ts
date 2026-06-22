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

export type GeneratedRecipeCard = {
  recipe_card_id: string
  recipe_id: string
  recipe_title: string
  confidence: 'high' | 'medium' | 'low'
}

type GenerateRecipeCardResponse =
  | {
      ok: true
      data: GeneratedRecipeCard
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
      usage?: {
        free_recipe_cards_remaining: number
        should_show_paywall: boolean
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
  name_en?: string
  name_ur?: string
  quantity: string
  notes?: string
  notes_en?: string
  notes_ur?: string
}

export type RecipeCardStep = {
  step_number: number
  instruction: string
  instruction_en?: string
  instruction_ur?: string
  tip_en?: string
  tip_ur?: string
  urdu_or_roman_urdu_tip?: string
}

export type RecipeCardSubstitution = {
  original: string
  substitute: string
  note?: string
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
  grocery_items: GroceryItem[]
  tags: string[]
  substitutions: RecipeCardSubstitution[]
  missing_info: string[]
}

type RecipeGroceryListRow = Pick<
  Database['public']['Tables']['recipe_cards']['Row'],
  | 'id'
  | 'recipe_id'
  | 'recipe_title'
  | 'grocery_list_json'
  | 'ingredients_json'
  | 'servings'
  | 'source_link'
  | 'created_at'
  | 'updated_at'
>

export type GroceryItem = {
  id: string
  label: string
  label_en?: string
  label_ur?: string
  quantity?: string
  checked: boolean
}

export type RecipeGroceryList = Omit<
  RecipeGroceryListRow,
  'grocery_list_json' | 'ingredients_json'
> & {
  grocery_items: GroceryItem[]
}

type RecipeLibraryItemRow = Pick<
  Database['public']['Tables']['recipe_items']['Row'],
  | 'id'
  | 'source_url'
  | 'platform'
  | 'title'
  | 'thumbnail_url'
  | 'metadata_status'
  | 'user_note'
  | 'pasted_caption'
  | 'manual_ingredients'
  | 'meal_type'
  | 'cuisine'
  | 'created_at'
  | 'updated_at'
>

export type RecipeLibraryCard = Pick<
  Database['public']['Tables']['recipe_cards']['Row'],
  | 'id'
  | 'recipe_id'
  | 'recipe_title'
  | 'short_summary'
  | 'confidence'
  | 'model_used'
  | 'created_at'
  | 'updated_at'
>

export type RecipeLibraryItem = RecipeLibraryItemRow & {
  latest_card: RecipeLibraryCard | null
}

export type RecipeLibraryParams = {
  limit?: number
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

export class RecipeApiError extends Error {
  code: string
  status?: number
  causeName?: string
  functionBody?: unknown

  constructor({
    code,
    message,
    status,
    causeName,
    functionBody,
  }: {
    code: string
    message: string
    status?: number
    causeName?: string
    functionBody?: unknown
  }) {
    super(message)
    this.name = 'RecipeApiError'
    this.code = code
    this.status = status
    this.causeName = causeName
    this.functionBody = functionBody
  }
}

export async function generateRecipeCard(recipeId: string) {
  const { data, error } =
    await supabase.functions.invoke<GenerateRecipeCardResponse>(
      'generate-card',
      {
        body: {
          recipe_id: recipeId,
        },
      }
  )

  if (error) {
    const functionError = await getFunctionInvokeErrorDetails(error)
    const responseError = getFunctionResponseError(functionError.functionBody)
    const code = responseError?.code ?? functionError.code

    throw new RecipeApiError({
      code,
      message: responseError?.message ?? functionError.message,
      status: functionError.status,
      causeName: functionError.name ?? undefined,
      functionBody: functionError.functionBody,
    })
  }

  if (!data) {
    throw new RecipeApiError({
      code: 'unexpected_generate_card_error',
      message: getGenerateRecipeCardErrorMessage(
        'unexpected_generate_card_error'
      ),
    })
  }

  if (!data.ok) {
    throw new RecipeApiError({
      code: data.error.code,
      message: data.error.message,
      functionBody: data,
    })
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

export async function getRecipeGroceryList(recipeCardId: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('Could not load this grocery list.')
  }

  const { data, error } = await supabase
    .from('recipe_cards')
    .select(
      'id, recipe_id, recipe_title, grocery_list_json, ingredients_json, servings, source_link, created_at, updated_at'
    )
    .eq('id', recipeCardId)
    .eq('user_id', user.id)
    .single()

  if (error) {
    throw new Error('Could not load this grocery list.')
  }

  return normalizeRecipeGroceryList(data satisfies RecipeGroceryListRow)
}

export async function getRecipeGroceryLists() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('Could not load grocery lists.')
  }

  const { data, error } = await supabase
    .from('recipe_cards')
    .select(
      'id, recipe_id, recipe_title, grocery_list_json, ingredients_json, servings, source_link, created_at, updated_at'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error('Could not load grocery lists.')
  }

  return (data satisfies RecipeGroceryListRow[])
    .map(normalizeRecipeGroceryList)
    .filter((item) => item.grocery_items.length > 0)
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

export async function getRecipeLibrary(params: RecipeLibraryParams = {}) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('Could not load your recipe library.')
  }

  let recipeItemsQuery = supabase
    .from('recipe_items')
    .select(
      'id, source_url, platform, title, thumbnail_url, metadata_status, user_note, pasted_caption, manual_ingredients, meal_type, cuisine, created_at, updated_at'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (params.limit && params.limit > 0) {
    recipeItemsQuery = recipeItemsQuery.limit(params.limit)
  }

  const { data: recipeItems, error: recipeItemsError } = await recipeItemsQuery

  if (recipeItemsError) {
    throw new Error('Could not load your recipe library.')
  }

  const items = recipeItems satisfies RecipeLibraryItemRow[]
  const recipeIds = items.map((item) => item.id)

  if (recipeIds.length === 0) {
    return []
  }

  const { data: recipeCards, error: recipeCardsError } = await supabase
    .from('recipe_cards')
    .select(
      'id, recipe_id, recipe_title, short_summary, confidence, model_used, created_at, updated_at'
    )
    .eq('user_id', user.id)
    .in('recipe_id', recipeIds)
    .order('created_at', { ascending: false })

  if (recipeCardsError) {
    throw new Error('Could not load your recipe library.')
  }

  const latestCardByRecipeId = new Map<string, RecipeLibraryCard>()

  for (const card of recipeCards satisfies RecipeLibraryCard[]) {
    if (!latestCardByRecipeId.has(card.recipe_id)) {
      latestCardByRecipeId.set(card.recipe_id, card)
    }
  }

  return items.map((item): RecipeLibraryItem => ({
    ...item,
    latest_card: latestCardByRecipeId.get(item.id) ?? null,
  }))
}

function normalizeRecipeCard(row: RecipeCardRow): RecipeCard {
  return {
    ...row,
    ingredients: getIngredients(row.ingredients_json),
    steps: getSteps(row.steps_json),
    time: getRecipeCardTime(row.time_json),
    grocery_list: getStringArray(row.grocery_list_json),
    grocery_items: getGroceryItems(row.grocery_list_json, row.ingredients_json),
    tags: getStringArray(row.tags_json),
    substitutions: getSubstitutions(row.substitutions_json),
    missing_info: getStringArray(row.missing_info_json),
  }
}

function normalizeRecipeGroceryList(row: RecipeGroceryListRow): RecipeGroceryList {
  return {
    id: row.id,
    recipe_id: row.recipe_id,
    recipe_title: row.recipe_title,
    servings: row.servings,
    source_link: row.source_link,
    created_at: row.created_at,
    updated_at: row.updated_at,
    grocery_items: getGroceryItems(row.grocery_list_json, row.ingredients_json),
  }
}

function getGroceryItems(groceryListValue: Json, ingredientsValue: Json) {
  const groceryItems = getArray(groceryListValue)
    .map((item, index) => getGroceryItemFromUnknown(item, index, 'grocery'))
    .filter((item): item is GroceryItem => Boolean(item))

  if (groceryItems.length > 0) {
    return groceryItems
  }

  return getIngredients(ingredientsValue).map((ingredient, index) => {
    const item: GroceryItem = {
      id: `ingredient-${index}`,
      label: ingredient.name,
      checked: false,
    }

    if (ingredient.name_en) {
      item.label_en = ingredient.name_en
    }
    if (ingredient.name_ur) {
      item.label_ur = ingredient.name_ur
    }
    if (ingredient.quantity) {
      item.quantity = ingredient.quantity
    }

    return item
  })
}

function getGroceryItemFromUnknown(
  value: unknown,
  index: number,
  source: string
): GroceryItem | null {
  if (typeof value === 'string') {
    const label = value.trim()

    if (!label) {
      return null
    }

    return {
      id: `${source}-${index}`,
      label,
      checked: false,
    }
  }

  const record = getRecord(value)
  const label =
    getString(record?.name_en) ||
    getString(record?.label) ||
    getString(record?.name) ||
    getString(record?.item) ||
    getString(record?.ingredient)

  if (!label) {
    return null
  }

  const quantity =
    getString(record?.quantity) ||
    getString(record?.amount) ||
    getString(record?.measure)
  const item: GroceryItem = {
    id: `${source}-${index}`,
    label,
    checked: false,
  }
  const labelEn = getString(record?.name_en) || getString(record?.label_en)
  const labelUr = getString(record?.name_ur) || getString(record?.label_ur)

  if (quantity) {
    item.quantity = quantity
  }
  if (labelEn) {
    item.label_en = labelEn
  }
  if (labelUr) {
    item.label_ur = labelUr
  }

  return item
}

function getIngredients(value: Json): RecipeCardIngredient[] {
  return getArray(value)
    .map((item) => {
      const record = getRecord(item)
      const nameEn = getString(record?.name_en)
      const nameUr = getString(record?.name_ur)
      const name = nameEn || getString(record?.name)

      if (!name) {
        return null
      }

      const ingredient: RecipeCardIngredient = {
        name,
        quantity: getString(record?.quantity) || 'estimated',
      }
      if (nameEn) {
        ingredient.name_en = nameEn
      }
      if (nameUr) {
        ingredient.name_ur = nameUr
      }

      const notesEn = getString(record?.notes_en)
      const notesUr = getString(record?.notes_ur)
      const notes = notesEn || getString(record?.notes)

      if (notes) {
        ingredient.notes = notes
      }
      if (notesEn) {
        ingredient.notes_en = notesEn
      }
      if (notesUr) {
        ingredient.notes_ur = notesUr
      }

      return ingredient
    })
    .filter((item): item is RecipeCardIngredient => Boolean(item))
}

function getSteps(value: Json): RecipeCardStep[] {
  return getArray(value)
    .map((item, index) => {
      const record = getRecord(item)
      const instructionEn = getString(record?.instruction_en)
      const instructionUr = getString(record?.instruction_ur)
      const instruction = instructionEn || getString(record?.instruction)

      if (!instruction) {
        return null
      }

      const step: RecipeCardStep = {
        step_number: getNumber(record?.step_number) ?? index + 1,
        instruction,
      }
      if (instructionEn) {
        step.instruction_en = instructionEn
      }
      if (instructionUr) {
        step.instruction_ur = instructionUr
      }

      const tipEn = getString(record?.tip_en)
      const tipUr = getString(record?.tip_ur)
      const tip = tipUr || getString(record?.urdu_or_roman_urdu_tip)

      if (tip) {
        step.urdu_or_roman_urdu_tip = tip
      }
      if (tipEn) {
        step.tip_en = tipEn
      }
      if (tipUr) {
        step.tip_ur = tipUr
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

      const note = getString(record?.note) || getString(record?.reason)

      if (note) {
        substitution.note = note
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

function getGenerateRecipeCardErrorMessage(code: string, fallback?: string) {
  switch (code) {
    case 'missing_openai_key':
      return 'AI generation is not configured yet.'
    case 'missing_gemini_key':
      return 'Gemini generation is not configured yet.'
    case 'gemini_request_failed':
      return 'Gemini could not create the recipe card right now.'
    case 'gemini_rate_limited':
      return 'Gemini is busy right now. Please try again in a few minutes.'
    case 'gemini_bad_request':
      return 'Gemini could not use this request. Please try again.'
    case 'gemini_invalid_key_or_forbidden':
      return 'Gemini generation is not allowed with the current key.'
    case 'gemini_model_not_found':
      return 'Gemini model is not available.'
    case 'openai_request_failed':
      return 'AI service could not create the recipe card right now.'
    case 'openai_rate_limited':
      return 'AI service is busy right now. Please try again in a few minutes.'
    case 'openai_insufficient_quota':
      return 'OpenAI quota is not available for this project.'
    case 'openai_invalid_api_key':
      return 'OpenAI key is invalid or unavailable.'
    case 'openai_model_forbidden':
      return 'OpenAI model is not allowed for this key.'
    case 'openai_model_not_found':
      return 'OpenAI model is not available.'
    case 'openai_bad_request':
      return 'OpenAI could not use this request. Please try again.'
    case 'missing_openrouter_key':
      return 'OpenRouter generation is not configured yet.'
    case 'openrouter_request_failed':
      return 'OpenRouter could not create the recipe card right now.'
    case 'openrouter_rate_limited':
      return 'OpenRouter is busy right now. Please try again in a few minutes.'
    case 'openrouter_bad_request':
      return 'OpenRouter could not use this request. Please try again.'
    case 'openrouter_invalid_key_or_forbidden':
      return 'OpenRouter generation is not allowed with the current key.'
    case 'openrouter_model_not_found':
      return 'OpenRouter model is not available.'
    case 'missing_kimi_key':
      return 'Kimi generation is not configured yet.'
    case 'kimi_request_failed':
      return 'Kimi could not create the recipe card right now.'
    case 'kimi_rate_limited':
      return 'Kimi is busy right now. Please try again in a few minutes.'
    case 'kimi_bad_request':
      return 'Kimi could not use this request. Please try again.'
    case 'kimi_invalid_key_or_forbidden':
      return 'Kimi generation is not allowed with the current key.'
    case 'kimi_model_not_found':
      return 'Kimi model is not available.'
    case 'missing_anthropic_key':
      return 'Anthropic generation is not configured yet.'
    case 'missing_anthropic_model':
      return 'Anthropic model is not configured yet.'
    case 'anthropic_not_implemented':
      return 'Anthropic generation is not available right now.'
    case 'unsupported_ai_provider':
      return 'AI provider is not supported.'
    case 'free_limit_reached':
      return 'You have used your free recipe cards.'
    case 'invalid_ai_output':
      return 'Recipe card could not be generated. Please add more details and try again.'
    case 'db_insert_failed':
      return 'Recipe card was created but could not be saved.'
    case 'recipe_not_found':
      return fallback || 'Recipe link not found.'
    case 'unauthorized':
      return 'Please restart the app and try again.'
    case 'invalid_request':
      return fallback || 'Choose a saved recipe link first.'
    default:
      return 'Something went wrong while creating your recipe card.'
  }
}

async function getFunctionInvokeErrorDetails(error: unknown) {
  const record = getRecord(error)
  const context = getRecord(record?.context)
  const response = getRecord(record?.response) ?? context
  const responseLike =
    getResponseLike(record?.context) ?? getResponseLike(record?.response)
  const responseBody = await getResponseBody(responseLike)
  const status =
    getNumber(record?.status) ??
    getNumber(context?.status) ??
    getNumber(response?.status) ??
    responseLike?.status ??
    undefined
  const functionBody =
    getRecord(responseBody) ??
    getRecord(record?.details) ??
    getRecord(record?.body) ??
    getRecord(context?.body) ??
    getRecord(context?.data) ??
    getRecord(response?.body) ??
    null
  const responseError = getFunctionResponseError(functionBody)
  const code =
    responseError?.code ??
    getString(record?.code) ??
    getCodeFromStatus(status) ??
    'unexpected_generate_card_error'
  const message =
    responseError?.message ??
    getString(record?.message) ??
    getGenerateRecipeCardErrorMessage(code)

  return {
    code,
    message: getGenerateRecipeCardErrorMessage(code, message),
    name: getString(record?.name),
    status,
    functionBody,
  }
}

async function getResponseBody(response: Response | null) {
  if (!response) {
    return null
  }

  try {
    return await response.clone().json()
  } catch {
    try {
      const text = await response.clone().text()
      return parseMaybeJson(text)
    } catch {
      return null
    }
  }
}

function getResponseLike(value: unknown): Response | null {
  return value instanceof Response ? value : null
}

function getFunctionResponseError(value: unknown) {
  const record = getRecord(value)
  const errorRecord = getRecord(record?.error)
  const code = getString(errorRecord?.code)
  const message = getString(errorRecord?.message)

  if (!code || !message) {
    return null
  }

  return {
    code,
    message,
  }
}

function getCodeFromStatus(status: number | undefined) {
  if (status === 401 || status === 403) {
    return 'unauthorized'
  }

  if (status === 402) {
    return 'free_limit_reached'
  }

  if (status === 429) {
    return 'openai_rate_limited'
  }

  return null
}
