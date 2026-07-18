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
