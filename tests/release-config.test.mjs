import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const require = createRequire(import.meta.url)
const configureApp = require('../app.config.js')
const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'))

function withEnvironment(values, callback) {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]])
  )

  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    return callback()
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

test('production config is the 1.0.1 code 2 Play app', () => {
  const result = withEnvironment(
    {
      APP_ENV: 'production',
      APP_VARIANT: 'production',
      EXPO_PUBLIC_SENTRY_DEV_TEST: 'false',
      EXPO_PUBLIC_POSTHOG_DEV_TEST: 'false',
      SENTRY_ORG: 'example-org',
      SENTRY_PROJECT: 'example-project',
    },
    () => configureApp({ config: {} }).expo
  )

  assert.equal(result.name, 'Recipe Dost')
  assert.equal(result.version, '1.0.1')
  assert.equal(result.android.package, 'com.recipedost.app')
  assert.equal(result.android.versionCode, 2)
  assert.equal(result.runtimeVersion, undefined)
  assert.equal(result.updates, undefined)
  assert.equal(result.extra.eas.projectId, 'bf6a2714-3cdd-4ecf-98c1-9f9b8c558bf0')
  assert.equal(result.extra.appEnv, 'production')
  assert.equal(result.extra.appVariant, 'production')
  assert.equal(result.extra.telemetryEnabled, true)
  assert.equal(result.extra.sentryTransmissionEnabled, true)
  assert.equal(result.extra.posthogTransmissionEnabled, true)
  assert.ok(
    result.plugins.some(
      (plugin) => Array.isArray(plugin) && plugin[0] === '@sentry/react-native/expo'
    )
  )
  assert.ok(result.plugins.includes('expo-font'))
})

test('production EAS profiles create a draft Internal Testing AAB release', () => {
  assert.equal(eas.cli.appVersionSource, 'local')
  assert.equal(eas.build.production.environment, 'production')
  assert.equal(eas.build.production.developmentClient, undefined)
  assert.notEqual(eas.build.production.distribution, 'internal')
  assert.equal(eas.build.production.android.buildType, 'app-bundle')
  assert.equal(eas.build.production.autoIncrement, undefined)
  assert.equal(eas.build.production.env.APP_ENV, 'production')
  assert.equal(eas.build.production.env.APP_VARIANT, 'production')
  assert.equal(eas.build.production.env.EXPO_PUBLIC_SENTRY_DEV_TEST, 'false')
  assert.equal(eas.build.production.env.EXPO_PUBLIC_POSTHOG_DEV_TEST, 'false')
  assert.equal(eas.submit.production.android.track, 'internal')
  assert.equal(eas.submit.production.android.releaseStatus, 'draft')
})

test('development config remains isolated and telemetry-off by default', () => {
  const result = withEnvironment(
    {
      APP_ENV: 'development',
      APP_VARIANT: 'development',
      EXPO_PUBLIC_SENTRY_DEV_TEST: undefined,
      EXPO_PUBLIC_POSTHOG_DEV_TEST: undefined,
      SENTRY_ORG: undefined,
      SENTRY_PROJECT: undefined,
    },
    () => configureApp({ config: {} }).expo
  )

  assert.equal(result.name, 'Recipe Dost Dev')
  assert.equal(result.android.package, 'com.recipedost.dev')
  assert.equal(result.extra.telemetryEnabled, false)
  assert.equal(result.extra.sentryTransmissionEnabled, false)
  assert.equal(result.extra.posthogTransmissionEnabled, false)
  assert.equal(
    result.plugins.some(
      (plugin) => Array.isArray(plugin) && plugin[0] === '@sentry/react-native/expo'
    ),
    false
  )
})

test('Metro uses Sentry debug-ID serialization for symbolication', () => {
  const metro = require('../metro.config.js')

  assert.equal(typeof metro.serializer?.customSerializer, 'function')
})
