import { supabase } from '@/lib/supabase/client'
import { Json } from '@/types/supabase'

export type UsageSummary = {
  savedLinksUsed: number
  recipeCardsUsed: number
  groceryListsUsed: number
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
    savedLinksUsed,
    recipeCardsUsed,
    groceryListsUsed,
  })
}

function buildUsageSummary({
  savedLinksUsed,
  recipeCardsUsed,
  groceryListsUsed,
}: {
  savedLinksUsed: number
  recipeCardsUsed: number
  groceryListsUsed: number
}) {
  return {
    savedLinksUsed,
    recipeCardsUsed,
    groceryListsUsed,
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
