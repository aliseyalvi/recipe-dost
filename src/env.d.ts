declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SUPABASE_URL?: string
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string
    EXPO_PUBLIC_DEV_TOOLS_ENABLED?: string
  }
}

declare const process: {
  env: NodeJS.ProcessEnv
}
