# M22D Environment Separation

M22C Google Play and RevenueCat production setup was paused until Recipe Dost had clean development and production environment separation. The existing Supabase project `xvsiuwjidmkdqzkswoki` is treated as development. The production Supabase project `cjlvkagkcfswsycsblfw` has been created, database migrations passed SQL smoke tests, and production app/backend/worker smoke tests passed for YouTube, Instagram, and TikTok AI recipe generation. RevenueCat production values and Google Play Billing setup remain pending.

## Source Of Truth

Local env files are the source of truth and are intentionally gitignored:

- `env/development.env`
- `env/production.env`
- `.env`
- `.env.local`
- `.env.development`
- `.env.production`
- `.env.*.local`

Committed templates show the required shape without real values:

- `env/development.example.env`
- `env/production.example.env`

If `.env.production` exists locally, do not trust the filename. It may contain development values from earlier setup. Migrate those values manually into `env/development.env`, then create a clean `env/production.env` only after the production Supabase project, worker, and RevenueCat production values exist.

## Branch Model

Recipe Dost uses a simple release branch model:

- `main` is production-stable.
- `develop` is daily development.
- M22E bug fixes start on `develop` first.
- Release flow is `develop` QA, merge to `main`, production build from `main`, then Google Play internal update.

Production Android App Bundle builds must run from `main`. The build script refuses production builds from any other branch unless `ALLOW_NON_MAIN_PROD_BUILD=1` is set for an emergency. Development and preview builds normally run from `develop`; other branches warn but do not fail.

## App Repo Keys

EAS public/app variables:

- `APP_ENV`
- `APP_VARIANT`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID`
- `EXPO_PUBLIC_REVENUECAT_OFFERING_ID`

Supabase Edge Function secrets:

- `REVENUECAT_API_KEY`
- `REVENUECAT_ENTITLEMENT_ID`
- `MEDIA_WORKER_URL`
- `MEDIA_WORKER_SHARED_SECRET`

Optional Supabase Edge Function secrets/config, synced only when present:

- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `AI_PROVIDER`
- `GEMINI_MODEL`
- `GEMINI_VIDEO_MODEL`
- `OPENAI_MODEL`
- `MAX_INPUT_CHARS`
- `FREE_AI_GENERATION_LIMIT`
- `MEDIA_PROCESSOR_MODE`
- `WORKER_WAKE_TIMEOUT_MS`
- `METADATA_PREVIEW_TIMEOUT_MS`

Local-only helper variables:

- `SUPABASE_PROJECT_REF`
- `SUPABASE_ENV_NAME` optional label for human/operator clarity

The RevenueCat entitlement remains `premium`, the offering remains `default`, and the planned Google Play products remain `recipe_dost_premium_monthly` and `recipe_dost_premium_yearly` with base plans `monthly-autorenewing` and `yearly-autorenewing`.

M22E.2A/M22E.2B superseded the original placeholder audit: Sentry and PostHog now use canonical public production variables behind fail-closed runtime gates. Development test overrides are temporary and preview remains disabled.

## Public Vs Secret Values

Any `EXPO_PUBLIC_` value is public because Expo embeds it into the mobile app bundle. Supabase anon keys and RevenueCat Android public SDK keys belong in this category. Service role keys, Gemini API keys, RevenueCat secret API keys, worker shared secrets, cookies, tokens, and raw worker payload details must never be exposed through `EXPO_PUBLIC_` variables or app logs.

The env validator fails if production envs contain obvious development values such as `com.recipedost.dev`, the development Supabase project ref, `DEV_`, or `development` outside the intentional `APP_ENV` and `APP_VARIANT` checks. It also rejects deprecated public keys such as old Expo public limits, `EXPO_PUBLIC_APP_ENV`, and `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.

## App Config Resolution

`app.config.js` reads `APP_ENV` and `APP_VARIANT`.

- Development resolves to Android package `com.recipedost.dev` and app name `Recipe Dost Dev`.
- Preview resolves to Android package `com.recipedost.dev` and app name `Recipe Dost Preview`.
- Production resolves to Android package `com.recipedost.app` and app name `Recipe Dost`.

`eas.json` sets `APP_ENV` and `APP_VARIANT` per profile. Production remains an Android App Bundle. Development and preview remain internal APK builds.

## Local App Launch

Do not run `npx expo start` directly for Recipe Dost. Expo/Metro does not automatically load custom files such as `env/development.env`, so direct launches can miss `EXPO_PUBLIC_*` values.

Use:

```sh
npm run dev:android
```

This runs `scripts/env/run-with-env.mjs`, loads `env/development.env`, and then starts Expo with `npx expo start --dev-client --clear`.

