import { getUsageLimits, UsageLimits } from '@/features/usage/limits'
import { supabase } from '@/lib/supabase/client'
import { Json } from '@/types/supabase'

export type UsageSummary = {
  limits: UsageLimits
  savedLinksUsed: number
  recipeCardsUsed: number
  groceryListsUsed: number
  savedLinksRemaining: number
  recipeCardsRemaining: number
  groceryListsRemaining: number
  canSaveLink: boolean
  canGenerateRecipeCard: boolean
  canOpenGroceryList: boolean
}

type GroceryListCountRow = {
  grocery_list_json: Json
}

export async function getUsageSummary(): Promise<UsageSummary> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('Could not load free plan usage.')
  }

  const limits = getUsageLimits()
  const [
    savedLinksCountResult,
    recipeCardsCountResult,
    groceryListRowsResult,
  ] = await Promise.all([
    supabase
      .from('recipe_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('recipe_cards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('recipe_cards')
      .select('grocery_list_json')
      .eq('user_id', user.id)
      .not('grocery_list_json', 'is', null),
  ])

  if (
    savedLinksCountResult.error ||
    recipeCardsCountResult.error ||
    groceryListRowsResult.error
  ) {
    throw new Error('Could not load free plan usage.')
  }

  const savedLinksUsed = savedLinksCountResult.count ?? 0
  const recipeCardsUsed = recipeCardsCountResult.count ?? 0
  const groceryListsUsed = (
    (groceryListRowsResult.data ?? []) satisfies GroceryListCountRow[]
  ).filter((row) => hasGroceryListItems(row.grocery_list_json)).length

  return buildUsageSummary({
    limits,
    savedLinksUsed,
    recipeCardsUsed,
    groceryListsUsed,
  })
}

function buildUsageSummary({
  limits,
  savedLinksUsed,
  recipeCardsUsed,
  groceryListsUsed,
}: {
  limits: UsageLimits
  savedLinksUsed: number
  recipeCardsUsed: number
  groceryListsUsed: number
}) {
  const savedLinksRemaining = Math.max(0, limits.savedLinks - savedLinksUsed)
  const recipeCardsRemaining = Math.max(
    0,
    limits.recipeCards - recipeCardsUsed
  )
  const groceryListsRemaining = Math.max(
    0,
    limits.groceryLists - groceryListsUsed
  )

  return {
    limits,
    savedLinksUsed,
    recipeCardsUsed,
    groceryListsUsed,
    savedLinksRemaining,
    recipeCardsRemaining,
    groceryListsRemaining,
    canSaveLink: savedLinksRemaining > 0,
    canGenerateRecipeCard: recipeCardsRemaining > 0,
    canOpenGroceryList: groceryListsRemaining > 0,
  }
}

function hasGroceryListItems(value: Json) {
  const parsedValue = parseMaybeJson(value)

  if (!Array.isArray(parsedValue)) {
    return false
  }

  return parsedValue.some((item) => {
    if (typeof item === 'string') {
      return item.trim().length > 0
    }

    if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
      return Object.values(item).some(
        (nestedValue) =>
          typeof nestedValue === 'string' && nestedValue.trim().length > 0
      )
    }

    return false
  })
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
