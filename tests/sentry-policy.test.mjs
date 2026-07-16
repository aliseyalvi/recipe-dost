import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getSentryIdentityAction,
  isSafeSentryUserId,
  isSentryTransmissionAllowed,
  isUnexpectedTechnicalFailureCode,
  sanitizeSentryEvent,
} from '../src/lib/observability/sentry-policy.ts'

const validGate = {
  appEnv: 'production',
  appVariant: 'production',
  devTestOverride: false,
  dsn: 'https://public@example.ingest.sentry.io/123',
  transmissionEnabled: true,
}

test('app Sentry environment policy fails closed outside approved production or controlled development', () => {
  assert.equal(isSentryTransmissionAllowed(validGate), true)
  assert.equal(
    isSentryTransmissionAllowed({
      ...validGate,
      appEnv: 'development',
      appVariant: 'development',
    }),
    false
  )
  assert.equal(
    isSentryTransmissionAllowed({
      ...validGate,
      appEnv: 'development',
      appVariant: 'development',
      devTestOverride: true,
    }),
    true
  )
  assert.equal(
    isSentryTransmissionAllowed({
      ...validGate,
      appEnv: 'development',
      appVariant: 'preview',
      devTestOverride: true,
    }),
    false
  )
  assert.equal(isSentryTransmissionAllowed({ ...validGate, dsn: null }), false)
})

test('app Sentry sanitizer removes URLs, auth, tokens, RevenueCat, AI, recipe, and body data', () => {
  const userId = '123e4567-e89b-42d3-a456-426614174000'
  const sanitized = sanitizeSentryEvent({
    event_id: 'a'.repeat(32),
    platform: 'javascript',
    level: 'error',
    environment: 'production',
    release: 'com.recipedost.app@1.0.0+1',
    source_url: 'https://video.example/watch?token=fake',
    request: {
      headers: { Authorization: 'Bearer fake-access-token' },
      data: { recipe: 'secret recipe' },
    },
    contexts: {
      supabase: { access_token: 'fake-supabase-token' },
      revenuecat: { customerInfo: { receipt: 'fake-receipt' } },
    },
    extra: {
      prompt: 'fake AI prompt',
      response: 'fake AI response',
      ingredients: ['secret ingredient'],
      response_body: 'fake response body',
    },
    tags: {
      app_env: 'production',
      recipe_title: 'secret title',
      email: 'person@example.com',
    },
    user: { id: userId, email: 'person@example.com', name: 'Fake Person' },
    exception: {
      values: [
        {
          type: 'TypeError',
          value: 'https://private.example Bearer fake-token recipe instructions',
          stacktrace: {
            frames: [
              {
                filename: 'https://cdn.example/index.android.bundle?secret=fake',
                function: 'runTask',
                lineno: 12,
                colno: 4,
                vars: { SUPABASE_ACCESS_TOKEN: 'fake-supabase-token' },
                context_line: 'const prompt = rawAiResponse',
              },
            ],
          },
        },
      ],
    },
  })

  assert.equal(sanitized.user?.id, userId)
  assert.deepEqual(sanitized.tags, { app_env: 'production' })
  assert.equal(sanitized.exception?.values?.[0]?.value, 'Application error')
  const serialized = JSON.stringify(sanitized).toLowerCase()
  for (const forbidden of [
    'https://',
    'authorization',
    'bearer',
    'fake-access-token',
    'fake-supabase-token',
    'customerinfo',
    'fake-receipt',
    'fake ai prompt',
    'fake ai response',
    'secret recipe',
    'secret ingredient',
    'response body',
    'person@example.com',
    'fake person',
    'context_line',
    'vars',
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden)
  }
})

test('Sentry identity accepts Supabase UUID only and clears on session removal', () => {
  const userId = '123e4567-e89b-42d3-a456-426614174000'
  assert.equal(isSafeSentryUserId(userId), true)
  assert.equal(isSafeSentryUserId('person@example.com'), false)
  assert.equal(getSentryIdentityAction(null, userId), 'set')
  assert.equal(getSentryIdentityAction(userId, null), 'clear')
  assert.equal(getSentryIdentityAction(userId, userId), 'none')
})

test('expected product failure codes are excluded while technical terminal failures remain reportable', () => {
  for (const code of [
    'invalid_link',
    'unsupported_source',
    'quota_reached',
    'purchase_cancelled',
    'video_duration_exceeded',
    'gemini_structured_extraction_failed',
  ]) {
    assert.equal(isUnexpectedTechnicalFailureCode(code), false, code)
  }
  for (const code of [
    'network_failure',
    'provider_exception',
    'recipe_card_insert_failed',
    'unknown',
    null,
  ]) {
    assert.equal(isUnexpectedTechnicalFailureCode(code), true, String(code))
  }
})
