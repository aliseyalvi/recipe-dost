# M24.1 Development Deployment and Closed-Build QA

M24.1 is implemented locally and must not be deployed until a human performs
these steps against the development Supabase project from branch `develop`.

## Prerequisites

1. Confirm `git branch --show-current` prints `develop`.
2. Keep the current development RevenueCat server key and entitlement ID.
3. Generate a distinct random HMAC secret of at least 32 characters outside
   captured logs, for example with `openssl rand -hex 32` in a private terminal.
4. Put it only in gitignored `env/development.env` as
   `REVENUECAT_BINDING_HMAC_SECRET`. Do not paste it into tickets or logs.
5. Confirm `SUPABASE_ENV_NAME=development` in that local file.

## Validate and deploy manually

```sh
npm run typecheck
npm run lint:m24
npm run test:m24
npm run functions:check
npm run env:validate:dev
npm run env:supabase:dev:dry
supabase db push --dry-run --linked
```

After reviewing the dry runs:

```sh
supabase db push --linked
node scripts/env/sync-supabase-secrets.mjs development --apply
supabase functions deploy sync-revenuecat-entitlement
supabase functions deploy get-ai-access
supabase functions deploy create-media-job
supabase functions list
```

The migration must precede the function deployment. `get-ai-access` and
`create-media-job` must both be redeployed because they bundle the changed shared
expiry helper. Do not deploy the media worker.

## Existing closed-build manual test

Use the already-installed closed-testing binary pointed at development. Do not
build or publish a new binary.

1. On an existing development profile with an active test Premium purchase,
   open Settings and tap Refresh status once.
2. Confirm Premium AI access becomes active and the usage display shows the
   existing monthly quota rather than the exhausted free quota.
3. Return to an exhausted saved-recipe profile and tap Generate AI Recipe.
4. If the old binary first asks to retry after synchronization, tap Generate
   once more. Confirm `create-media-job` authorizes and queues exactly one job.
5. Trigger Refresh and Generate close together. Confirm one provider sync is
   logged and the other call returns `sync_status=in_progress`; no null-only
   failure should be introduced by the backend.
6. Tap Restore purchases. Confirm the same bound user verifies successfully.
7. Inspect Edge logs only through structured event names. Confirm identifiers,
   request URLs, headers, receipts, and subscriber payloads are absent.
8. Let a Test Store entitlement expire or use a dedicated inactive test
   customer, then Refresh. Confirm the backend returns Free and does not retain
   stale Premium.

Alias/reinstall testing must use a disposable development profile because the
current anonymous app has no recipe-data recovery. On that disposable profile:

1. Establish a test purchase under the first anonymous profile.
2. Record no raw ID in shared evidence.
3. Clear app data, let the closed build create a new anonymous Supabase user,
   then tap Restore purchases.
4. If RevenueCat resolves the new UUID as an alias to an unbound customer, the
   binding is created and Premium synchronizes.
5. If the customer is already bound to the previous Supabase user, expect
   `revenuecat_binding_conflict`; do not transfer entitlement or old data.

## Rollback

1. Stop further M24.1 function deployment.
2. Redeploy the previous `develop` versions of
   `sync-revenuecat-entitlement`, `get-ai-access`, and `create-media-job`.
3. Leave the additive binding/sync-state tables in place; the previous functions
   do not use them. Do not drop tables during an incident.
4. The unused HMAC secret may remain, or a human may remove it after confirming
   all M24.1 functions are rolled back.
5. Re-run the existing Free/Premium access smoke test. The worker requires no
   rollback because it was not changed.
