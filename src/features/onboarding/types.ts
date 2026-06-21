export type CuisinePreference =
  | 'pakistani'
  | 'indian'
  | 'arabic'
  | 'western'
  | 'chinese'
  | 'baking'
  | 'mixed'

export type RecipeLanguage = 'english' | 'urdu' | 'roman_urdu' | 'both'

export type HouseholdSize = '1' | '2' | '3-4' | '5+'

export type CookingLevel = 'beginner' | 'average' | 'confident'

export type MainUse =
  | 'save_recipes'
  | 'meal_planning'
  | 'grocery_list'
  | 'food_content_ideas'

export type CookingPreference =
  | 'budget_meals'
  | 'quick_meals'
  | 'healthy_ish'
  | 'kids_meals'
  | 'ramadan_iftar'
  | 'desserts'

export type OnboardingProfile = {
  cuisinePreference: CuisinePreference | null
  language: RecipeLanguage | null
  householdSize: HouseholdSize | null
  cookingLevel: CookingLevel | null
  mainUse: MainUse | null
  cookingPreferences: CookingPreference[]
  onboardingCompleted: boolean
}
