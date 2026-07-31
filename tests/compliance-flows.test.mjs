import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import test from 'node:test'

import {
  AI_REPORT_CATEGORIES,
  AI_REPORT_NOTE_MAX_LENGTH,
  isAiReportCategory,
  normalizeAiReportNote,
} from '../src/features/ai-report/ai-report-model.ts'
import { isValidPublicHttpsUrl } from '../src/config/legal.ts'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('account deletion derives authority from the validated bearer session', () => {
  const edge = read('supabase/functions/delete-account/index.ts')
  assert.match(edge, /auth\.getUser\(\)/)
  assert.match(edge, /deleteUser\(user\.id, false\)/)
  assert.equal(edge.includes('request.json()'), false)
  assert.match(edge, /"unauthorized"/)
})

test('account deletion UI prevents duplicate taps and performs complete identity cleanup', () => {
  const screen = read('app/settings/delete-account-data.tsx')
  const auth = read('src/providers/auth-provider.tsx')
  const revenueCat = read('src/providers/revenuecat-provider.tsx')
  const revenueCatIdentity = read('src/lib/revenuecat/runtime-identity.ts')
  assert.match(screen, /deletionInFlight\.current/)
  assert.match(screen, /queryClient\.clear\(\)/)
  assert.match(screen, /clearOnboardingProfile\(\)/)
  assert.match(screen, /clearDeletedSession\(\)/)
  assert.match(screen, /Account deletion was not completed/)
  assert.match(auth, /resetAnalyticsUser\(\)/)
  assert.match(auth, /setSentryUser\(null\)/)
  assert.match(revenueCat, /resetRevenueCatIdentity\(\)/)
  assert.match(revenueCatIdentity, /Purchases\.logOut\(\)/)
})

test('Settings exposes recovery states without a production account UUID', () => {
  const settings = read('app/(tabs)/settings.tsx')
  const recovery = read('src/features/account-recovery/account-recovery-section.tsx')
  const presentation = read('src/features/settings/settings-presentation.tsx')
  assert.match(settings, /<AccountRecoverySection \/>/)
  assert.match(recovery, /Guest account/)
  assert.match(recovery, /Account secured/)
  assert.match(recovery, /maskAccountEmail/)
  assert.doesNotMatch(recovery, /user\?\.id|user\.id/)
  assert.doesNotMatch(presentation, /Anonymous Account ID/)
})

test('all user-owned app tables cascade from auth user deletion', () => {
  const migrations = allFiles('supabase/migrations')
    .map((path) => read(path))
    .join('\n')
  for (const table of [
    'user_profiles',
    'recipe_items',
    'recipe_cards',
    'collections',
    'collection_items',
    'grocery_lists',
    'usage_counters',
    'subscriptions',
    'metadata_fetch_logs',
    'support_tickets',
    'media_jobs',
    'ai_content_reports',
  ]) {
    const tableStart = migrations.indexOf(`create table if not exists public.${table}`)
    assert.notEqual(tableStart, -1, table)
    const tableDefinition = migrations.slice(tableStart, tableStart + 2500)
    assert.match(tableDefinition, /on delete cascade/, table)
  }
})

test('AI report categories, optional note normalization, and limit are strict', () => {
  assert.equal(AI_REPORT_CATEGORIES.length, 5)
  for (const category of AI_REPORT_CATEGORIES) {
    assert.equal(isAiReportCategory(category.value), true)
  }
  assert.equal(isAiReportCategory('unsafe'), false)
  assert.equal(normalizeAiReportNote('  details  '), 'details')
  assert.equal(normalizeAiReportNote('   '), null)
  assert.equal(normalizeAiReportNote('x'.repeat(600)).length, AI_REPORT_NOTE_MAX_LENGTH)
})

test('AI report backend validates ownership and stores no recipe body or source URL', () => {
  const edge = read('supabase/functions/submit-ai-report/index.ts')
  const migration = read('supabase/migrations/20260718061831_m23_ai_content_reports.sql')
  assert.match(edge, /auth\.getUser\(\)/)
  assert.match(edge, /\.eq\("user_id", user\.id\)/)
  assert.match(edge, /insertError\?\.code === "23505"/)
  assert.equal(migration.includes('source_url'), false)
  assert.equal(migration.includes('ingredients'), false)
  assert.doesNotMatch(migration, /\binstructions\s+(?:text|jsonb)/)
  assert.match(migration, /unique \(user_id, recipe_card_id, category\)/)
})

test('public legal links reject missing, non-HTTPS, credentialed, local, and placeholder hosts', () => {
  for (const value of [
    undefined,
    '',
    'http://recipe.example/privacy',
    'https://user:pass@recipe.test/privacy',
    'https://localhost/privacy',
    'https://example.com/privacy',
  ]) {
    assert.equal(isValidPublicHttpsUrl(value), false, String(value))
  }
  assert.equal(isValidPublicHttpsUrl('https://recipedost.test/privacy'), true)
})

test('legal link failures return safe in-app feedback', () => {
  const links = read('src/features/legal/legal-links.tsx')
  const settings = read('app/(tabs)/settings.tsx')
  assert.match(links, /catch \{\s*return false\s*\}/)
  assert.match(links, /Could not open \$\{labels\[type\]\}\. Please try again\./)
  assert.match(settings, /Could not open Recipe Dost support\. Please try again\./)
})

test('production env validation requires every legal URL and client source has no service-role key', () => {
  const validator = read('scripts/env/validate-env.mjs')
  for (const key of [
    'EXPO_PUBLIC_PRIVACY_POLICY_URL',
    'EXPO_PUBLIC_TERMS_URL',
    'EXPO_PUBLIC_ACCOUNT_DELETION_URL',
    'EXPO_PUBLIC_SUPPORT_URL',
  ]) {
    assert.match(validator, new RegExp(key))
  }

  const clientSource = [...allFiles('app'), ...allFiles('src')]
    .filter((path) => /\.(?:ts|tsx|js|jsx)$/.test(path))
    .map((path) => read(path))
    .join('\n')
  assert.equal(/SUPABASE_(?:SERVICE_ROLE|SECRET)_KEY/.test(clientSource), false)
})

function allFiles(directory) {
  const absolute = new URL(`../${directory}/`, import.meta.url)
  const basePath = decodeURIComponent(absolute.pathname)
  const output = []

  for (const entry of readdirSync(basePath)) {
    const path = `${basePath}${entry}`
    const relative = `${directory}/${entry}`
    if (statSync(path).isDirectory()) output.push(...allFiles(relative))
    else output.push(relative)
  }
  return output
}