Production smoke launch is intentionally explicit:

```sh
npm run dev:android:prod-smoke
```

This loads `env/production.env` through the script loader. Do not manually source production env in a normal terminal session.

You can use the loader for one-off commands too:

```sh
node scripts/env/run-with-env.mjs development -- npx expo config --json
```

## Validation

Template validation, safe for CI and commits:

```sh
npm run env:check
```

Real local env validation after creating gitignored files:

```sh
node scripts/env/validate-env.mjs development
node scripts/env/validate-env.mjs production
```

Operator-safe env summaries:

```sh
npm run env:doctor:dev
npm run env:doctor:prod
```

The env doctor verifies the env file exists, runs validation, and prints only `APP_ENV`, `APP_VARIANT`, Supabase project ref or URL host, RevenueCat key type, Expo-resolved Android package, and current Git branch. It must not print secret values.

## EAS Sync Flow

Dry-run EAS sync prints only allowlisted key names:

```sh
npm run env:eas:dev:dry
npm run env:eas:prod:dry
```

Apply is intentionally manual:

```sh
node scripts/env/sync-eas-env.mjs development --apply
node scripts/env/sync-eas-env.mjs production --apply
```

The script writes a temporary allowlisted env file, runs `eas env:push <environment> --path <temp-file> --force`, then deletes the temporary file. Backend secrets are never included in the EAS public env sync.

## Supabase Secrets Sync Flow

Dry-run Supabase sync prints only secret/config key names:

```sh
npm run env:supabase:dev:dry
npm run env:supabase:prod:dry
```

Apply is intentionally manual:

```sh
node scripts/env/sync-supabase-secrets.mjs development --apply
node scripts/env/sync-supabase-secrets.mjs production --apply
```

The script requires `SUPABASE_PROJECT_REF`, writes required Edge Function secrets/config plus optional present allowlisted values to a temporary env file, runs `supabase secrets set --env-file <temp-file> --project-ref <SUPABASE_PROJECT_REF>`, then deletes the temporary file.

`MEDIA_WORKER_SHARED_SECRET` is the canonical worker secret name for this source-of-truth flow. Current Edge Functions prefer it while retaining the older worker secret names as temporary fallback during migration.

## Build Commands

Development and preview builds validate the app, sync EAS public vars and Supabase Edge Function secrets/config from `env/development.env`, then run the EAS Android build:

```sh
npm run build:dev
npm run build:preview
```

For future production, use only:

```sh
npm run build:prod
```

Production builds are guarded. The script requires branch `main`, requires `env/production.env`, validates it, refuses the known development Supabase project ref, refuses RevenueCat Test Store Android keys, syncs production env, and then builds the Android App Bundle. Use `npm run build:prod:dry` first to validate and dry-run production env sync without building.

Emergency override for a production build from a non-`main` branch must be explicit:

```sh
ALLOW_NON_MAIN_PROD_BUILD=1 npm run build:prod
```

## Migration From Old Env Files

Treat old scattered env files as source candidates only. Do not trust `.env.production` or `supabase/.env.production` by name; either may contain development values.

For development, create `env/development.env` from `env/development.example.env` and copy only development values into it. This file becomes the canonical app repo source for development EAS public values and Supabase Edge Function secrets/config. Old `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` should be copied to `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`; old `WORKER_API_SECRET` or `MEDIA_WORKER_SECRET` should be copied to `MEDIA_WORKER_SHARED_SECRET`.

Do not fill `env/production.env` until the production Supabase project, production worker environment, and production RevenueCat/Google Play setup values exist. When it is created, it must contain production values only.

Never copy server secrets into `EXPO_PUBLIC_` variables. `EXPO_PUBLIC_` values are embedded into the mobile app bundle and must be treated as public.

Do not migrate stale public limit envs (`EXPO_PUBLIC_FREE_SAVED_LINK_LIMIT`, `EXPO_PUBLIC_FREE_RECIPE_CARD_LIMIT`, `EXPO_PUBLIC_FREE_GROCERY_LIST_LIMIT`). Backend `get-ai-access` remains the access/quota source of truth.

## M22D Next Steps

- Production Supabase project creation and migrations are complete.
- Production app/backend/worker smoke tests are complete for anonymous auth plus YouTube, Instagram, and TikTok AI recipe generation.
- Production worker config loading issue is resolved: the worker Docker image now includes `config/`, and production config loads from `/service/config`.
- Keep real env files local-only and gitignored; do not commit production secrets.
- Resume Google Play and RevenueCat production setup.

Next milestone: M22C.3 RevenueCat + Google Play billing setup.
