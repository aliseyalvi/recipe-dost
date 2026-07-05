declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SUPABASE_URL?: string
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string
    EXPO_PUBLIC_DEV_TOOLS_ENABLED?: string
    EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?: string
    EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID?: string
    EXPO_PUBLIC_REVENUECAT_OFFERING_ID?: string
  }
}

declare const process: {
  env: NodeJS.ProcessEnv
}
