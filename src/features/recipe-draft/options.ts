import { RecipeMealType } from '@/features/recipe-draft/types'

type Option<TValue extends string> = {
  label: string
  value: TValue
}

export const mealTypeOptions: Option<RecipeMealType>[] = [
  { label: 'Breakfast', value: 'breakfast' },
  { label: 'Lunch', value: 'lunch' },
  { label: 'Dinner', value: 'dinner' },
  { label: 'Snack', value: 'snack' },
  { label: 'Dessert', value: 'dessert' },
  { label: 'Iftar', value: 'iftar' },
  { label: 'Other', value: 'other' },
]

export const cuisineOptions: Option<string>[] = [
  { label: 'Pakistani', value: 'Pakistani' },
  { label: 'Indian', value: 'Indian' },
  { label: 'Arabic', value: 'Arabic' },
  { label: 'Western', value: 'Western' },
  { label: 'Chinese', value: 'Chinese' },
  { label: 'Baking', value: 'Baking' },
  { label: 'Mixed', value: 'Mixed' },
  { label: 'Other', value: 'Other' },
]
