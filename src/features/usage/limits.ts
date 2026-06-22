export type UsageLimits = {
  savedLinks: number
  recipeCards: number
  groceryLists: number
}

const defaultUsageLimits: UsageLimits = {
  savedLinks: 20,
  recipeCards: 3,
  groceryLists: 3,
}

export function getUsageLimits(): UsageLimits {
  return {
    savedLinks: getPositiveLimit(
      process.env.EXPO_PUBLIC_FREE_SAVED_LINK_LIMIT,
      defaultUsageLimits.savedLinks
    ),
    recipeCards: getPositiveLimit(
      process.env.EXPO_PUBLIC_FREE_RECIPE_CARD_LIMIT,
      defaultUsageLimits.recipeCards
    ),
    groceryLists: getPositiveLimit(
      process.env.EXPO_PUBLIC_FREE_GROCERY_LIST_LIMIT,
      defaultUsageLimits.groceryLists
    ),
  }
}

function getPositiveLimit(value: string | undefined, fallback: number) {
  const parsedValue = Number.parseInt(value ?? '', 10)

  return Number.isFinite(parsedValue) && parsedValue >= 1
    ? parsedValue
    : fallback
}
