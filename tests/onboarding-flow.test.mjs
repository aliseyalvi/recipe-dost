import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  WELCOME_COMPLETION_HREF,
  getAppEntryHref,
  getAppEntryDecision,
  getLocalOnboardingState,
  getOnboardingCompletionEvent,
  getWelcomePrimaryAction,
  welcomeSlides,
} from '../src/features/onboarding/welcome-flow-model.ts'

test('welcome journey contains the five ordered product concepts', () => {
  assert.equal(welcomeSlides.length, 5)
  assert.deepEqual(
    welcomeSlides.map((slide) => slide.id),
    [
      'brand_intro',
      'save_anywhere',
      'ai_guidance',
      'grocery_lists',
      'ready_to_cook',
    ]
  )
})

test('welcome primary action advances once per screen without skipping', () => {
  for (let step = 0; step < welcomeSlides.length - 1; step += 1) {
    assert.deepEqual(getWelcomePrimaryAction(step), {
      kind: 'advance',
      nextStep: step + 1,
    })
  }
})

test('final CTA completes onboarding before entering Home', () => {
  assert.equal(WELCOME_COMPLETION_HREF, '/home')
  assert.deepEqual(getWelcomePrimaryAction(welcomeSlides.length - 1), {
    kind: 'complete',
  })
})

test('missing onboarding key is authoritatively incomplete', () => {
  assert.equal(
    getLocalOnboardingState({
      hydrationStatus: 'ready',
      storageKeyStatus: 'absent',
      onboardingCompleted: false,
    }),
    'incomplete'
  )
  assert.equal(getAppEntryHref('incomplete'), '/welcome')
})

test('an anonymous session does not suppress onboarding', () => {
  assert.deepEqual(
    getAppEntryDecision({
      authStatus: 'anonymous_ready',
      onboardingState: 'incomplete',
    }),
    { status: 'route', href: '/welcome' }
  )
})

test('cleared local storage shows onboarding regardless of linked auth', () => {
  assert.deepEqual(
    getAppEntryDecision({
      authStatus: 'linked_ready',
      onboardingState: 'incomplete',
    }),
    { status: 'route', href: '/welcome' }
  )
})

test('completed local onboarding bypasses onboarding for returning users', () => {
  assert.deepEqual(
    getAppEntryDecision({
      authStatus: 'anonymous_ready',
      onboardingState: 'completed',
    }),
    { status: 'route', href: '/home' }
  )
})

test('startup loading selects neither tabs nor onboarding prematurely', () => {
  assert.deepEqual(
    getAppEntryDecision({
      authStatus: 'initializing',
      onboardingState: 'incomplete',
    }),
    { status: 'loading' }
  )
  assert.deepEqual(
    getAppEntryDecision({
      authStatus: 'anonymous_ready',
      onboardingState: 'loading',
    }),
    { status: 'loading' }
  )
})

test('storage failure fails safely without selecting Home or marking completion', () => {
  assert.deepEqual(
    getAppEntryDecision({
      authStatus: 'anonymous_ready',
      onboardingState: 'error',
    }),
    { status: 'error', source: 'storage' }
  )
})

test('local completion remains authoritative for a signed-out-ready session', () => {
  assert.equal(getAppEntryHref('completed'), '/home')
  assert.deepEqual(
    getAppEntryDecision({
      authStatus: 'signed_out_ready',
      onboardingState: 'completed',
    }),
    { status: 'route', href: '/home' }
  )
})

test('final welcome screen exposes Get Started and Recover account actions', () => {
  const experience = source('../src/features/onboarding/welcome-experience.tsx')

  assert.match(experience, /label="Get Started"/)
  assert.match(experience, /label="Recover account"/)
  assert.match(experience, /width >= 430 \? 'row' : 'column'/)
})

test('Get Started persists completion before replacing navigation', () => {
  const welcome = source('../app/welcome.tsx')

  assert.ok(
    welcome.indexOf('await markOnboardingCompleted()') <
      welcome.indexOf('router.replace(WELCOME_COMPLETION_HREF)')
  )
})

test('Recover opens existing mode without completing onboarding first', () => {
  const welcome = source('../app/welcome.tsx')
  const recoverAction = between(welcome, 'onRecover={() =>', 'recoverDisabled=')

  assert.match(recoverAction, /pathname: '\/account-access'/)
  assert.match(recoverAction, /mode: 'recover'/)
  assert.doesNotMatch(recoverAction, /markOnboardingCompleted/)
})

test('cancelled recovery returns without changing local onboarding', () => {
  const access = source('../src/features/account-recovery/account-access-screen.tsx')
  const cancelAction = between(access, 'label="Cancel"', 'function AccountAccessHeading')

  assert.match(cancelAction, /router\.back\(\)/)
  assert.doesNotMatch(cancelAction, /markOnboardingCompleted/)
})

test('successful callback completes onboarding and opens the normal app', () => {
  const provider = source('../src/providers/auth-provider.tsx')
  const callback = source('../src/features/account-recovery/auth-callback-screen.tsx')

  assert.match(provider, /await markOnboardingCompleted\(\)/)
  assert.match(callback, /router\.replace\('\/home'\)/)
})

test('recovery actions are disabled while auth initializes', () => {
  const welcome = source('../app/welcome.tsx')
  const access = source('../src/features/account-recovery/account-access-screen.tsx')

  assert.match(welcome, /authReadiness === 'initializing'/)
  assert.match(access, /authReadiness === 'initializing'/)
  assert.match(access, /disabled=\{isSubmitting \|\| authIsPreparing\}/)
})

test('completion and Skip map to distinct single analytics outcomes', () => {
  assert.equal(getOnboardingCompletionEvent('completed'), 'onboarding_completed')
  assert.equal(getOnboardingCompletionEvent('skipped'), 'onboarding_skipped')
})

test('out-of-range actions are safely clamped', () => {
  assert.deepEqual(getWelcomePrimaryAction(-10), {
    kind: 'advance',
    nextStep: 1,
  })
  assert.deepEqual(getWelcomePrimaryAction(100), {
    kind: 'complete',
  })
})

function between(value, start, end) {
  return value.slice(value.indexOf(start), value.indexOf(end))
}

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}
