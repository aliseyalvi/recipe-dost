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
  author_username: string | null
  duration_seconds: number | null
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

type SaveRecipeLinkResponse =
  | {
      ok: true
      data: {
        recipe_item: SavedRecipeItem
      }
    }
  | {
      ok: false
      error: {
        code: string
        message: string
      }
    }

type RefreshRecipeMetadataResponse =
  | {
      ok: true
      data: {
        metadata_status: string
        recipe_item_id: string
        worker_status: number | null
        error_code: string | null
        title_present: boolean
        thumbnail_present: boolean
        duration_seconds: number | null
      }
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
  source_mode?: AiSourceMode
  model_used?: string
  missing_info?: string[]
}

export type AiSourceMode =
  | 'text_only'
  | 'youtube_url'
  | 'uploaded_video'
  | 'unsupported_video_link'

export type MediaJobStatus =
  | 'queued'
  | 'resolving'
  | 'downloading'
  | 'validating'
  | 'thumbnailing'
  | 'uploading_to_ai'
  | 'analyzing'
  | 'saving_result'
  | 'completed'
  | 'failed'
  | 'needs_caption'

export type MediaJobSourceMetadata = {
  title?: string
  description?: string
  platform?: string
  resolver?: string
  author_username?: string
  duration_seconds?: number
  uploaded_thumbnail_url?: string
  media?: {
    mime_type?: string
    size_bytes?: number
    has_cdn_url?: boolean
    cdn_url_stored_private?: boolean
  }
}

type MediaJobRow = Pick<
  Database['public']['Tables']['media_jobs']['Row'],
  | 'id'
  | 'recipe_item_id'
  | 'platform'
  | 'ai_provider'
  | 'status'
  | 'source_mode'
  | 'source_metadata'
  | 'progress'
  | 'error_code'
  | 'error_message'
  | 'thumbnail_url'
  | 'result_recipe_card_id'
  | 'created_at'
  | 'updated_at'
>

export type MediaJob = Omit<MediaJobRow, 'status' | 'source_metadata'> & {
  status: MediaJobStatus
  source_metadata: MediaJobSourceMetadata
}

