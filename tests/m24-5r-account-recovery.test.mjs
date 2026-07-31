import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  AuthCallbackGate,
  AuthOperationGate,
  bootstrapAuthSession,
  shouldConfirmGuestSwitch,
  verifyAuthoritativeCallbackSession,
} from '../src/features/account-recovery/account-recovery.ts'
import {
  USER_OWNED_QUERY_ROOTS,
  refreshUserOwnedQueries,
} from '../src/lib/query/user-owned-query-cache.ts'
import { RevenueCatIdentitySynchronizer } from '../src/lib/revenuecat/revenuecat-identity.ts'

test('secure and recover screens share one email field and no password or OTP UI', () => {
  const screen = source('../src/features/account-recovery/account-access-screen.tsx')

  assert.equal((screen.match(/<Input/g) ?? []).length, 1)
  assert.match(screen, /Secure your account/)
  assert.match(screen, /Recover your account/)
  assert.match(screen, /Send secure link/)
  assert.match(screen, /Send sign-in link/)
  assert.doesNotMatch(
    screen,
    /PasswordInput|secureTextEntry|Verification code|one-time-code|Verify code/
  )
})

test('secure uses updateUser email with the app callback and never creates a user', () => {
  const auth = source('../src/lib/supabase/auth.ts')

  assert.match(auth, /auth\.updateUser\(\s*\{ email \},\s*\{ emailRedirectTo: MAGIC_LINK_CALLBACK_URL \}/)
  assert.doesNotMatch(auth, /signUp/)
  assert.doesNotMatch(auth, /updateUser\(\{ password|verifyOtp/)
})

test('recovery uses a non-creating magic link and never password sign-in', () => {
  const auth = source('../src/lib/supabase/auth.ts')

  assert.match(auth, /auth\.signInWithOtp\(\{/)
  assert.match(auth, /shouldCreateUser: false/)
  assert.match(auth, /emailRedirectTo: MAGIC_LINK_CALLBACK_URL/)
  assert.doesNotMatch(auth, /signInWithPassword/)
})

test('both flows use the exact Recipe Dost callback URL and implicit client flow', () => {
  const auth = source('../src/lib/supabase/auth.ts')
  const config = source('../app.config.js')
  const client = source('../src/lib/supabase/client.ts')

  assert.match(config, /scheme: "recipe-dost"/)
  assert.match(auth, /'recipe-dost:\/\/auth\/callback'/)
  assert.match(auth, /AUTH_CALLBACK_FLOW = 'implicit'/)
  assert.match(client, /detectSessionInUrl: false/)
})

test('callback supports implicit session establishment and authoritative refetch', () => {
  const auth = source('../src/lib/supabase/auth.ts')
  const provider = source('../src/providers/auth-provider.tsx')

  assert.match(auth, /auth\.setSession\(\{/)
  assert.match(auth, /auth\.exchangeCodeForSession/)
  assert.match(provider, /establishSessionFromAuthCallback\(callbackUrl\)/)
  assert.match(provider, /verifyAuthoritativeCallbackSession\(\{/)
  assert.match(provider, /getVerifiedUser, getSession/)
})

test('secure callback preserves the original anonymous UUID', async () => {
  const user = linkedUser('guest-user-id')
  const session = { user }
  const finalSession = await verifyAuthoritativeCallbackSession({
    expectedUserId: 'guest-user-id',
    expectedEmail: user.email,
    dependencies: {
      getVerifiedUser: () => resolved(user),
      getSession: () => resolved(session),
    },
  })

  assert.equal(finalSession.user.id, 'guest-user-id')
})

test('UUID mismatch fails safely', async () => {
  const user = linkedUser('replacement-user-id')
  await assert.rejects(
    verifyAuthoritativeCallbackSession({
      expectedUserId: 'guest-user-id',
      expectedEmail: user.email,
      dependencies: {
        getVerifiedUser: () => resolved(user),
        getSession: () => resolved({ user }),
      },
    }),
    /different user/
  )
})

test('unknown recovery email cannot create an account', () => {
  const auth = source('../src/lib/supabase/auth.ts')
  const recovery = between(auth, 'sendRecoveryMagicLink', 'establishSessionFromAuthCallback')

  assert.match(recovery, /shouldCreateUser: false/)
  assert.doesNotMatch(recovery, /signUp|updateUser/)
})

test('callback processing is idempotent', async () => {
  const gate = new AuthCallbackGate()
  let executions = 0
  const callbackUrl =
    'recipe-dost://auth/callback#access_token=secret&refresh_token=secret'
  const task = () => {
    executions += 1
    return resolved('completed')
  }

  const [first, replay] = await Promise.all([
    gate.run(callbackUrl, task),
    gate.run(callbackUrl, task),
  ])
  assert.equal(first, 'completed')
  assert.equal(replay, 'completed')
  assert.equal(executions, 1)
})

test('terminated and background callback paths are handled without logging URLs', () => {
  const provider = source('../src/providers/auth-provider.tsx')

  assert.match(provider, /Linking\.getInitialURL\(\)/)
  assert.match(provider, /Linking\.addEventListener\('url'/)
  assert.doesNotMatch(provider, /console\./)
})

test('meaningful guest data requires confirmation but an empty guest can switch', () => {
  const screen = source('../src/features/account-recovery/account-access-screen.tsx')

  assert.equal(
    shouldConfirmGuestSwitch({ isAnonymous: true, hasMeaningfulData: false }),
    false
  )
  assert.equal(
    shouldConfirmGuestSwitch({ isAnonymous: true, hasMeaningfulData: true }),
    true
  )
  assert.match(screen, /Switch away from guest data\?/)
  assert.match(screen, /without merging or deleting either account/)
})

test('auth bootstrap cannot overwrite callback recovery', async () => {
  const gate = new AuthOperationGate()
  let releaseRecovery
  const blocker = new Promise((resolve) => {
    releaseRecovery = resolve
  })
  const recoveredSession = { user: linkedUser('recovered-user-id') }
  let anonymousSignIns = 0

  const recovery = gate.run('recovering', async () => {
    await blocker
  })
  const bootstrap = bootstrapAuthSession({
    gate,
    getSession: () => resolved(recoveredSession),
    signInAnonymously: () => {
      anonymousSignIns += 1
      return resolved({ user: { id: 'replacement-guest', is_anonymous: true } })
    },
  })

  releaseRecovery()
  await recovery
  const result = await bootstrap
  assert.equal(result.user.id, 'recovered-user-id')
  assert.equal(anonymousSignIns, 0)
})

test('successful callback refetches every scoped user-owned query root', async () => {
  const invalidated = []
  await refreshUserOwnedQueries({
    invalidateQueries: ({ queryKey }) => {
      invalidated.push(queryKey[0])
      return Promise.resolve()
    },
  })

  assert.deepEqual(invalidated, USER_OWNED_QUERY_ROOTS.map((key) => key[0]))
  for (const key of [
    'recent-recipes',
    'recipe-library',
    'favourites',
    'recipe-card',
    'recipe-grocery-lists',
    'active-media-jobs',
    'media-job',
    'ai-access-state',
    'user-profile',
  ]) {
    assert.ok(invalidated.includes(key))
  }
})

test('RevenueCat identity uses the recovered Supabase UUID and refreshes Premium', async () => {
  let configuredUserId = null
  const synchronizer = new RevenueCatIdentitySynchronizer({
    configure: (userId) => {
      configuredUserId = userId
    },
    logIn: () => resolved({ customerInfo: customerInfo(false) }),
    getCustomerInfo: () => resolved(customerInfo(true)),
    logOut: () => resolved(customerInfo(false)),
  })

  const info = await synchronizer.synchronize('recovered-supabase-user-id')
  assert.equal(configuredUserId, 'recovered-supabase-user-id')
  assert.ok(info.entitlements.active.premium)
  assert.match(
    source('../src/providers/auth-provider.tsx'),
    /refreshRecoveredIdentity\(\s*finalSession\.user\.id\s*\)/
  )
})

test('RevenueCat failure does not undo an authoritative Supabase session', async () => {
  const user = linkedUser('recovered-user-id')
  const session = await verifyAuthoritativeCallbackSession({
    dependencies: {
      getVerifiedUser: () => resolved(user),
      getSession: () => resolved({ user }),
    },
  })
  const synchronizer = new RevenueCatIdentitySynchronizer({
    configure: () => undefined,
    logIn: () => Promise.reject(new Error('offline')),
    getCustomerInfo: () => Promise.reject(new Error('offline')),
    logOut: () => resolved(customerInfo(false)),
  })

  await assert.rejects(synchronizer.synchronize(session.user.id))
  assert.equal(session.user.id, 'recovered-user-id')
  assert.match(
    source('../src/providers/auth-provider.tsx'),
    /account_recovery_subscription_refresh_pending/
  )
})

test('Settings remains summary-only with restore purchases and secured state', () => {
  const section = source('../src/features/account-recovery/account-recovery-section.tsx')
  const settings = source('../app/(tabs)/settings.tsx')

  assert.match(section, /Guest account/)
  assert.match(section, /Account secured/)
  assert.match(section, /maskAccountEmail/)
  assert.doesNotMatch(section, /<Input|secureTextEntry|Verification code/)
  assert.match(settings, /title="Restore purchases"/)
})

test('magic-link UI retains cooldown, change-email and bounded rate-limit copy', () => {
  const screen = source('../src/features/account-recovery/account-access-screen.tsx')
  const provider = source('../src/providers/auth-provider.tsx')

  assert.match(screen, /setCooldownSeconds\(60\)/)
  assert.match(screen, /Resend available in/)
  assert.match(screen, /Change email/)
  assert.match(screen, /Open the link sent to \{email\} on this device/)
  assert.match(
    provider,
    /Too many verification emails were requested\. Please wait before trying again\./
  )
})

test('account recovery does not duplicate user-owned records or reset onboarding', () => {
  const contract = source('../src/features/account-recovery/account-recovery.ts')
  const provider = source('../src/providers/auth-provider.tsx')

  assert.doesNotMatch(contract, /\.from\(|insert\(|upsert\(/)
  assert.doesNotMatch(provider, /\.from\(|insert\(|upsert\(/)
  assert.doesNotMatch(provider, /clearOnboardingProfile|resetProfile/)
})

function linkedUser(id) {
  return {
    id,
    email: 'cook@example.com',
    email_confirmed_at: '2026-07-31T00:00:00Z',
    is_anonymous: false,
  }
}

function customerInfo(premium) {
  return {
    entitlements: {
      active: premium ? { premium: { isActive: true } } : {},
    },
  }
}

function between(value, start, end) {
  return value.slice(value.indexOf(start), value.indexOf(end))
}

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

function resolved(value) {
  return Promise.resolve(value)
}
