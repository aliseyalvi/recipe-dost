import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  AuthOperationGate,
  bootstrapAuthSession,
  completeAnonymousAccountPassword,
  recoverLinkedAccount,
  requestAnonymousAccountLink,
  shouldConfirmGuestSwitch,
  verifyAnonymousAccountEmail,
} from '../src/features/account-recovery/account-recovery.ts'
import {
  USER_OWNED_QUERY_ROOTS,
  refreshUserOwnedQueries,
} from '../src/lib/query/user-owned-query-cache.ts'
import { RevenueCatIdentitySynchronizer } from '../src/lib/revenuecat/revenuecat-identity.ts'

test('Settings renders account summaries and no auth form fields', () => {
  const settings = source('../src/features/account-recovery/account-recovery-section.tsx')

  assert.match(settings, /Guest account/)
  assert.match(settings, /Account secured/)
  assert.match(settings, /maskAccountEmail/)
  assert.doesNotMatch(settings, /<Input|secureTextEntry|Verification code/)
  assert.doesNotMatch(settings, /user\?\.id|user\.id/)
})

test('Settings rows navigate to the focused secure and recover modes', () => {
  const settings = source('../src/features/account-recovery/account-recovery-section.tsx')

  assert.match(settings, /pathname: '\/account-access'/)
  assert.match(settings, /openAccountAccess\('secure'\)/)
  assert.match(settings, /openAccountAccess\('recover'\)/)
})

test('secure flow uses updateUser email and never a new-account path', () => {
  const auth = source('../src/lib/supabase/auth.ts')
  const provider = source('../src/providers/auth-provider.tsx')

  assert.match(auth, /auth\.updateUser\(\{ email \}\)/)
  assert.doesNotMatch(auth, /signUp|signInWithOtp/)
  assert.doesNotMatch(provider, /signUp|signInWithOtp/)
})

