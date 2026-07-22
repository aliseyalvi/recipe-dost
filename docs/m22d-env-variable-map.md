# M22D Env Variable Map

This audit maps env names referenced by app code, Supabase Edge Functions, config files, M22D env scripts, and old local env candidates. Real values stay in gitignored env files and must not be printed in logs.

| Variable name | Used by file/function | Current source candidate | Target source | Secret? | Required? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `APP_ENV` | `app.config.js`, `eas.json`, `scripts/env/*` | M22D examples | mobile env / EAS | no | yes | Canonical build env. Production package/name only when `APP_ENV=production` and `APP_VARIANT=production`. |
| `APP_VARIANT` | `app.config.js`, `eas.json`, `scripts/env/*` | M22D examples | mobile env / EAS | no | yes | Canonical build variant: `development`, `preview`, or `production`. |
| `EXPO_PUBLIC_SUPABASE_URL` | `src/lib/supabase/client.ts`, `src/env.d.ts`, `scripts/env/*` | root `.env`, `supabase/.env.local`, M22D examples | mobile env / EAS | no | yes | Public Supabase URL embedded in the app bundle. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `src/lib/supabase/client.ts`, `src/env.d.ts`, `scripts/env/*` | root `.env`, M22D examples | mobile env / EAS | no | yes | Public anon key embedded in the app bundle. |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | `src/config/revenuecat.ts`, `src/env.d.ts`, `scripts/env/*` | root `.env`, M22D examples | mobile env / EAS | no | yes | Canonical RevenueCat Android public SDK key. |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | `src/config/revenuecat.ts` fallback, old root `.env` | root `.env` | deprecated | no | no | Temporary fallback only. Migrate value to `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`. |
| `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` | `src/config/revenuecat.ts`, `src/providers/revenuecat-provider.tsx`, `scripts/env/*` | root `.env`, M22D examples | mobile env / EAS | no | yes | Canonical value remains `premium`; app has `premium` fallback. |
| `EXPO_PUBLIC_REVENUECAT_OFFERING_ID` | `src/config/revenuecat.ts`, `src/providers/revenuecat-provider.tsx`, `scripts/env/*` | root `.env`, M22D examples | mobile env / EAS | no | yes | Canonical value remains `default`; app has `default` fallback. |
| `EXPO_PUBLIC_POSTHOG_API_KEY` | PostHog analytics provider and env scripts | canonical env / EAS | mobile env / EAS | no | production only | Public project token. Runtime also requires a valid HTTPS host and production gate. |
| `EXPO_PUBLIC_POSTHOG_HOST` | PostHog analytics provider and env scripts | canonical env / EAS | mobile env / EAS | no | production only | Matching HTTPS ingest origin. Preview stays disabled. |
| `EXPO_PUBLIC_POSTHOG_DEV_TEST` | PostHog analytics provider and Expo config | temporary shell only | temporary local override | no | no | Exact `true` enables one development/development controlled test. Never persist or EAS-sync. |
| `EXPO_PUBLIC_POSTHOG_KEY` | no current runtime read | old root `.env` | deprecated | no | no | Replaced by `EXPO_PUBLIC_POSTHOG_API_KEY`; validator rejects it. |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry monitoring provider and env scripts | canonical env / EAS | mobile env / EAS | no | production only | Public DSN; runtime remains fail-closed outside production or its controlled dev test. |
| `EXPO_PUBLIC_APP_ENV` | no current runtime read | old root `.env` | deprecated | no | no | Replaced by non-public `APP_ENV`. Validator rejects it. |
| `EXPO_PUBLIC_SUPABASE_KEY` | no current runtime read | `supabase/.env.local` | deprecated | no | no | Old alias. Migrate to `EXPO_PUBLIC_SUPABASE_ANON_KEY`. |
| `EXPO_PUBLIC_FREE_SAVED_LINK_LIMIT` | docs only | old root `.env` | deprecated | no | no | Stale public limit. Backend access/quota is source of truth. |
| `EXPO_PUBLIC_FREE_RECIPE_CARD_LIMIT` | docs only | old root `.env` | deprecated | no | no | Stale public limit. Backend `get-ai-access` is source of truth. |
| `EXPO_PUBLIC_FREE_GROCERY_LIST_LIMIT` | docs only | old root `.env` | deprecated | no | no | Stale public limit. Backend access/quota is source of truth. |
| `EXPO_PUBLIC_DEV_TOOLS_ENABLED` | `src/env.d.ts` only | docs | deprecated | no | no | Declared type only; no current runtime read found. |
| `SUPABASE_PROJECT_REF` | `scripts/env/sync-supabase-secrets.mjs`, `scripts/env/validate-env.mjs` | derived from Supabase URL or M22D examples | local helper | no | yes | Required target project ref for Supabase secret sync. |
| `SUPABASE_ENV_NAME` | RevenueCat sync/expiry logs and env scripts | M22D examples | Supabase config + local helper | no | yes | Required environment boundary and synced to Edge Functions. |
| `REVENUECAT_API_KEY` | `supabase/functions/sync-revenuecat-entitlement/index.ts`, `scripts/env/*` | `supabase/.env.production`, M22D examples | Supabase secret | yes | yes | Canonical server-side RevenueCat API key. Never mobile public. |
| `REVENUECAT_ENTITLEMENT_ID` | `supabase/functions/sync-revenuecat-entitlement/index.ts`, `scripts/env/*` | `supabase/.env.production`, M22D examples | Supabase config | no | yes | Canonical value remains `premium`. |
| `REVENUECAT_BINDING_HMAC_SECRET` | RevenueCat binding and safe correlation hashes | M24.1 env examples | Supabase secret | yes | yes | Distinct per environment, at least 32 characters, server-only, never logged or exposed to mobile. |
| `MEDIA_WORKER_URL` | `create-media-job`, `refresh-recipe-metadata`, `parse-url`, `scripts/env/*` | `supabase/.env.local`, `supabase/.env.production`, M22D examples | Supabase config | no | yes | Canonical worker endpoint. Do not log raw URL values. |
| `MEDIA_WORKER_SHARED_SECRET` | `create-media-job`, `refresh-recipe-metadata`, `scripts/env/*` | M22D examples, migrated from old worker secret aliases | Supabase secret | yes | yes | Canonical worker secret going forward. |
| `WORKER_API_SECRET` | `create-media-job`, `refresh-recipe-metadata` fallback | `supabase/.env.local`, `supabase/.env.production` | deprecated | yes | no | Fallback alias only. Migrate value to `MEDIA_WORKER_SHARED_SECRET`. |
| `MEDIA_WORKER_SECRET` | `create-media-job`, `refresh-recipe-metadata` fallback | `supabase/.env.production` | deprecated | yes | no | Older fallback alias only. Migrate value to `MEDIA_WORKER_SHARED_SECRET`. |
| `GEMINI_API_KEY` | `supabase/functions/generate-card/index.ts`, `scripts/env/*` optional | M22D examples | Supabase secret | yes | no | Optional legacy/internal `generate-card` provider key. Not mobile public. |
| `OPENAI_API_KEY` | `generate-card`, `supabase/config.toml`, optional sync | `supabase/.env.local` | Supabase secret | yes | no | Optional legacy/internal provider key. Mobile app must never call OpenAI directly. |
| `AI_PROVIDER` | `generate-card` | docs / optional local env | Supabase config | no | no | Optional provider selector for legacy/internal `generate-card`; defaults in code. |
| `GEMINI_MODEL` | `generate-card` | docs / optional local env | Supabase config | no | no | Optional model override; defaults in code. |
| `GEMINI_VIDEO_MODEL` | `generate-card` | docs / optional local env | Supabase config | no | no | Optional video model override; defaults to `GEMINI_MODEL`. |
| `OPENAI_MODEL` | `generate-card` | docs / optional local env | Supabase config | no | no | Optional model override for OpenAI branch. |
| `MAX_INPUT_CHARS` | `generate-card` | `supabase/.env.local` | Supabase config | no | no | Optional input-size override. |
| `FREE_AI_GENERATION_LIMIT` | `supabase/functions/_shared/ai-access.ts` | `supabase/.env.production` | Supabase config | no | no | Optional backend free quota override with fallback `3`; do not move quota logic. |
| `PREMIUM_AI_MONTHLY_LIMIT` | no current runtime read | `supabase/.env.production` | deprecated | no | no | Not read by code. Backend premium limit is hardcoded in `_shared/ai-access.ts`. |
| `PREMIUM_MONTHLY_AI_LIMIT` | `_shared/ai-access.ts`, `src/features/usage/limits.ts` code constants | code | config/code | no | yes | Not an env var. Backend source is `_shared/ai-access.ts`; mobile constant appears unused. |
| `MEDIA_PROCESSOR_MODE` | `create-media-job` | `supabase/.env.local`, `supabase/.env.production` | Supabase config | no | no | Optional worker mode. Defaults in code. |
| `WORKER_WAKE_TIMEOUT_MS` | `create-media-job` | `supabase/.env.local`, `supabase/.env.production` | Supabase config | no | no | Optional queue wake timeout. Defaults in code. |
| `METADATA_PREVIEW_TIMEOUT_MS` | `refresh-recipe-metadata` | `supabase/.env.production` | Supabase config | no | no | Optional metadata preview timeout. Defaults in code. |
| `SUPABASE_URL` | Supabase Edge Functions | Supabase platform | config/code | no | runtime | Platform-provided Edge Function env; not synced by M22D scripts. |
| `SUPABASE_ANON_KEY` | Supabase Edge Functions | Supabase platform | config/code | no | runtime fallback | Platform-provided legacy publishable key; not synced by M22D scripts. |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase Edge Functions | Supabase platform | config/code | no | runtime fallback | Platform-provided publishable key; not synced by M22D scripts. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Functions | Supabase platform, old `supabase/.env.local` | config/code | yes | runtime | Server-only platform secret. Do not put in mobile env or M22D sync allowlist. |
| `SUPABASE_SECRET_KEY` | Supabase Edge Functions | Supabase platform | config/code | yes | runtime fallback | Server-only platform secret fallback. Do not put in mobile env or M22D sync allowlist. |
| `SENTRY_AUTH_TOKEN` | no current runtime read | `.env.local` | deprecated | yes | no | Build/upload token only if Sentry upload is configured later; not part of M22D. |
| `REVENUECAT_WEBHOOK_SECRET` | no current function | `supabase/.env.local` | deprecated | yes | no | RevenueCat webhook remains deferred; not synced now. |
| `FREE_AI_CARD_LIMIT` | no current runtime read | `supabase/.env.local` | deprecated | no | no | Old name; current access uses `FREE_AI_GENERATION_LIMIT`. |
| `FREE_GROCERY_LIST_LIMIT` | no current runtime read | `supabase/.env.local` | deprecated | no | no | Old limit, not current source of truth. |
| `FREE_SAVED_LINK_LIMIT` | no current runtime read | `supabase/.env.local` | deprecated | no | no | Old limit, not current source of truth. |
| `FREE_RECIPE_CARD_LIMIT` | `generate-card` legacy function only | docs | deprecated | no | no | Legacy direct `generate-card` limit; current app access source of truth is `get-ai-access`. |
| `OPENROUTER_API_KEY` | `generate-card` optional branch | docs | deprecated | yes | no | Legacy/internal provider branch; not in M22D sync allowlist. |
| `OPENROUTER_MODEL` | `generate-card` optional branch | docs | deprecated | no | no | Legacy/internal provider branch; not in M22D sync allowlist. |
| `KIMI_API_KEY` | `generate-card` optional branch | docs | deprecated | yes | no | Legacy/internal provider branch; not in M22D sync allowlist. |
| `KIMI_MODEL` | `generate-card` optional branch | docs | deprecated | no | no | Legacy/internal provider branch; not in M22D sync allowlist. |
| `KIMI_BASE_URL` | `generate-card` optional branch | docs | deprecated | no | no | Legacy/internal provider branch; not in M22D sync allowlist. |
| `ANTHROPIC_API_KEY` | `generate-card` optional branch | docs | deprecated | yes | no | Legacy/internal provider branch; not in M22D sync allowlist. |
| `ANTHROPIC_MODEL` | `generate-card` optional branch | docs | deprecated | no | no | Legacy/internal provider branch; not in M22D sync allowlist. |

