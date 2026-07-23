# Commands Log

## 2026-07-23 — M24.3A-R entitlement/eligibility separation

Executed locally on `develop`, without deployment, publication, migration,
provider calls, purchases, worker access, or secret inspection:

- Checked the current Supabase changelog; no hosted Edge Function/client breaking
  change applies to this mobile-only interpretation correction.
- `npm run lint` — passed backend and M24 mobile Deno lint plus TypeScript strict
  checking.
- `npm test` — 111 passed: 26 focused mobile/analytics, 32 Deno RevenueCat/AI
  access, 7 backend contract, and 46 compliance/observability/release tests.
- `npm run functions:check` — passed every configured Edge Function.
- `npm run qa:guards` — passed.
- `npm run env:check` — development and production templates passed with masked
  output.
- `npm run expo:config` — passed.
- `npm run doctor` — 21/21 checks passed.
- Redacted changed-file secret-pattern scan — passed; no values printed.
- `git diff --check` — passed.

Only mobile subscription state/presentation, focused tests, and milestone
documentation changed in M24.3A-R. Existing staged M24.1D/M24.3A work was
preserved.

## 2026-07-22 — M24.3A local authoritative subscription state

Executed locally on `develop`, without deployment, publication, live purchases,
provider calls, migration, worker access, or secret inspection:

- Audited installed `react-native-purchases` 10.4.0 declarations for customer
  listener add/remove, cache invalidation, customer fetch, and restore support.
- `npm run lint` — passed configured M24 Deno lint and TypeScript strict check.
- `npm test` — passed 107 tests: 22 focused mobile/analytics tests, 32 Deno
  RevenueCat/expiry tests, 7 backend contract tests, and 46 compliance/
  observability/release tests. Node emitted only the existing typeless-package
  performance warning; Deno emitted only the existing ignored
  `ignoreDeprecations` warning.
- `npm run functions:check` — passed every configured Edge Function.
- `npm run qa:guards` — passed.
- `npm run env:check` — both masked templates passed.
- `npm run expo:config` — passed.
- `npm run doctor` — 21/21 checks passed.
- Redacted changed-file secret-pattern scan — passed; no values printed.
- `git diff --check` — passed.

Android sandbox QA and creation/publication of a new binary remain human-gated in
`docs/m24-3a-subscription-mobile-qa.md`.

## 2026-07-22 — M24.1D local reserved-environment repair

Executed locally on `develop`, without deployment, migration, secret inspection,
or live RevenueCat calls:

- Targeted source/import/environment searches and reads with `rg`, `sed`, and
  `nl`.
- Read the current Supabase changelog before modifying Edge Function code.
- `npm run typecheck` — passed.
- `npm run lint:m24` — passed for nine focused files.
- `npm run functions:check` — passed for every configured Edge Function. Deno
  reported the existing ignored `ignoreDeprecations` compiler-option warning.
- `npm run test:m24` — passed: 32 Deno tests and 7 Node contract tests, 39 total.
  The Deno set includes a mocked no-body handler invocation proving missing
  configuration returns the typed HTTP 500 response before synchronization.
- `npm run qa:guards` — passed.
- `npm run env:check` — development and production templates passed with masked
  output.
- `git diff --check` — passed.

The development secret update, focused function deployment, runtime verification,
and optional shared-helper redeploy commands remain pending and are documented in
`docs/m24-revenuecat-development-deployment.md`.

## 2026-07-22 — M24.1 local implementation

Executed locally, without deployment or live RevenueCat calls:

- `git switch develop`
- `supabase --version`
- `supabase migration --help`
- `supabase migration new m24_1_revenuecat_binding_and_sync_state`
- Targeted source/document searches and reads with `rg`/`sed`

Consolidated validation:

- `npm run typecheck` — passed.
- `npm run lint:m24` — passed for seven focused files.
- `npm run functions:check` — passed for every configured Edge Function.
- `npm run test:m24` — passed: 25 Deno tests and 7 Node contract/migration
  tests, 32 total.
- `npm run qa:guards` — passed.
- `npm run env:check` — development and production templates passed with
  masked output.
- `supabase db push --dry-run --linked` — passed; would apply only
  `20260722105123_m24_1_revenuecat_binding_and_sync_state.sql`; no migration was
  applied.
- Redacted changed-file secret scan — passed for 23 files; no values printed.
- `git diff --check` — passed.

Development migration, secret sync, and function deploy commands remain pending
and are documented in `docs/m24-revenuecat-development-deployment.md`.
