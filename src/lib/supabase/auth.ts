import { supabase, supabaseConfigError } from '@/lib/supabase/client'

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

  const { data, error } = await supabase.auth.updateUser({ email })

  if (error) {
    throw error
  }

  return data.user
}

export async function verifyCurrentUserEmailChange(email: string, token: string) {
  assertSupabaseConfigured()

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email_change',
  })

  if (error) {
    throw error
  }

  if (!data.user) {
    throw new Error('The email verification response was incomplete.')
  }

  return data.user
}

export async function resendCurrentUserEmailChange(email: string) {
  assertSupabaseConfigured()

  const { error } = await supabase.auth.resend({
    email,
    type: 'email_change',
  })

  if (error) {
    throw error
  }
}

export async function updateCurrentUserPassword(password: string) {
  assertSupabaseConfigured()

  const { data, error } = await supabase.auth.updateUser({ password })

  if (error) {
    throw error
  }

  return data.user
}

export async function signInWithPassword(email: string, password: string) {
  assertSupabaseConfigured()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw error
  }

  return data.session
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
