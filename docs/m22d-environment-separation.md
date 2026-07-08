# M22D Environment Separation

M22C Google Play and RevenueCat production setup is paused until Recipe Dost has clean development and production environment separation. The existing Supabase project `xvsiuwjidmkdqzkswoki` is treated as development. A new production Supabase project will be created later.

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

PostHog and Sentry env values found in old local env candidates are not canonical yet because the current app providers are placeholders and do not read those env variables. Add them back only when runtime code reads them.

## Public Vs Secret Values

Any `EXPO_PUBLIC_` value is public because Expo embeds it into the mobile app bundle. Supabase anon keys and RevenueCat Android public SDK keys belong in this category. Service role keys, Gemini API keys, RevenueCat secret API keys, worker shared secrets, cookies, tokens, and raw worker payload details must never be exposed through `EXPO_PUBLIC_` variables or app logs.

The env validator fails if production envs contain obvious development values such as `com.recipedost.dev`, the development Supabase project ref, `DEV_`, or `development` outside the intentional `APP_ENV` and `APP_VARIANT` checks. It also rejects deprecated public keys such as old Expo public limits, `EXPO_PUBLIC_APP_ENV`, and `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.

## App Config Resolution

`app.config.js` reads `APP_ENV` and `APP_VARIANT`.

- Development resolves to Android package `com.recipedost.dev` and app name `Recipe Dost Dev`.
- Preview resolves to Android package `com.recipedost.dev` and app name `Recipe Dost Preview`.
- Production resolves to Android package `com.recipedost.app` and app name `Recipe Dost`.

`eas.json` sets `APP_ENV` and `APP_VARIANT` per profile. Production remains an Android App Bundle. Development and preview remain internal APK builds.

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

## Migration From Old Env Files

Treat old scattered env files as source candidates only. Do not trust `.env.production` or `supabase/.env.production` by name; either may contain development values.

For development, create `env/development.env` from `env/development.example.env` and copy only development values into it. This file becomes the canonical app repo source for development EAS public values and Supabase Edge Function secrets/config. Old `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` should be copied to `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`; old `WORKER_API_SECRET` or `MEDIA_WORKER_SECRET` should be copied to `MEDIA_WORKER_SHARED_SECRET`.

Do not fill `env/production.env` until the production Supabase project, production worker environment, and production RevenueCat/Google Play setup values exist. When it is created, it must contain production values only.

Never copy server secrets into `EXPO_PUBLIC_` variables. `EXPO_PUBLIC_` values are embedded into the mobile app bundle and must be treated as public.

Do not migrate stale public limit envs (`EXPO_PUBLIC_FREE_SAVED_LINK_LIMIT`, `EXPO_PUBLIC_FREE_RECIPE_CARD_LIMIT`, `EXPO_PUBLIC_FREE_GROCERY_LIST_LIMIT`). Backend `get-ai-access` remains the access/quota source of truth.

## M22D Next Steps

- Review the generated `env/development.env` without committing it.
- Validate and dry-run sync for development.
- Create the production Supabase project.
- Create production worker environment values.
- Create `env/production.env` only with production values.
- Dry-run EAS and Supabase sync for both environments.
- Resume Google Play and RevenueCat production setup after production Supabase and worker envs exist.
