# M24.1D Development Deployment and Closed-Build QA

The M24.1 database migration is already applied in development. M24.1D is
implemented locally and must not be deployed until a human performs these steps
against the development Supabase project from branch `develop`. Do not apply a
migration for this correction.

## Prerequisites

1. Confirm `git branch --show-current` prints `develop`.
2. Keep the current development RevenueCat server key, entitlement ID, and HMAC
   secret. Do not rotate or print their values for M24.1D.
3. In gitignored `env/development.env`, remove `SUPABASE_ENV_NAME` and add exactly
   `RECIPE_DOST_ENV=development`.
4. Do not add any other custom `SUPABASE_*` setting. Supabase provides its own
   server runtime variables.

## Validate and deploy manually

```sh
npm run typecheck
npm run lint:m24
npm run functions:check
npm run test:m24
npm run qa:guards
npm run env:check
git diff --check
npm run env:validate:dev
npm run env:supabase:dev:dry
```

After reviewing masked output, synchronize the allowlisted secrets and deploy the
focused function. Neither command is part of local implementation:

```sh
node scripts/env/sync-supabase-secrets.mjs development --apply
supabase functions deploy sync-revenuecat-entitlement --project-ref <DEV_PROJECT_REF>
supabase functions list --project-ref <DEV_PROJECT_REF>
```

`sync-revenuecat-entitlement` is the only function required to repair the
early-startup sync failure. `get-ai-access` and `create-media-job` do not import
that function's configuration module and were not part of the failure. Their
shared expiry logger also reads the renamed setting in source; redeploy them only
when promoting that observability-only source update:

```sh
supabase functions deploy get-ai-access --project-ref <DEV_PROJECT_REF>
supabase functions deploy create-media-job --project-ref <DEV_PROJECT_REF>
```

No worker deployment is required.

## Safe runtime verification

1. Confirm the newly deployed `sync-revenuecat-entitlement` version is receiving
   authenticated development requests.
2. In the existing closed-testing app, open Settings and tap Refresh status once.
3. Confirm `subscription_sync_started` has `environment=development` and
   `configuration_ready=true`. Do not capture or share raw identifiers.
4. Confirm a sync-state row is created or updated, then confirm exactly one safe
   completion, coalesced, or failure result event follows.
5. Confirm no `subscription_sync_configuration_error` appears. If it does, use
   only `missing_config_names` / `invalid_config_names`; never print values.
6. Confirm the binding and `user_profiles` projection update only after a valid
   RevenueCat response, then retry Generate AI Recipe using the existing build.

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
   request URLs, headers, receipts, config values, and subscriber payloads are
   absent.
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

1. Stop further function deployment and save only safe event names/statuses.
2. Roll `sync-revenuecat-entitlement` back to deployed version 10 in the Supabase
   Dashboard, or redeploy the exact pre-M24.1D commit. This restores the known
   configuration failure, so pause Premium sync testing until a corrected version
   is ready; it is containment, not a functional repair.
3. Leave `RECIPE_DOST_ENV` and the existing HMAC secret configured. Do not restore
   the reserved custom name and do not rotate secrets during rollback.
4. Leave the additive binding/sync-state schema in place. Do not drop tables or
   modify RPC signatures during an incident.
5. If the optional shared-helper functions were deployed, roll each back to its
   immediately previous version. The worker requires no rollback.
