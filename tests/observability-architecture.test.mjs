import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('one app provider owns each observability client and render failures use the helper', () => {
  const providers = read('src/providers/app-providers.tsx')
  assert.equal((providers.match(/<SentryPlaceholderProvider>/g) ?? []).length, 1)
  assert.equal((providers.match(/<PostHogPlaceholderProvider>/g) ?? []).length, 1)
  assert.equal((providers.match(/<AppErrorBoundary>/g) ?? []).length, 1)
  assert.match(read('src/providers/app-error-boundary.tsx'), /reportError\(error\)/)
})

test('auth bootstrap reports unexpected failures and clears both identities on sign-out', () => {
  const auth = read('src/providers/auth-provider.tsx')
  assert.match(auth, /reportError\(caughtError\)/)
  assert.match(auth, /identifyUser\(userId\)/)
  assert.match(auth, /setSentryUser\(userId\)/)
  assert.ok((auth.match(/resetAnalyticsUser\(\)/g) ?? []).length >= 2)
  assert.ok((auth.match(/setSentryUser\(null\)/g) ?? []).length >= 2)
})

test('share-intent save emits one normalized funnel transition per outcome', () => {
  const source = read('src/features/save-recipe/save-recipe-modal.tsx')
  assert.equal(source.includes('shared_recipe_save_started'), false)
  assert.equal(source.includes('shared_recipe_save_completed'), false)
  assert.equal(source.includes('shared_recipe_save_failed'), false)
  assert.equal((source.match(/track\("save_recipe_link_submitted"/g) ?? []).length, 1)
  assert.equal((source.match(/track\("save_recipe_link_saved"/g) ?? []).length, 1)
  assert.equal((source.match(/track\("save_recipe_link_failed"/g) ?? []).length, 2)
})

test('welcome and loading keep analytics guarded and loading components do not report errors', () => {
  const welcome = read('app/welcome.tsx')
  assert.match(welcome, /didTrackStart\.current/)
  assert.match(welcome, /completionInFlight\.current/)
  assert.equal((welcome.match(/track\('onboarding_started'\)/g) ?? []).length, 1)
  assert.equal((welcome.match(/track\(getOnboardingCompletionEvent\(outcome\)\)/g) ?? []).length, 1)
  for (const path of [
    'src/ui/app-loading-screen.tsx',
    'src/ui/loading-state.tsx',
    'src/features/home/home-loading-state.tsx',
  ]) {
    const loading = read(path)
    assert.equal(/reportError|captureException|track\(/.test(loading), false, path)
  }
})
