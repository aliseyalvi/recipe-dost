import { supabase } from '@/lib/supabase/client'
import { secureStoreStorage } from '@/lib/storage/secure-store-storage'
import { Session } from '@supabase/supabase-js'

const storageKey = 'recipe-dost-dev-anonymous-identities'

export type DevAnonymousIdentity = {
  userId: string
  accessToken: string
  refreshToken: string
  createdAt: string
  lastUsedAt: string
}

export async function getSavedDevIdentities() {
  return readIdentities()
}

export async function saveCurrentDevIdentity() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error || !session) {
    return null
  }

  return saveDevIdentityFromSession(session)
}

export async function createFreshAnonymousDevIdentity() {
  await saveCurrentDevIdentity()
  await supabase.auth.signOut({ scope: 'local' })

  const { data, error } = await supabase.auth.signInAnonymously()

  if (error || !data.session) {
    throw error ?? new Error('Could not create anonymous test user.')
  }

  return saveDevIdentityFromSession(data.session)
}

export async function switchToSavedDevIdentity(userId: string) {
  const normalizedUserId = userId.trim()

  if (!normalizedUserId) {
    throw new Error('Enter a saved anonymous user id.')
  }

  await saveCurrentDevIdentity()

  const identities = await readIdentities()
  const identity = identities.find((item) => item.userId === normalizedUserId)

  if (!identity) {
    throw new Error('This device has not saved that anonymous user id.')
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: identity.accessToken,
    refresh_token: identity.refreshToken,
  })

  if (error || !data.session) {
    throw error ?? new Error('Could not switch anonymous user.')
  }

  return saveDevIdentityFromSession(data.session)
}

async function saveDevIdentityFromSession(session: Session) {
  const now = new Date().toISOString()
  const identities = await readIdentities()
  const existingIdentity = identities.find(
    (identity) => identity.userId === session.user.id
  )
  const nextIdentity: DevAnonymousIdentity = {
    userId: session.user.id,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    createdAt: existingIdentity?.createdAt ?? now,
    lastUsedAt: now,
  }
  const nextIdentities = [
    nextIdentity,
    ...identities.filter((identity) => identity.userId !== session.user.id),
  ].slice(0, 12)

  await writeIdentities(nextIdentities)

  return nextIdentity
}

async function readIdentities() {
  const rawValue = await secureStoreStorage.getItem(storageKey)

  if (!rawValue) {
    return []
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue)

    if (!Array.isArray(parsedValue)) {
      return []
    }

    return parsedValue.filter(isDevAnonymousIdentity)
  } catch {
    return []
  }
}

async function writeIdentities(identities: DevAnonymousIdentity[]) {
  await secureStoreStorage.setItem(storageKey, JSON.stringify(identities))
}

function isDevAnonymousIdentity(
  value: unknown
): value is DevAnonymousIdentity {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const identity = value as Partial<DevAnonymousIdentity>

  return (
    typeof identity.userId === 'string' &&
    typeof identity.accessToken === 'string' &&
    typeof identity.refreshToken === 'string' &&
    typeof identity.createdAt === 'string' &&
    typeof identity.lastUsedAt === 'string'
  )
}
