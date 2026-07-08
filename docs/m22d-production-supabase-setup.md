# M22D Production Supabase Setup

This is the production setup plan for Recipe Dost before RevenueCat and Google Play Billing production work resumes. It is an audit and runbook only: do not create production env values in git, do not modify production data during this audit, and do not use development secrets in production.

## Current Development Project

- Canonical development Supabase project ref: `xvsiuwjidmkdqzkswoki`
- Development remains the only working canonical project today.
- Production must be a separate Supabase project with a different project ref, URL, anon key, service-role key, and Edge Function secret set.
- Never copy the development service-role key, worker shared secret, RevenueCat secret API key, AI provider key, or anon key into production.

## M22D.2A Status

Production Supabase project creation and database migration setup is complete based on the manual operator results provided on 2026-07-08.

- Production project ref: `cjlvkagkcfswsycsblfw`
- Migrations applied: yes
- SQL smoke tests passed: yes
- Reported errors: none
- Edge Functions deployed: no, intentionally deferred
- Production Edge Function secrets synced: no, intentionally deferred until production worker and RevenueCat values exist
- Real production env files changed by Codex: no

Remaining blockers before RevenueCat and Google Play Billing production work:

- M22D.3 production worker setup.
- Production worker URL and shared secret.
- Production RevenueCat secret API key and Android public SDK key.
- Local-only `env/production.env` filled with production values only.
- Production Supabase Edge Function secrets synced after production values exist.
- Production Edge Functions deployed and smoke-tested.

Next milestone: M22D.3 production worker setup.

## M22D.5F Production Backend/Worker Smoke Completion

Status date: 2026-07-08.

Production backend and worker smoke testing is complete based on the manual operator results provided on 2026-07-08.

- Production Supabase project ref: `cjlvkagkcfswsycsblfw`
- Production worker service: `recipe-dost-media-worker-prod`
- Production worker env group: `recipe-dost-worker-prod`
- Production app loaded against production Supabase: yes
- Anonymous auth works in production: yes
- YouTube AI recipe generation works end to end: yes
- Instagram AI recipe generation works end to end: yes
- TikTok AI recipe generation works end to end: yes
- Production app, Supabase functions, Supabase DB, Render worker, and Gemini pipeline are working end to end: yes
- Real production env files changed by Codex: no

Root cause resolved during M22D.5E: the production Render env was clean, but the worker Docker image did not include `config/worker.production.json`, so the worker fell back to runtime defaults. The worker Dockerfile now copies `config/`, and production config loads from `/service/config`.

Validated production worker health after the fix included:

- `production_config_loaded=true`
- `worker_execution_mode=queue`
- `process_job_mode=queue_wake_compatibility`
- `enable_unified_ytdlp_stream_extractor=true`
- `enable_instagram_cookies=true`
- `enable_ytdlp_cookies=true`
- `max_video_duration_seconds=120`
- `raw_url_logging_enabled=false`

Remaining blocker before store monetization release work: RevenueCat and Google Play subscription setup.

Next milestone: M22C.3 RevenueCat + Google Play billing setup.

## Production Project Settings

Create a new Supabase project for production in the Supabase dashboard.

- Project name: `Recipe Dost Production` or similarly explicit production name.
- Database major version: PostgreSQL 17, matching `supabase/config.toml`.
- API schemas exposed: `public` and `graphql_public`, matching local config.
- Data API auto-expose for new public objects: leave disabled. Migrations already create RLS policies and grants intentionally.
- API max rows: `1000`, matching local config.
- Edge Runtime: enabled.
- Storage: enabled is acceptable, but no app storage bucket is currently required by the migrations.
- Realtime: enabled is acceptable; the current MVP does not require custom realtime setup.
- Network restrictions: decide operationally after first deploy. Do not lock down database access before migrations and smoke tests are complete.

Keep the production project ref in local-only `env/production.env` as `SUPABASE_PROJECT_REF`. Do not commit that file.

## Auth Settings

Recipe Dost currently bootstraps users with Supabase anonymous auth in `src/providers/auth-provider.tsx`, so production auth must allow anonymous sign-ins.

Required dashboard settings:

- Auth enabled.
- Anonymous sign-ins enabled.
- Email auth may remain enabled, but the current MVP does not use an email sign-in flow.
- New signups enabled because anonymous sign-in creates users.
- Refresh token rotation enabled.
- JWT expiry: `3600` seconds unless a later security review intentionally changes it.
- Manual account linking disabled.
- MFA disabled for MVP.
- OAuth providers disabled unless a later milestone adds them.
- URL Configuration: set Site URL to `recipe-dost://` for the current native app scheme, and add `recipe-dost://` as an allowed redirect URL. Add a production web URL later only if a real web surface exists.