type CreateMediaJobResponse =
  | {
      ok: true
      data: {
        media_job_id: string
        status: MediaJobStatus
        progress: number
        worker_triggered: boolean
        processor_mode: 'worker' | 'queue' | 'manual' | 'disabled'
      }
    }
  | {
      ok: false
      error: {
        code: string
        message: string
      }
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
  | 'duration_seconds'
  | 'user_note'
  | 'pasted_caption'
  | 'manual_ingredients'
  | 'meal_type'
  | 'cuisine'
  | 'metadata_status'
  | 'source_metadata'
  | 'created_at'
  | 'updated_at'
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
  source_mode?: AiSourceMode
  recipe_title_en?: string
  recipe_title_ur?: string
  short_summary_en?: string
  short_summary_ur?: string
  storage_tip_en?: string
  storage_tip_ur?: string
  safety_note_en?: string
  safety_note_ur?: string
  ingredients: RecipeCardIngredient[]
  steps: RecipeCardStep[]
  time: RecipeCardTime
  grocery_list: string[]
  grocery_items: GroceryItem[]
  tags: string[]
  substitutions: RecipeCardSubstitution[]
  missing_info: string[]
  missing_info_en: string[]
  missing_info_ur: string[]
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
  latest_media_job: MediaJob | null
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

export async function saveRecipeLink(url: string) {
  const { data, error } =
    await supabase.functions.invoke<SaveRecipeLinkResponse>(
      'save-recipe-link',
      {
        body: {
          url,
        },
      }
    )

  if (error) {
    const functionError = await getFunctionInvokeErrorDetails(error)
    const responseError = getFunctionResponseError(functionError.functionBody)

    throw new RecipeApiError({
      code: responseError?.code ?? functionError.code,
      message:
        responseError?.message ??
        'Could not save this recipe link. Please try again.',
      status: functionError.status,
      causeName: functionError.name ?? undefined,
      functionBody: functionError.functionBody,
    })
  }

  if (!data) {
    throw new RecipeApiError({
      code: 'unexpected_save_recipe_link_error',
      message: 'Could not save this recipe link. Please try again.',
    })
  }

  if (!data.ok) {
    throw new RecipeApiError({
      code: data.error.code,
      message: data.error.message,
      functionBody: data,
    })
  }

  return data.data.recipe_item
}

export async function refreshRecipeMetadata(recipeItemId: string) {
  const { data, error } =
    await supabase.functions.invoke<RefreshRecipeMetadataResponse>(
      'refresh-recipe-metadata',
      {
        body: {
          recipe_item_id: recipeItemId,
        },
      }
    )

  if (error) {
    const functionError = await getFunctionInvokeErrorDetails(error)
    const responseError = getFunctionResponseError(functionError.functionBody)

    throw new RecipeApiError({
      code: responseError?.code ?? functionError.code,
      message:
        responseError?.message ??
        'Could not refresh recipe metadata. Please try again.',
      status: functionError.status,
      causeName: functionError.name ?? undefined,
      functionBody: functionError.functionBody,
    })
  }

  if (!data) {
    throw new RecipeApiError({
      code: 'unexpected_metadata_refresh_error',
      message: 'Could not refresh recipe metadata. Please try again.',
    })
  }

  if (!data.ok) {
    throw new RecipeApiError({
      code: data.error.code,
      message: data.error.message,
      functionBody: data,
    })
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

export async function createMediaJob({
  recipeItemId,
  sourceUrl,
  platform,
}: {
  recipeItemId?: string
  sourceUrl?: string
  platform?: RecipePlatform
}) {
  const { data, error } =
    await supabase.functions.invoke<CreateMediaJobResponse>(
      'create-media-job',
      {
        body: {
          recipe_item_id: recipeItemId,
          source_url: sourceUrl,
          platform,
        },
      }
    )

  if (error) {
    const functionError = await getFunctionInvokeErrorDetails(error)
    const responseError = getFunctionResponseError(functionError.functionBody)

    throw new RecipeApiError({
      code: responseError?.code ?? functionError.code,
      message:
        responseError?.message ??
        'Could not start AI recipe. Please try again.',
      status: functionError.status,
      causeName: functionError.name ?? undefined,
      functionBody: functionError.functionBody,
    })
  }

  if (!data) {
    throw new RecipeApiError({
      code: 'unexpected_media_job_error',
      message: 'Could not start AI recipe. Please try again.',
    })
  }

  if (!data.ok) {
    throw new RecipeApiError({
      code: data.error.code,
      message: data.error.message,
      functionBody: data,
    })
  }

  return data.data
}

export async function getMediaJob(mediaJobId: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('Could not load AI recipe status.')
  }

  const { data, error } = await supabase
    .from('media_jobs')
    .select(MEDIA_JOB_SELECT)
    .eq('id', mediaJobId)
    .eq('user_id', user.id)
    .single()

  if (error) {
    throw new Error('Could not load AI recipe status.')
  }

  return normalizeMediaJob(data satisfies MediaJobRow)
}

export async function getLatestMediaJobForRecipe(recipeItemId: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('Could not load AI recipe status.')
  }

  const { data, error } = await supabase
    .from('media_jobs')
    .select(MEDIA_JOB_SELECT)
    .eq('recipe_item_id', recipeItemId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error('Could not load AI recipe status.')
  }

  return data ? normalizeMediaJob(data satisfies MediaJobRow) : null
}

export async function updateSavedRecipeCaption({
  recipeItemId,
  pastedCaption,
}: {
  recipeItemId: string
  pastedCaption: string
}) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('Could not save the recipe caption.')
  }

  const { error } = await supabase
    .from('recipe_items')
    .update({
      pasted_caption: pastedCaption.trim(),
    })
    .eq('id', recipeItemId)
    .eq('user_id', user.id)

  if (error) {
    throw new Error('Could not save the recipe caption.')
  }
}

export function isMediaJobActive(job: MediaJob | null | undefined) {
  if (job?.status === 'completed' && !job.result_recipe_card_id) {
    return true
  }

  return Boolean(
    job &&
      job.status !== 'completed' &&
      job.status !== 'failed' &&
      job.status !== 'needs_caption'
  )
}

export function isMediaJobAttentionRequired(job: MediaJob | null | undefined) {
  return job?.status === 'failed' || job?.status === 'needs_caption'
}

