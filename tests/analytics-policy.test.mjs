import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ANALYTICS_SCHEMA_VERSION,
  canCaptureProductEvent,
  getAnalyticsIdentityAction,
  getPostHogEnablement,
  isAllowedProductEvent,
  isSafeSupabaseUserId,
  normalizeScreenPath,
  sanitizeEventProperties,
  sanitizePostHogCapture,
} from '../src/lib/analytics/policy.ts'

const validProject = {
  apiKey: `phc_${'a'.repeat(24)}`,
  host: 'https://us.i.posthog.com',
}

test('production enables with a valid project and preview always stays disabled', () => {
  assert.equal(
    getPostHogEnablement({
      ...validProject,
      appEnv: 'production',
      appVariant: 'production',
      devTest: undefined,
    }).enabled,
    true
  )
  assert.equal(
    getPostHogEnablement({
      ...validProject,
      appEnv: 'development',
      appVariant: 'preview',
      devTest: 'true',
    }).enabled,
    false
  )
})

test('development is disabled by default and only exact controlled flag enables it', () => {
  for (const devTest of [undefined, '', 'false', 'TRUE', '1']) {
    assert.equal(
      getPostHogEnablement({
        ...validProject,
        appEnv: 'development',
        appVariant: 'development',
        devTest,
      }).enabled,
      false
    )
  }
  const controlled = getPostHogEnablement({
    ...validProject,
    appEnv: 'development',
    appVariant: 'development',
    devTest: 'true',
  })
  assert.equal(controlled.enabled, true)
  assert.equal(controlled.isControlledDevelopmentTest, true)
})

test('missing or invalid project values fail closed', () => {
  for (const overrides of [
    { apiKey: undefined },
    { apiKey: 'YOUR_KEY' },
    { host: undefined },
    { host: 'http://us.i.posthog.com' },
    { host: 'https://us.i.posthog.com/capture' },
  ]) {
    assert.equal(
      getPostHogEnablement({
        ...validProject,
        ...overrides,
        appEnv: 'production',
        appVariant: 'production',
        devTest: undefined,
      }).enabled,
      false
    )
  }
})

test('event names and event properties are closed allowlists', () => {
  assert.equal(isAllowedProductEvent('recipe_link_saved'), true)
  assert.equal(isAllowedProductEvent('arbitrary_event'), false)
  assert.deepEqual(
    sanitizeEventProperties('recipe_link_saved', {
      source_platform: 'youtube',
      entry_point: 'add',
      arbitrary: 'nope',
    }),
    { source_platform: 'youtube', entry_point: 'add' }
  )
  assert.equal(sanitizePostHogCapture({ event: 'arbitrary_event', properties: {} }), null)
})

test('account recovery events allow only normalized non-PII properties', () => {
  assert.equal(isAllowedProductEvent('account_recovery_completed'), true)
  assert.deepEqual(
    sanitizeEventProperties('account_recovery_completed', {
      method: 'email_magic_link',
      replaced_empty_guest: true,
      subscription_refresh_pending: false,
      email: 'blocked@example.com',
      user_id: 'blocked',
    }),
    {
      method: 'email_magic_link',
      replaced_empty_guest: true,
      subscription_refresh_pending: false,
    }
  )
})

test('subscription reconciliation events retain only safe normalized diagnostics', () => {
  assert.equal(isAllowedProductEvent('subscription_restore_no_entitlement'), true)
  assert.deepEqual(
    sanitizeEventProperties('subscription_refresh_failed', {
      trigger: 'refresh',
      state_before: 'free',
      local_entitlement_active: false,
      backend_premium_active: false,
      expiration_relation: 'expired',
      provider_environment: 'sandbox',
      sync_result: 'failed',
      normalized_error_code: 'timeout',
      latency_bucket: '2s_5s',
      customer_id: 'blocked',
      receipt: 'blocked',
    }),
    {
      trigger: 'refresh',
      local_entitlement_active: false,
      backend_premium_active: false,
      expiration_relation: 'expired',
      provider_environment: 'sandbox',
      sync_result: 'failed',
      normalized_error_code: 'timeout',
      latency_bucket: '2s_5s',
    }
  )
})

test('before_send preserves only required SDK transport fields', () => {
  assert.deepEqual(
    sanitizePostHogCapture({
      event: 'app_opened',
      properties: {
        token: `phc_${'a'.repeat(24)}`,
        distinct_id: 'anonymous-device-id',
        api_key: 'blocked-app-field',
      },
    }),
    {
      event: 'app_opened',
      properties: {
        token: `phc_${'a'.repeat(24)}`,
        distinct_id: 'anonymous-device-id',
      },
    }
  )
})

