import { supabase, supabaseConfigError } from '@/lib/supabase/client'

export const MAGIC_LINK_CALLBACK_URL = 'recipe-dost://auth/callback'
export const AUTH_CALLBACK_FLOW = 'implicit' as const

function assertSupabaseConfigured() {
  if (supabaseConfigError) {
    throw new Error(supabaseConfigError)
  }
}

export async function getSession() {
  assertSupabaseConfigured()

  const { data, error } = await supabase.auth.getSession()

  if (error) {
    throw error
  }

  return data.session
}

export async function signInAnonymously() {
  assertSupabaseConfigured()

  const { data, error } = await supabase.auth.signInAnonymously()

  if (error) {
    throw error
  }

  return data.session
}

export async function updateCurrentUserEmail(email: string) {
  assertSupabaseConfigured()

  const { data, error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: MAGIC_LINK_CALLBACK_URL }
  )

  if (error) {
    throw error
  }

  return data.user
}

export async function sendRecoveryMagicLink(email: string) {
  assertSupabaseConfigured()

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: MAGIC_LINK_CALLBACK_URL,
    },
  })

  if (error && !isUnknownRecoveryEmailError(error)) {
    throw error
  }
}

export async function establishSessionFromAuthCallback(callbackUrl: string) {
  assertSupabaseConfigured()
  const parameters = getAuthCallbackParameters(callbackUrl)

  if (parameters.hasError) {
    throw new Error('This sign-in link is invalid or expired. Request a new link.')
  }

  if (parameters.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(
      parameters.code
    )
    if (error) throw error
    if (!data.session) {
      throw new Error('The sign-in session could not be established.')
    }
    return data.session
  }

  if (!parameters.accessToken || !parameters.refreshToken) {
    throw new Error('This sign-in link is invalid or expired. Request a new link.')
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: parameters.accessToken,
    refresh_token: parameters.refreshToken,
  })
  if (error) {
    throw error
  }
  if (!data.session) {
    throw new Error('The sign-in session could not be established.')
  }
  return data.session
}

export function getAuthCallbackKind(callbackUrl: string) {
  const type = getAuthCallbackParameters(callbackUrl).type
  if (type === 'email_change') return 'secure' as const
  if (type === 'magiclink' || type === 'email') return 'recover' as const
  return null
}

export function isAuthCallbackUrl(callbackUrl: string) {
  try {
    const parsed = new URL(callbackUrl)
    return (
      parsed.protocol === 'recipe-dost:' &&
      parsed.hostname === 'auth' &&
      parsed.pathname === '/callback'
    )
  } catch {
    return false
  }
}

function getAuthCallbackParameters(callbackUrl: string) {
  const parsed = new URL(callbackUrl)
  const hashParameters = new URLSearchParams(parsed.hash.replace(/^#/, ''))
  const read = (name: string) =>
    parsed.searchParams.get(name) ?? hashParameters.get(name)

  return {
    accessToken: read('access_token'),
    refreshToken: read('refresh_token'),
    code: read('code'),
    type: read('type'),
    hasError: Boolean(read('error') || read('error_code')),
  }
}

function isUnknownRecoveryEmailError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const record = error as { code?: unknown; message?: unknown }
  const code = typeof record.code === 'string' ? record.code.toLowerCase() : ''
  const message =
    typeof record.message === 'string' ? record.message.toLowerCase() : ''
  return (
    code === 'user_not_found' ||
    message.includes('user not found') ||
    message.includes('user does not exist')
  )
}

export async function getVerifiedUser() {
  assertSupabaseConfigured()

  const { data, error } = await supabase.auth.getUser()

  if (error) {
    throw error
  }

  return data.user
}

export async function hasMeaningfulCurrentUserData(userId: string) {
  assertSupabaseConfigured()

  const checks = await Promise.all([
    supabase
      .from('recipe_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('recipe_cards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('grocery_lists')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('media_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
  ])

  for (const result of checks) {
    if (result.error) {
      throw result.error
    }
  }

  return checks.some((result) => (result.count ?? 0) > 0)
}

export async function signOut() {
  assertSupabaseConfigured()

  const { error } = await supabase.auth.signOut()

  if (error) {
    throw error
  }
}

export async function clearSessionLocally() {
  assertSupabaseConfigured()

  const { error } = await supabase.auth.signOut({ scope: 'local' })

  if (error) {
    throw error
  }
}