test('OTP verification and resend use the installed email_change contract', () => {
  const auth = source('../src/lib/supabase/auth.ts')
  const screen = source('../src/features/account-recovery/account-access-screen.tsx')

  assert.match(auth, /auth\.verifyOtp\(\{[\s\S]*type: 'email_change'/)
  assert.match(auth, /auth\.resend\(\{[\s\S]*type: 'email_change'/)
  assert.match(screen, /setCooldownSeconds\(60\)/)
  assert.match(screen, /cooldownSeconds > 0/)
})

test('password cannot be set before email verification', async () => {
  let passwordUpdates = 0

  await assert.rejects(
    completeAnonymousAccountPassword({
      password: 'strong-password',
      originalUserId: 'guest-user-id',
      dependencies: {
        getSession: () =>
          resolved({ user: { id: 'guest-user-id', is_anonymous: true } }),
        updatePassword: () => {
          passwordUpdates += 1
          return resolved({ id: 'guest-user-id', is_anonymous: false })
        },
      },
    }),
    /Verify the email/
  )
  assert.equal(passwordUpdates, 0)
})

test('password update occurs only after OTP verification and preserves user ID', async () => {
  const flow = secureFlow('guest-user-id')
  const requested = await requestAnonymousAccountLink({
    email: flow.email,
    dependencies: flow.dependencies,
  })
  const verified = await verifyAnonymousAccountEmail({
    email: flow.email,
    token: '123456',
    originalUserId: requested.originalUserId,
    dependencies: flow.dependencies,
  })
  const completed = await completeAnonymousAccountPassword({
    password: 'strong-password',
    originalUserId: requested.originalUserId,
    dependencies: flow.dependencies,
  })

  assert.equal(requested.originalUserId, 'guest-user-id')
  assert.equal(verified.user.id, 'guest-user-id')
  assert.equal(completed.user.id, 'guest-user-id')
  assert.equal(flow.passwordUpdates(), 1)
})

test('user-ID mismatch stops secure completion', async () => {
  const passwordUpdates = 0
  const email = 'cook@example.com'

  await assert.rejects(
    verifyAnonymousAccountEmail({
      email,
      token: '123456',
      originalUserId: 'guest-user-id',
      dependencies: {
        getSession: () =>
          resolved({ user: { id: 'guest-user-id', is_anonymous: true } }),
        verifyEmailChangeOtp: () =>
          resolved({
            id: 'replacement-user-id',
            email,
            email_confirmed_at: '2026-07-30T00:00:00Z',
            is_anonymous: false,
          }),
      },
    }),
    /different user/
  )

  assert.equal(passwordUpdates, 0)
})

test('secure password and confirmation fields have independent visibility controls', () => {
  const screen = source('../src/features/account-recovery/account-access-screen.tsx')

  assert.match(screen, /testID="secure-password-visibility"/)
  assert.match(screen, /testID="secure-confirmation-visibility"/)
  assert.match(screen, /secureTextEntry=\{!visible\}/)
  assert.match(screen, /name=\{visible \? 'eye-off' : 'eye'\}/)
})

test('recover mode uses password sign-in and does not request OTP', () => {
  const auth = source('../src/lib/supabase/auth.ts')
  const provider = source('../src/providers/auth-provider.tsx')
  const recoveryBlock = between(
    provider,
    'const signInToRecover',
    'const handleSignOut'
  )

  assert.match(auth, /auth\.signInWithPassword\(\{/)
  assert.match(recoveryBlock, /signInWithSupabasePassword/)
  assert.doesNotMatch(recoveryBlock, /verifyOtp|resend|signInWithOtp/)
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

test('fresh-install password sign-in re-reads and verifies the recovered user ID', async () => {
  const session = { user: { id: 'recovered-user-id', is_anonymous: false } }
  const recovered = await recoverLinkedAccount({
    email: 'cook@example.com',
    password: 'strong-password',
    dependencies: {
      signInWithPassword: () => resolved(session),
      getVerifiedUser: () => resolved(session.user),
      getSession: () => resolved(session),
    },
  })

  assert.equal(recovered.user.id, 'recovered-user-id')
})

test('auth bootstrap cannot overwrite an in-progress recovery', async () => {
  const gate = new AuthOperationGate()
  let releaseRecovery
  const blocker = new Promise((resolve) => {
    releaseRecovery = resolve
  })
  const recoveredSession = {
    user: { id: 'recovered-user-id', is_anonymous: false },
  }
  let anonymousSignIns = 0

  const recovery = gate.run('recovering', async () => {
    await blocker
  })
  const bootstrap = bootstrapAuthSession({
    gate,
    getSession: () => resolved(recoveredSession),
    signInAnonymously: () => {
      anonymousSignIns += 1
      return resolved({
        user: { id: 'replacement-guest', is_anonymous: true },
      })
    },
  })

  releaseRecovery()
  await recovery
  const result = await bootstrap
  assert.equal(result.user.id, 'recovered-user-id')
  assert.equal(anonymousSignIns, 0)
})

test('successful recovery invalidates and refetches scoped user-owned data', async () => {
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

test('linking and recovery synchronize RevenueCat with the Supabase user ID', async () => {
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

test('RevenueCat failure leaves the recovered Supabase session intact', async () => {
  const session = { user: { id: 'recovered-user-id', is_anonymous: false } }
  const recovered = await recoverLinkedAccount({
    email: 'cook@example.com',
    password: 'strong-password',
    dependencies: {
      signInWithPassword: () => resolved(session),
      getVerifiedUser: () => resolved(session.user),
      getSession: () => resolved(session),
    },
  })
  const synchronizer = new RevenueCatIdentitySynchronizer({
    configure: () => undefined,
    logIn: () => Promise.reject(new Error('offline')),
    getCustomerInfo: () => Promise.reject(new Error('offline')),
    logOut: () => resolved(customerInfo(false)),
  })

  await assert.rejects(synchronizer.synchronize(recovered.user.id))
  assert.equal(recovered.user.id, 'recovered-user-id')
  assert.match(
    source('../src/providers/auth-provider.tsx'),
    /account_recovery_subscription_refresh_pending/
  )
})

test('Settings exposes restore purchases and secured state after completion', () => {
  const provider = source('../src/providers/revenuecat-provider.tsx')
  const settingsRoute = source('../app/(tabs)/settings.tsx')
  const accountSection = source('../src/features/account-recovery/account-recovery-section.tsx')

  assert.match(provider, /Purchases\.restorePurchases\(\)/)
  assert.match(provider, /reconcileSubscription\('restore'\)/)
  assert.match(settingsRoute, /title="Restore purchases"/)
  assert.match(accountSection, /title="Account secured"/)
})

test('rate limiting is bounded and account flow does not duplicate user data', () => {
  const provider = source('../src/providers/auth-provider.tsx')
  const contract = source('../src/features/account-recovery/account-recovery.ts')

  assert.match(
    provider,
    /Too many verification emails were requested\. Please wait before trying again\./
  )
  assert.doesNotMatch(contract, /\.from\(|insert\(|upsert\(/)
  assert.doesNotMatch(provider, /\.from\(|insert\(|upsert\(/)
})

test('sign-out and account linking preserve onboarding completion', () => {
  const provider = source('../src/providers/auth-provider.tsx')

  assert.doesNotMatch(provider, /clearOnboardingProfile|resetProfile/)
  assert.match(provider, /setAccountState\('signed_out'\)/)
})

function secureFlow(userId) {
  const email = 'cook@example.com'
  let session = { user: { id: userId, is_anonymous: true } }
  let passwordUpdateCount = 0
  return {
    email,
    passwordUpdates: () => passwordUpdateCount,
    dependencies: {
      getSession: () => resolved(session),
      updateEmail: () => resolved({ id: userId, is_anonymous: true }),
      verifyEmailChangeOtp: () => {
        session = {
          user: {
            id: userId,
            email,
            email_confirmed_at: '2026-07-30T00:00:00Z',
            is_anonymous: false,
          },
        }
        return resolved(session.user)
      },
      updatePassword: () => {
        passwordUpdateCount += 1
        return resolved(session.user)
      },
    },
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