test('sanitizer removes private content, URLs, tokens, raw errors, and long strings', () => {
  assert.deepEqual(
    sanitizeEventProperties('recipe_link_save_failed', {
      source_platform: 'instagram',
      entry_point: 'add',
      failure_code: 'unknown',
      email: 'person@example.com',
      source_url: 'https://example.com/recipe',
      message: 'raw backend error',
      authorization: 'Bearer secret-value',
      app_variant: 'x'.repeat(81),
      update_channel: 'Bearer abc123',
    }),
    {
      source_platform: 'instagram',
      entry_point: 'add',
      failure_code: 'unknown',
    }
  )
})

test('privacy sanitizer drops search, recipe content, Error objects, purchase IDs, and person data', () => {
  const rawError = new Error('private provider detail')
  assert.deepEqual(
    sanitizeEventProperties('purchase_failed', {
      entry_point: 'quota_gate',
      plan_interval: 'yearly',
      result: 'failure',
      failure_code: 'network',
      search_text: 'secret search',
      recipe_title: 'secret recipe',
      ingredients: ['secret ingredient'],
      error: rawError,
      stack: rawError.stack,
      transaction_id: 'fake-transaction-id',
      purchase_token: 'fake-purchase-token',
      email: 'person@example.com',
      name: 'Fake Person',
    }),
    {
      entry_point: 'quota_gate',
      plan_interval: 'yearly',
      result: 'failure',
      failure_code: 'network',
    }
  )
})

test('identify capture strips all person properties while preserving SDK identity fields', () => {
  assert.deepEqual(
    sanitizePostHogCapture({
      event: '$identify',
      properties: {
        distinct_id: '123e4567-e89b-42d3-a456-426614174000',
        $anon_distinct_id: 'anonymous-id',
        email: 'person@example.com',
        name: 'Fake Person',
        recipe_title: 'secret recipe',
      },
      $set: { email: 'person@example.com' },
      $set_once: { name: 'Fake Person' },
    }),
    {
      event: '$identify',
      properties: {
        distinct_id: '123e4567-e89b-42d3-a456-426614174000',
        $anon_distinct_id: 'anonymous-id',
      },
      $set: undefined,
      $set_once: undefined,
    }
  )
})

test('screen tracking accepts normalized names without params or queries', () => {
  assert.equal(normalizeScreenPath('/(tabs)/home'), 'home')
  assert.equal(normalizeScreenPath('/recipe/08c3?returnTo=/library'), 'saved_link_detail')
  assert.equal(normalizeScreenPath('/recipe-card/secret-id'), 'ai_recipe_detail')
  assert.equal(normalizeScreenPath('/unknown/secret-id'), null)
  assert.deepEqual(
    sanitizeEventProperties('$screen', { $screen_name: 'library', path: '/library?q=secret' }),
    { $screen_name: 'library' }
  )
})

test('identity permits only Supabase UUIDs and resets when a user leaves', () => {
  const userId = '123e4567-e89b-42d3-a456-426614174000'
  assert.equal(isSafeSupabaseUserId(userId), true)
  assert.equal(isSafeSupabaseUserId('person@example.com'), false)
  assert.equal(getAnalyticsIdentityAction(null, userId), 'identify')
  assert.equal(getAnalyticsIdentityAction(userId, null), 'reset')
  assert.equal(getAnalyticsIdentityAction(userId, userId), 'none')
})

test('controlled test schema permits only the documented safe properties', () => {
  assert.equal(canCaptureProductEvent('posthog_test_event', true), true)
  assert.equal(canCaptureProductEvent('app_opened', true), false)
  assert.equal(canCaptureProductEvent('app_opened', false), true)
  assert.deepEqual(
    sanitizeEventProperties('posthog_test_event', {
      app_env: 'development',
      platform: 'android',
      test_source: 'settings_controlled_test',
      analytics_schema_version: ANALYTICS_SCHEMA_VERSION,
      host: 'https://us.i.posthog.com',
      api_key: 'secret',
    }),
    {
      app_env: 'development',
      platform: 'android',
      test_source: 'settings_controlled_test',
      analytics_schema_version: ANALYTICS_SCHEMA_VERSION,
    }
  )
})

test('AI report analytics keeps only the normalized category', () => {
  assert.deepEqual(
    sanitizeEventProperties('ai_recipe_report_submitted', {
      category: 'allergy_or_food_safety',
      note: 'private report note',
      recipe_title: 'private recipe title',
      recipe_card_id: '123e4567-e89b-42d3-a456-426614174000',
      source_url: 'https://example.com/private',
      ingredients: ['private ingredient'],
    }),
    { category: 'allergy_or_food_safety' }
  )
})
