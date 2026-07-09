# M22C Google Play Subscription Preflight Audit

Date: 2026-07-08

## Scope

Audit-only pass for moving Recipe Dost from RevenueCat Test Store testing toward real Google Play Billing internal testing. No app behavior, AI quota logic, entitlement name, or Test Store fallback was changed.

## Summary

Status: M22C.3B.1 Google Play verification wait-state and store prep checklist documented.

The app-side RevenueCat and backend access model is mostly ready: Supabase `user.id` is used as the RevenueCat app user ID, the entitlement remains `premium`, Test Store management fallback copy still exists, paywall plans come from RevenueCat offerings, and `get-ai-access` remains the app-facing source of truth for access/quota.

M22C.0 found release/config readiness blockers rather than quota logic blockers:

- Google Play / RevenueCat console product and base-plan setup still has to be completed manually.
- Some docs/checklist copy outside this report remains stale for M22C.

M22C.1 decisions:

- Final Android package ID: `com.recipedost.app`.
- Android `versionCode`: `1`.
- Production EAS profile added for Google Play Android App Bundle builds.
- Exact build command: `eas build --platform android --profile production`.
- Warning: the package ID must match the Google Play Console app and the RevenueCat Android app.

M22C.2 cleanup:

- Stale launch checklist subscription docs updated to entitlement `premium`, planned product IDs, base plan IDs, offering `default`, and the Google Play/RevenueCat subscription_id:base-plan-id note.
- Prompt metadata examples now use `premium` instead of old plan naming. This metadata remains descriptive only and must not grant access.
- Settings privacy copy now says Recipe Dost uses RevenueCat for subscription purchase status and subscription management metadata.

M22C.3A hardening:

- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` remains the canonical mobile RevenueCat Android public SDK key.
- Old `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` remains an app-code fallback only and is rejected by env validation when present in canonical env files.
- Production env validation now fails if `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` is a RevenueCat Test Store key.
- Development may use a RevenueCat Test Store key only for local/Test Store testing, as documented in the development env template.
- Paywall bootstrap now keeps RevenueCat customer status separate from offerings loading, so empty/missing offerings show a friendly unavailable state instead of blocking restore/status flows.
- The duplicate `Purchases.configure` warning was not reproduced from multiple app providers. App code still has one `RevenueCatProvider` and a module-level configure guard; the remaining warning is documented as likely dev reload/native SDK persistence unless it appears in a clean release build.

M22C.3B production readiness guard:

- Custom in-app developer/debug UI is hidden unless `APP_ENV=development` and `__DEV__` are both true.
- Native dev-client menu behavior is not controlled by app code and may still appear in a development client.
- Production env validation and static QA passed after production RevenueCat env correction.

M22C.3B.1 wait-state:

- Google Play developer identity/phone verification is an external blocker.
- Production EAS Android App Bundle build has been started and is queued.
- No app logic, quota/access logic, RevenueCat entitlement, package IDs, real env files, or Test Store fallback changed in this documentation pass.

M22E.0A release workflow guard:

- Production backend, worker, RevenueCat, Google Play internal testing, and sandbox purchase are working.
- `main` is production-stable and `develop` is daily development.
- M22E bug fixes happen on `develop` first, then merge to `main` after QA.
- Production AAB builds use `npm run build:prod` from `main` only unless `ALLOW_NON_MAIN_PROD_BUILD=1` is set for an emergency.
- Development and preview builds use development env and normally run from `develop`.
- Custom env files are loaded only through `scripts/env/*`; do not manually source `env/production.env` in a normal terminal.

## Current Android Package ID

Source: `app.config.js`

Current Android package ID:

```text
com.recipedost.app
```

Readiness: package ID finalized for the first Google Play upload. This value must match Google Play Console and the RevenueCat Android app. Once uploaded to Google Play, the package ID is permanent for that Play app.

Android versioning:

- `expo.version`: `1.0.0`
- `android.versionCode`: `1`

## EAS Profiles and AAB Readiness

Source: `eas.json`

Current profiles:

| Profile | Distribution | Android output | Play Store AAB ready |
| --- | --- | --- | --- |
| `development` | `internal` | `apk` | No |
| `preview` | `internal` | `apk` | No |
| `production` | store/default | `app-bundle` | Yes |

Build command:

```sh
npm run build:prod
```

Current release stance: create the next production AAB only through the guarded M22E flow, then upload it to Google Play internal testing as an update.

## Google Play Verification Wait-State

External blocker:

- Google Play developer account identity/phone verification is pending. App creation, internal testing upload, subscription setup, or other Console actions may be blocked until Google approves the account.

Work that can continue while waiting:

- Store listing copy: app name, short description, full description, support contact, and subscription disclosure copy.
- Screenshots: prepare 6 Android screenshots from a production-configured build or final visual QA flow.
- Privacy policy: publish or verify the live URL.
- Data safety draft: prepare answers for account data, analytics, subscription purchase status, AI-generated content, and link/metadata processing.
- App access instructions: document anonymous-first access and any tester steps needed for review.
- Content rating draft: prepare questionnaire answers and avoid medical/diet/weight-loss claims.
- RevenueCat product plan: keep entitlement `premium`, offering `default`, products `recipe_dost_premium_monthly` and `recipe_dost_premium_yearly`, and base plans `monthly-autorenewing` and `yearly-autorenewing`.

Work blocked until verification if Google Play Console blocks access:

- Creating the Play app or uploading the internal-test AAB.
- Creating Play subscriptions and base plans.
- Importing Google Play products into RevenueCat.
- Running the sandbox/internal-test purchase and restore test.

Readiness stance: stay in store-prep mode until Google Play verification clears, then resume Console setup and purchase testing.

## RevenueCat Environment Variables

Mobile/public config:

- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID`, defaults to `premium`
- `EXPO_PUBLIC_REVENUECAT_OFFERING_ID`, defaults to `default`
- Deprecated fallback only: `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`

Backend/Supabase Edge Function config:

- `REVENUECAT_API_KEY`
- `REVENUECAT_ENTITLEMENT_ID`, defaults to `premium`

Android-specific RevenueCat key support: yes. `src/config/revenuecat.ts` exposes `REVENUECAT_ANDROID_API_KEY`, and `src/providers/revenuecat-provider.tsx` configures Purchases only on Android with that key.

iOS-specific RevenueCat key support: no, and that is acceptable for the current Android-first milestone.

Production safety: `scripts/env/validate-env.mjs production` rejects RevenueCat Test Store Android public SDK keys. Use a real Google Play-backed RevenueCat Android public SDK key for production builds.

Development safety: `env/development.example.env` documents that a RevenueCat Test Store key is allowed only for development/Test Store testing. Register Test Store products manually in RevenueCat when using that key.

## Entitlement and Product Readiness

Required entitlement:

```text
premium
```

Current code default: `premium`.

Planned Google Play products:

- `recipe_dost_premium_monthly`
- `recipe_dost_premium_yearly`

Planned base plans:

- `monthly-autorenewing`
- `yearly-autorenewing`

Paywall product matching currently supports the planned product IDs and also keeps legacy fallbacks:

- Monthly: `recipe_dost_premium_monthly` or `recipe_dost_monthly`
- Yearly: `recipe_dost_premium_yearly` or `recipe_dost_annual`

Readiness: planned product IDs are already supported in the app, but console setup must ensure these products are attached to the RevenueCat `premium` entitlement through the active offering.

## Test Store Fallback

Test Store fallback still exists and was not removed.

Files:

- `app/paywall.tsx`
- `app/(tabs)/settings.tsx`

When `customerInfo.managementURL` is missing or cannot be opened, the app tells the user that real Google Play subscriptions use store subscription management and Test Store purchases are managed from the RevenueCat test customer.

## RevenueCat Identity

Supabase `user.id` remains the RevenueCat app user ID.

Evidence:

- `src/providers/revenuecat-provider.tsx` calls `Purchases.configure({ apiKey: androidApiKey, appUserID: user.id })`.
- On user changes, it calls `Purchases.logIn(user.id)`.
- `supabase/functions/sync-revenuecat-entitlement/index.ts` fetches RevenueCat subscriber data by the authenticated Supabase `user.id` and writes `revenuecat_app_user_id: user.id`.

Readiness: pass.

## Paywall Offerings and Empty States

Paywall depends on RevenueCat offerings correctly.

Evidence:

- `src/providers/revenuecat-provider.tsx` calls `Purchases.getOfferings()`.
- It selects `offerings.all[REVENUECAT_OFFERING_ID] ?? offerings.current`.
- It exposes `currentOffering?.availablePackages ?? []`.
- `app/paywall.tsx` renders monthly/yearly plan cards from the returned packages and uses `selectedPackage.product.priceString`.

Offering/package empty states are handled.

Evidence:

- Not configured: `Plans unavailable right now` with Retry.
- Loading: `Loading Premium plans...`.
- Empty packages: `Plans unavailable right now` with Retry and Restore purchases.
- Provider offerings errors set a friendly `Plans unavailable right now` message.
- Provider startup loads `CustomerInfo` separately from offerings, so an empty/missing offering does not prevent local entitlement status refresh or backend sync.

Readiness: pass, assuming RevenueCat console offering/package setup is correct.

## Restore/Refresh Downgrade Risk

Restore/refresh should not accidentally downgrade backend-active Premium in the current app flow.

Evidence:

- `app/paywall.tsx` restore flow restores, refreshes CustomerInfo, invalidates/refetches `get-ai-access`, and checks backend Premium before showing no-subscription copy.
- `app/(tabs)/settings.tsx` restore flow follows the same backend refetch pattern.
- `src/features/subscription/normalized-subscription-status.ts` treats backend `plan === 'premium'` / `premiumActive` as the display source of truth.
- `supabase/functions/sync-revenuecat-entitlement/index.ts` preserves existing active Premium on malformed/missing entitlement data, identity mismatch, and uncertain RevenueCat responses.

Remaining risk: if RevenueCat/Google Play console products are not attached to the `premium` entitlement, the backend sync can receive a definitive inactive entitlement for the same app user ID and correctly write inactive. That is a console setup risk, not a mobile quota logic change.

## Access and Quota Source of Truth

`get-ai-access` remains the source of truth for app access/quota.

Evidence:

- `src/lib/api/ai-access.ts` invokes `get-ai-access`.
- `app/paywall.tsx`, `app/(tabs)/settings.tsx`, `app/recipe/[id].tsx`, and `src/features/dev-tools/dev-identity-panel.tsx` read `getAiAccessState`.
- `src/features/subscription/normalized-subscription-status.ts` prioritizes backend Premium state over local RevenueCat state.

Free users still get 3 successful AI recipe generations total, and Premium beta users get 100 successful AI recipe cards/month through the backend access helper. No AI quota logic was changed in this audit.

## Backend Function Call Sites

`sync-revenuecat-entitlement` mobile call site:

- `src/lib/api/premium-entitlement.ts`

`syncPremiumEntitlement()` consumers:

- `src/providers/revenuecat-provider.tsx`
- `app/paywall.tsx`
- `app/(tabs)/settings.tsx`
- `app/recipe/[id].tsx`

`get-ai-access` mobile call site:

- `src/lib/api/ai-access.ts`

`getAiAccessState()` consumers:

- `app/paywall.tsx`
- `app/(tabs)/settings.tsx`
- `app/recipe/[id].tsx`
- `src/features/dev-tools/dev-identity-panel.tsx`

## User-Facing Copy: Disallowed Plan Terms

App/source scan result: no disallowed old plan or limitless-usage copy found in `app` or `src`.

Stale docs found in M22C.0 and cleaned in M22C.2:

- Done: `docs/launch-checklist.md` now uses entitlement `premium`.
- Done: `docs/launch-checklist.md` now lists `recipe_dost_premium_monthly` and `recipe_dost_premium_yearly`.
- Done: `docs/launch-checklist.md` now lists `monthly-autorenewing` and `yearly-autorenewing`.
- Done: `docs/ai-prompt-contract.md` now uses `subscription_status: free | premium` as prompt metadata only.

These docs should be patched in M22C, but they are not current app UI copy.

## Unsafe Logs

No unsafe RevenueCat/mobile access logs were found in the audited app paths.

`scripts/qa-static-guards.mjs` checks app/source files for:

- forbidden old plan or limitless-usage copy
- sensitive `console.log(...)` patterns for `customerInfo`, purchase tokens, source URLs, CDN URLs, worker payloads
- committed real-looking secret assignments
- obvious RevenueCat lifecycle side effects in render paths

Backend functions contain structured logs outside the RevenueCat sync path, but this audit did not find raw RevenueCat `customerInfo`, purchase tokens, direct AI provider keys, full source URLs, CDN URLs, or worker secrets being logged by the mobile RevenueCat/paywall/settings/access surfaces.

## Exact Files That Need Patching for M22C

Required before a Play Store internal testing AAB:

- Done in M22C.1: `app.config.js` finalizes Android package ID as `com.recipedost.app`.
- Done in M22C.1: `app.config.js` adds `android.versionCode: 1`.
- Done in M22C.1: `eas.json` adds `production` with Android `buildType: "app-bundle"`.
- Done in M22C.2: `docs/launch-checklist.md` subscription docs cleanup.
- Done in M22C.2: `app/settings/privacy-data.tsx` RevenueCat privacy wording cleanup.

Recommended hardening after console setup is verified:

- `app/paywall.tsx`: decide whether to keep or remove legacy product fallbacks `recipe_dost_monthly` and `recipe_dost_annual`. Keeping them is useful for Test Store/legacy fallback; removing them reduces drift once Google Play products are confirmed.
- `scripts/qa-static-guards.mjs`: optionally add a config/docs drift guard for `premium`, the two planned Google Play product IDs, and old plan-name absence in release checklist docs.
- Done in M22C.2: `docs/ai-prompt-contract.md` prompt metadata cleanup.
- Done in M22C.3A: `scripts/env/validate-env.mjs` rejects Test Store keys in production.
- Done in M22C.3A: `app/paywall.tsx` keeps Restore purchases visible when configured offerings/packages are unavailable.
- Done in M22C.3A: `src/providers/revenuecat-provider.tsx` decouples customer-info bootstrap from offerings bootstrap.

No patch recommended:

- `src/config/revenuecat.ts`: current env var names and `premium`/`default` fallbacks are correct for M22C.
- `src/lib/api/ai-access.ts`: source-of-truth access call is in place.
- `src/lib/api/premium-entitlement.ts`: mobile sync call site is in place.
- `supabase/functions/sync-revenuecat-entitlement/index.ts`: server-side identity and uncertainty safeguards are in place for the audited flow.

## Manual Console Steps That Cannot Be Done by Code

Google Play Console:

1. Wait for Google Play developer identity/phone verification if Console blocks app creation or upload.
2. Create/select the Google Play app with package ID `com.recipedost.app`.
3. Confirm the package ID exactly matches the RevenueCat Android app. Once uploaded, the package name is permanent for that Play app.
4. Complete required Play app setup for internal testing, including app access, data safety/subscription disclosures, content rating, target audience, privacy policy, and tester access.
5. Upload the queued/successful production Android App Bundle to an internal testing track.
6. Create subscription products:
   - `recipe_dost_premium_monthly`
   - `recipe_dost_premium_yearly`
7. Create and activate base plans:
   - `monthly-autorenewing`
   - `yearly-autorenewing`
8. Confirm pricing, renewal period, availability, tax/compliance prompts, and active status.
9. Add internal testers/license testers and confirm they can install the Play build.

RevenueCat Console:

1. Add/link the Google Play app to the RevenueCat project.
2. Confirm the RevenueCat Android app uses package ID `com.recipedost.app`.
3. Connect Google Play service credentials/API access as required by RevenueCat.
4. Import or create the Google Play products above.
5. Confirm entitlement key remains exactly `premium`.
6. Attach both products to the `premium` entitlement.
7. Confirm offering key remains `default` or update `EXPO_PUBLIC_REVENUECAT_OFFERING_ID` consistently.
8. Add monthly/yearly packages to the active offering.
9. Copy the real Android public SDK key into the production app build environment as `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`; do not use a Test Store key for production.
10. Verify a real Google Play internal-test purchase produces an active `premium` entitlement for the Supabase user ID shown in Settings developer tools.

Supabase / EAS environment:

1. Set Supabase Edge Function secret `REVENUECAT_API_KEY`.
2. Set Supabase Edge Function secret `REVENUECAT_ENTITLEMENT_ID=premium` if not relying on the default.
3. Ensure EAS build environment has `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`.
4. Deploy `sync-revenuecat-entitlement` if the currently deployed function is older than the M22B.3 safeguards.

Release workflow:

1. Complete M22E bug fixes on `develop`.
2. Run QA and env doctor commands against development.
3. Merge `develop` to `main` after QA.
4. Run `npm run env:doctor:prod` on `main`.
5. Run `npm run build:prod` on `main`.
6. Upload the resulting AAB to Google Play internal testing.

## Validation

Passed in M22C.0: `npm run qa:static`

Passed in M22C.1:

- `npm run qa:static`
- `npx expo config --json >/dev/null`

Passed in M22C.2:

- `npm run qa:static`

M22C.3A validation:

- `npm run qa:static`
- `node scripts/env/validate-env.mjs development`
- `node scripts/env/validate-env.mjs production` failed as intended because the local production env still uses a RevenueCat Test Store Android public SDK key. Do not edit the real env file in code review; replace it manually with the real Google Play-backed RevenueCat Android public SDK key before production build.

M22C.3B validation:

- `npm run qa:static`
- `node scripts/env/run-with-env.mjs production -- npx expo config --json >/dev/null`
- Production env validation passed after production RevenueCat env correction.

M22C.3B.1 validation:

- `npm run qa:static`