## Final Mobile Env List

- `APP_ENV`
- `APP_VARIANT`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID`
- `EXPO_PUBLIC_REVENUECAT_OFFERING_ID`

`EXPO_PUBLIC_POSTHOG_KEY` remains an obsolete wizard-era name. M22E.2A/M22E.2B now use canonical fail-closed Sentry and PostHog public variables; production values belong in the matching EAS environment, while development test overrides stay temporary.

## Final Supabase Sync List

Required:

- `REVENUECAT_API_KEY`
- `REVENUECAT_ENTITLEMENT_ID`
- `REVENUECAT_BINDING_HMAC_SECRET`
- `SUPABASE_ENV_NAME`
- `MEDIA_WORKER_URL`
- `MEDIA_WORKER_SHARED_SECRET`

Optional when present:

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

## Cleanup Result

- Created `env/development.env` locally from canonical examples plus old local env candidates, without printing values.
- Removed stale public product limits from canonical examples and validator.
- Kept `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` canonical and added temporary fallback support for old `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.
- Kept `MEDIA_WORKER_SHARED_SECRET` canonical and retained `WORKER_API_SECRET` / `MEDIA_WORKER_SECRET` only as runtime fallback aliases.
- M22E.2A/M22E.2B superseded the placeholder-era decision: Sentry and PostHog now read canonical public values through fail-closed production gates.