export async function saveRecipeItem({
  draft,
  userId,
}: {
  draft: RecipeLinkDraft
  userId: string
}) {
  const savedItem = await saveRecipeLink(draft.source_url)
  const updateFields = {
    user_note: draft.user_note?.trim() || null,
    pasted_caption: draft.pasted_caption?.trim() || null,
    manual_ingredients: draft.manual_ingredients?.trim() || null,
    meal_type: draft.meal_type ?? null,
    cuisine: draft.cuisine?.trim() || null,
  }

  if (
    !updateFields.user_note &&
    !updateFields.pasted_caption &&
    !updateFields.manual_ingredients &&
    !updateFields.meal_type &&
    !updateFields.cuisine
  ) {
    return savedItem
  }

  const { data, error } = await supabase
    .from('recipe_items')
    .update(updateFields)
    .eq('id', savedItem.id)
    .eq('user_id', userId)
    .select(
      'id, source_url, platform, title, description, thumbnail_url, duration_seconds, user_note, pasted_caption, manual_ingredients, meal_type, cuisine, metadata_status, source_metadata, created_at, updated_at'
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
      'id, source_url, platform, title, description, thumbnail_url, duration_seconds, user_note, pasted_caption, manual_ingredients, meal_type, cuisine, metadata_status, source_metadata, created_at, updated_at'
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

  const { data: mediaJobs } = await supabase
    .from('media_jobs')
    .select(MEDIA_JOB_SELECT)
    .eq('user_id', user.id)
    .in('recipe_item_id', recipeIds)
    .order('created_at', { ascending: false })

  // Read jobs first so a newly published result_recipe_card_id is followed by
  // a fresh recipe_cards query instead of leaving a completed job without its card.
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
  const latestJobByRecipeId = new Map<string, MediaJob>()

  for (const card of recipeCards satisfies RecipeLibraryCard[]) {
    if (!latestCardByRecipeId.has(card.recipe_id)) {
      latestCardByRecipeId.set(card.recipe_id, card)
    }
  }

  for (const row of (mediaJobs ?? []) as MediaJobRow[]) {
    if (row.recipe_item_id && !latestJobByRecipeId.has(row.recipe_item_id)) {
      latestJobByRecipeId.set(row.recipe_item_id, normalizeMediaJob(row))
    }
  }

  return items.map((item): RecipeLibraryItem => ({
    ...item,
    latest_card: latestCardByRecipeId.get(item.id) ?? null,
    latest_media_job: latestJobByRecipeId.get(item.id) ?? null,
  }))
}

const MEDIA_JOB_SELECT =
  'id, recipe_item_id, platform, ai_provider, status, source_mode, source_metadata, progress, error_code, error_message, thumbnail_url, result_recipe_card_id, created_at, updated_at'

function normalizeMediaJob(row: MediaJobRow): MediaJob {
  return {
    ...row,
    status: getMediaJobStatus(row.status),
    source_metadata: normalizeMediaJobSourceMetadata(row.source_metadata),
    progress: Math.min(100, Math.max(0, row.progress)),
  }
}

function normalizeMediaJobSourceMetadata(
  value: Json
): MediaJobSourceMetadata {
  if (!isRecord(value)) {
    return {}
  }

  const media = isRecord(value.media)
    ? {
        mime_type: getStringValue(value.media.mime_type),
        size_bytes: getNumberValue(value.media.size_bytes),
        has_cdn_url: getBooleanValue(value.media.has_cdn_url),
        cdn_url_stored_private: getBooleanValue(
          value.media.cdn_url_stored_private
        ),
      }
    : undefined

  return {
    title: getStringValue(value.title),
    description: getStringValue(value.description),
    platform: getStringValue(value.platform),
    resolver: getStringValue(value.resolver),
    author_username: getStringValue(
      value.author_username ?? value.authorUsername ?? value.author
    ),
    duration_seconds: getNumberValue(value.duration_seconds),
    uploaded_thumbnail_url: getStringValue(value.uploaded_thumbnail_url),
    media,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function getStringValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined
}

function getNumberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined
}

function getBooleanValue(value: unknown) {
  return typeof value === 'boolean' ? value : undefined
}

function getMediaJobStatus(value: string): MediaJobStatus {
  if (
    value === 'queued' ||
    value === 'resolving' ||
    value === 'downloading' ||
    value === 'validating' ||
    value === 'thumbnailing' ||
    value === 'uploading_to_ai' ||
    value === 'analyzing' ||
    value === 'saving_result' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'needs_caption'
  ) {
    return value
  }

  return 'failed'
}

function normalizeRecipeCard(row: RecipeCardRow): RecipeCard {
  const localizedMeta = getLocalizedRecipeMeta(row.missing_info_json)

  return {
    ...row,
    source_mode: localizedMeta.source_mode,
    recipe_title_en: localizedMeta.recipe_title_en ?? row.recipe_title ?? undefined,
    recipe_title_ur: localizedMeta.recipe_title_ur ?? undefined,
    short_summary_en: localizedMeta.short_summary_en ?? row.short_summary ?? undefined,
    short_summary_ur: localizedMeta.short_summary_ur ?? undefined,
    storage_tip_en: localizedMeta.storage_tip_en ?? row.storage_tip ?? undefined,
    storage_tip_ur: localizedMeta.storage_tip_ur ?? undefined,
    safety_note_en: localizedMeta.safety_note_en ?? row.safety_note ?? undefined,
    safety_note_ur: localizedMeta.safety_note_ur ?? undefined,
    ingredients: getIngredients(row.ingredients_json),
    steps: getSteps(row.steps_json),
    time: getRecipeCardTime(row.time_json),
    grocery_list: getStringArray(row.grocery_list_json),
    grocery_items: getGroceryItems(row.grocery_list_json, row.ingredients_json),
    tags: getStringArray(row.tags_json),
    substitutions: getSubstitutions(row.substitutions_json),
    missing_info: localizedMeta.missing_info_en,
    missing_info_en: localizedMeta.missing_info_en,
    missing_info_ur: localizedMeta.missing_info_ur,
  }
}

function getLocalizedRecipeMeta(value: Json) {
  const record = getRecord(value)
  const legacyMissingInfo = getStringArray(value)
  const missingInfoEn = firstNonEmptyArray(
    getStringArray(record?.missing_info_en),
    getStringArray(record?.missing_info),
    legacyMissingInfo
  )
  const missingInfoUr = getStringArray(record?.missing_info_ur)

  return {
    source_mode: getAiSourceMode(record?.source_mode),
    recipe_title_en: getString(record?.recipe_title_en),
    recipe_title_ur: getString(record?.recipe_title_ur),
    short_summary_en: getString(record?.short_summary_en),
    short_summary_ur: getString(record?.short_summary_ur),
    storage_tip_en: getString(record?.storage_tip_en),
    storage_tip_ur: getString(record?.storage_tip_ur),
    safety_note_en: getString(record?.safety_note_en),
    safety_note_ur: getString(record?.safety_note_ur),
    missing_info_en: missingInfoEn,
    missing_info_ur: missingInfoUr,
  }
}

function getAiSourceMode(value: unknown): AiSourceMode | undefined {
  const sourceMode = getString(value)

  if (
    sourceMode === 'text_only' ||
    sourceMode === 'youtube_url' ||
    sourceMode === 'uploaded_video' ||
    sourceMode === 'unsupported_video_link'
  ) {
    return sourceMode
  }

  return undefined
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
  const labelUr = getString(record?.name_ur) || getString(record?.label_ur)
  const label =
    getString(record?.name_en) ||
    getString(record?.label_en) ||
    getString(record?.label) ||
    getString(record?.name) ||
    getString(record?.item) ||
    getString(record?.ingredient) ||
    labelUr

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
      const name = nameEn || getString(record?.name) || nameUr

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
      const notes = notesEn || getString(record?.notes) || notesUr

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
      const instruction =
        instructionEn ||
        getString(record?.instruction) ||
        getString(record?.step) ||
        instructionUr

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
      const tip = getString(record?.urdu_or_roman_urdu_tip) || tipUr

      if (tip) {
        step.urdu_or_roman_urdu_tip = tip
      }
      if (tipEn) {
        step.tip_en = tipEn
      }
      if (tipUr && hasUrduScript(tipUr)) {
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

function firstNonEmptyArray(...values: string[][]) {
  return values.find((value) => value.length > 0) ?? []
}

function getStringArray(value: unknown): string[] {
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

function hasUrduScript(value: string | null | undefined) {
  return Boolean(value && /[\u0600-\u06ff]/.test(value))
}

function getArray(value: unknown): unknown[] {
  const parsedValue = parseMaybeJson(value)

  if (Array.isArray(parsedValue)) {
    return parsedValue
  }

  if (typeof parsedValue === 'object' && parsedValue !== null) {
    const record = parsedValue as Record<string, unknown>
    const nestedArray =
      record.items ??
      record.ingredients ??
      record.steps ??
      record.grocery_list ??
      record.grocery_items ??
      record.missing_info

    return Array.isArray(nestedArray) ? nestedArray : []
  }

  return []
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
  if (typeof value !== 'string') {
    return null
  }

  const text = cleanRecipeDisplayText(value)

  return text.length > 0 ? text : null
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value)

    return Number.isFinite(parsedValue) ? parsedValue : null
  }

  return null
}

function cleanRecipeDisplayText(value: string) {
  return value
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
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