Audit note: local `supabase/config.toml` has `enable_anonymous_sign_ins = false`, but the app requires anonymous auth. Treat the dashboard setting above as required for production.

## Migrations In Order

Apply the committed migrations exactly in filename order:

1. `20260620141939_init_recipe_dost_schema.sql`
2. `20260621093000_add_cooking_preferences_to_user_profiles.sql`
3. `20260625042032_media_job_foundation.sql`
4. `20260627090000_add_media_job_metadata_storage.sql`
5. `20260701064946_m21_account_credits_foundation.sql`
6. `20260701065321_m21_protect_account_fields.sql`
7. `20260701103158_m21_7b_saved_link_metadata_bridge.sql`
8. `20260704161913_m21_11_secondary_language_preference.sql`
9. `20260705095725_m22b_revenuecat_metadata.sql`

Do not run `supabase db reset`, `supabase start`, or local Docker commands for production setup.

## Edge Functions To Deploy

Deploy these functions to production:

- `parse-url` with JWT verification disabled, matching `supabase/config.toml`.
- `save-recipe-link` with JWT verification enabled.
- `refresh-recipe-metadata` with JWT verification enabled.
- `generate-card` with JWT verification enabled.
- `create-media-job` with JWT verification enabled.
- `get-ai-access` with JWT verification enabled.
- `sync-revenuecat-entitlement` with JWT verification enabled.

Audit note: `supabase/config.toml` currently defines function config blocks for `parse-url`, `save-recipe-link`, `refresh-recipe-metadata`, `generate-card`, and `create-media-job`. `get-ai-access` and `sync-revenuecat-entitlement` exist under `supabase/functions` and are included in `npm run functions:check`, but do not yet have config blocks in `supabase/config.toml`. Deploy them explicitly and do not pass `--no-verify-jwt` for either.

## Required Supabase Secrets

Set production Edge Function secrets from local-only `env/production.env` after real production values exist:

- `REVENUECAT_API_KEY`
- `REVENUECAT_ENTITLEMENT_ID` = `premium`
- `MEDIA_WORKER_URL`
- `MEDIA_WORKER_SHARED_SECRET`

Optional production Edge Function secrets/config, only when production actually uses them:

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

Do not add service-role keys, AI provider keys, RevenueCat secret keys, worker secrets, cookies, tokens, or raw worker payload details to any `EXPO_PUBLIC_` variable. `EXPO_PUBLIC_` values are embedded in the mobile bundle.

## Storage Buckets

No required storage bucket was found in `supabase/migrations`.

The schema has media-job metadata fields such as `raw_media_storage_path`, but the current app/worker flow does not require a Supabase Storage bucket to be created during this production setup. If a later worker milestone needs buckets, add a dedicated migration and RLS/storage policy review then.

## SQL Smoke Tests

Run these in the production SQL editor after migrations. They are read-only.

```sql
show server_version;

select version
from supabase_migrations.schema_migrations
order by version;

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
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
    'media_job_events',
    'media_job_private_metadata'
  )
order by table_name;

select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
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
    'media_job_events',
    'media_job_private_metadata'
  )
order by c.relname;

select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select trigger_name, event_object_table
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
    'set_user_profiles_updated_at',
    'set_recipe_items_updated_at',
    'set_recipe_cards_updated_at',
    'set_collections_updated_at',
    'set_grocery_lists_updated_at',
    'set_usage_counters_updated_at',
    'set_subscriptions_updated_at',
    'set_support_tickets_updated_at',
    'set_media_jobs_updated_at',
    'set_media_job_private_metadata_updated_at',
    'protect_user_profile_account_fields'
  )
order by event_object_table, trigger_name;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'user_profiles'
  and column_name in (
    'role',
    'credit_balance',
    'revenuecat_app_user_id',
    'revenuecat_entitlement',
    'revenuecat_product_id',
    'revenuecat_expires_at',
    'revenuecat_store',
    'secondary_recipe_language_code',
    'cooking_preferences'
  )
order by column_name;

select id, public
from storage.buckets
order by id;
```

Expected results:

