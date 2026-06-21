import { z } from 'zod'

export const recipeUrlSchema = z
  .string()
  .trim()
  .min(1, 'Paste a recipe video link to continue.')
  .url('Enter a valid link, like https://www.instagram.com/reel/...')
  .refine((value) => {
    try {
      const protocol = new URL(value).protocol
      return protocol === 'http:' || protocol === 'https:'
    } catch {
      return false
    }
  }, 'Recipe links must start with http:// or https://.')

export function validateRecipeUrl(value: string) {
  return recipeUrlSchema.safeParse(value)
}
