import {
  CookingLevel,
  CookingPreference,
  CuisinePreference,
  HouseholdSize,
  MainUse,
  RecipeLanguage,
} from '@/features/onboarding/types'

type Option<TValue extends string> = {
  label: string
  value: TValue
}

export const cuisineOptions: Option<CuisinePreference>[] = [
  { label: 'Pakistani', value: 'pakistani' },
  { label: 'Indian', value: 'indian' },
  { label: 'Arabic', value: 'arabic' },
  { label: 'Western', value: 'western' },
  { label: 'Chinese', value: 'chinese' },
  { label: 'Baking', value: 'baking' },
  { label: 'Mixed', value: 'mixed' },
]

export const languageOptions: Option<RecipeLanguage>[] = [
  { label: 'English', value: 'english' },
  { label: 'Urdu', value: 'urdu' },
  { label: 'Roman Urdu', value: 'roman_urdu' },
  { label: 'Both', value: 'both' },
]

export const householdSizeOptions: Option<HouseholdSize>[] = [
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3-4', value: '3-4' },
  { label: '5+', value: '5+' },
]

export const cookingLevelOptions: Option<CookingLevel>[] = [
  { label: 'Beginner', value: 'beginner' },
  { label: 'Average', value: 'average' },
  { label: 'Confident', value: 'confident' },
]

export const mainUseOptions: Option<MainUse>[] = [
  { label: 'Save recipes', value: 'save_recipes' },
  { label: 'Meal planning', value: 'meal_planning' },
  { label: 'Grocery list', value: 'grocery_list' },
  { label: 'Food content ideas', value: 'food_content_ideas' },
]

export const cookingPreferenceOptions: Option<CookingPreference>[] = [
  { label: 'Budget meals', value: 'budget_meals' },
  { label: 'Quick meals', value: 'quick_meals' },
  { label: 'Healthy-ish', value: 'healthy_ish' },
  { label: 'Kids meals', value: 'kids_meals' },
  { label: 'Ramadan/Iftar', value: 'ramadan_iftar' },
  { label: 'Desserts', value: 'desserts' },
]