- PostgreSQL major version is 17.
- All nine migration versions appear.
- All expected public tables exist.
- RLS is enabled on all app tables.
- Policies exist for user-owned public tables, and private metadata remains service-role only.
- The account-protection and updated-at triggers exist.
- No app-specific storage bucket is required at this milestone.

## Function Smoke Tests

Use these only after functions and secrets are deployed. These commands intentionally avoid printing secrets. Replace `<PROD_REF>` with the production project ref.

Safe unauthenticated checks:

```sh
curl -i -X OPTIONS "https://<PROD_REF>.supabase.co/functions/v1/get-ai-access"
curl -i -X POST "https://<PROD_REF>.supabase.co/functions/v1/get-ai-access" \
  -H "Content-Type: application/json" \
  -d '{}'
curl -i -X POST "https://<PROD_REF>.supabase.co/functions/v1/parse-url" \
  -H "Content-Type: application/json" \
  -d '{"source_url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

Expected results:

- `OPTIONS` returns a CORS success response.
- Unauthenticated `get-ai-access` returns an auth error, proving JWT verification is not disabled.
- `parse-url` responds without requiring JWT because it is configured as the legacy unauthenticated parser.

Do not run data-writing production smoke tests such as `save-recipe-link`, `refresh-recipe-metadata`, `create-media-job`, or `sync-revenuecat-entitlement` until a human explicitly approves a disposable production test user and cleanup plan.

## Safe Production Commands

Use the installed Supabase CLI. The following commands are safe for production setup when `<PROD_REF>` is the new production project ref and you have already reviewed the dashboard settings.

First link local CLI state to production:

```sh
supabase link --project-ref <PROD_REF>
supabase migration list --linked
```

Preview migrations without applying:

```sh
supabase db push --linked --dry-run
```

Apply migrations only after the dry-run shows the expected nine migration files and no unexpected changes:

```sh
supabase db push --linked
supabase migration list --linked
```

Sync production Edge Function secrets after `env/production.env` contains only real production values:

```sh
node scripts/env/validate-env.mjs production
node scripts/env/sync-supabase-secrets.mjs production --dry-run
node scripts/env/sync-supabase-secrets.mjs production --apply
```

Deploy functions:

```sh
supabase functions deploy parse-url --project-ref <PROD_REF> --no-verify-jwt
supabase functions deploy save-recipe-link --project-ref <PROD_REF>
supabase functions deploy refresh-recipe-metadata --project-ref <PROD_REF>
supabase functions deploy generate-card --project-ref <PROD_REF>
supabase functions deploy create-media-job --project-ref <PROD_REF>
supabase functions deploy get-ai-access --project-ref <PROD_REF>
supabase functions deploy sync-revenuecat-entitlement --project-ref <PROD_REF>
```

Do not use `--prune` during the first production setup. Do not use `--include-seed` for production.

## Return Local Link Back To Development

After production migrations/deploys, point local CLI state back to the canonical development project:

```sh
supabase link --project-ref xvsiuwjidmkdqzkswoki
supabase migration list --linked
```

Confirm the linked project is development before continuing normal dev deploys.

## Production Dashboard Steps

1. Create a new Supabase project named for production.
2. Record the production project ref, API URL, and anon key into local-only `env/production.env`.
3. Keep the production service-role key out of source files and out of `EXPO_PUBLIC_` variables.
4. In Authentication, enable anonymous sign-ins and leave manual linking disabled.
5. In Authentication URL Configuration, set the native app scheme redirect to `recipe-dost://`.
6. In API settings, confirm exposed schemas are `public` and `graphql_public`, max rows is `1000`, and auto-expose for new objects remains disabled.
7. Confirm the database major version is PostgreSQL 17.
8. Apply migrations from the CLI using dry-run first.
9. Run SQL smoke tests.
10. Create real production worker, RevenueCat, and AI provider secret values outside the repo.
11. Fill local-only `env/production.env` with production values only.
12. Validate and sync Supabase secrets.
13. Deploy all required Edge Functions.
14. Run safe function smoke tests.
15. Relink the local CLI back to development.

## Remaining Blocker Before RevenueCat Production

- Production Supabase, Edge Functions, Render worker, and app smoke tests are complete for anonymous auth plus YouTube, Instagram, and TikTok AI recipe generation.
- Production RevenueCat secret API key and Android public SDK key must still be created/configured.
- Production Google Play Billing subscription products must still be configured.
- Do not change quota/access logic, the `premium` entitlement, RevenueCat offering `default`, or Test Store fallback as part of the billing setup.
