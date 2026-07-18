import assert from 'node:assert/strict'
import test from 'node:test'

import {
  WELCOME_COMPLETION_HREF,
  getAppEntryHref,
  getAppEntryDecision,
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

test('remote onboarding completion remains the returning-user route guard', () => {
  assert.equal(getAppEntryHref(true, true), '/home')
  assert.equal(getAppEntryHref(false, true), '/welcome')
  assert.equal(getAppEntryHref(null, true), '/welcome')
  assert.equal(getAppEntryHref(undefined, true), '/welcome')
})

test('cleared local onboarding data shows Welcome even with a restored session', () => {
  assert.equal(getAppEntryHref(true, false), '/welcome')
})

test('absent or explicit false local completion shows onboarding', () => {
  for (const localOnboardingCompleted of [false, Boolean(null)]) {
    assert.deepEqual(
      getAppEntryDecision({
        authStatus: 'signed_in',
        storageStatus: 'ready',
        profileStatus: 'ready',
        remoteOnboardingCompleted: false,
        localOnboardingCompleted,
      }),
      { status: 'route', href: '/welcome' }
    )
  }
})

test('true local and remote completion bypasses onboarding for a returning user', () => {
  assert.deepEqual(
    getAppEntryDecision({
      authStatus: 'signed_in',
      storageStatus: 'ready',
      profileStatus: 'ready',
      remoteOnboardingCompleted: true,
      localOnboardingCompleted: true,
    }),
    { status: 'route', href: '/home' }
  )
})

test('pending auth, storage, or profile state keeps branded loading active', () => {
  for (const pending of ['authStatus', 'storageStatus', 'profileStatus']) {
    const input = {
      authStatus: 'signed_in',
      storageStatus: 'ready',
      profileStatus: 'ready',
      remoteOnboardingCompleted: true,
      localOnboardingCompleted: true,
    }
    input[pending] = 'pending'
    assert.deepEqual(getAppEntryDecision(input), { status: 'loading' })
  }
})

test('storage failure fails safely without selecting Home or marking completion', () => {
  assert.deepEqual(
    getAppEntryDecision({
      authStatus: 'signed_in',
      storageStatus: 'error',
      profileStatus: 'ready',
      remoteOnboardingCompleted: true,
      localOnboardingCompleted: false,
    }),
    { status: 'error', source: 'storage' }
  )
})

test('returning signed-in and signed-out route matrix is stable', () => {
  assert.equal(getAppEntryHref(true, true), '/home')
  assert.deepEqual(
    getAppEntryDecision({
      authStatus: 'signed_out',
      storageStatus: 'ready',
      profileStatus: 'ready',
      remoteOnboardingCompleted: true,
      localOnboardingCompleted: true,
    }),
    { status: 'route', href: '/welcome' }
  )
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
