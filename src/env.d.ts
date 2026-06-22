declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SUPABASE_URL?: string
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string
    EXPO_PUBLIC_FREE_SAVED_LINK_LIMIT?: string
    EXPO_PUBLIC_FREE_RECIPE_CARD_LIMIT?: string
    EXPO_PUBLIC_FREE_GROCERY_LIST_LIMIT?: string
  }
}

declare const process: {
  env: NodeJS.ProcessEnv
}
