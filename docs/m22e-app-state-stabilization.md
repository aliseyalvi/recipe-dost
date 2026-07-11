# M22E App State Stabilization

Date: 2026-07-10

## Scope

Audit-only pass for onboarding launch routing and stale Home/Library metadata state after Play-installed production QA. No runtime behavior, quota/access logic, RevenueCat entitlement, backend/worker behavior, package IDs, or real env files were changed.

Current branch workflow is correct for this milestone: M22E fixes are prepared on `develop`, then merged to `main` only after QA for a production AAB update.

## M22E.1D App-Side Search and UX Polish

Status: implemented on `develop`; device QA pending.

Scope shipped:

- Improved Library search over already-fetched app data; no backend search, RLS, schema, worker, quota/access, RevenueCat, package ID, or env changes.
- AI-generated tags already stored in `recipe_cards.tags_json` are now exposed in list normalization and displayed as chips on the AI recipe detail screen.
- Library search now covers saved-link title, source URL, source metadata title/description/author/platform/host, platform, notes/caption/manual ingredients, cuisine, meal type, AI recipe title/summary, AI tags, AI ingredients, and AI steps.
- Saved-link detail now gives stronger "Open Original Video" placement and clearer copy that metadata/AI processing can continue while the user leaves the screen.
- Paywall now includes a Free vs Premium benefit comparison without changing products, entitlement, or limits.

Favorite/unfavorite, delete with confirmation, manual tags, and any schema-backed favorites/tags are deferred. The audit found `recipe_cards.tags_json` already exists, but `recipe_items` does not currently have an `is_favorite` column. A future favorites slice should add the smallest safe `recipe_items.is_favorite boolean default false` migration only after dev QA approval, then update Supabase generated types and guarded user-owned mutations. Delete can likely use the existing user-owned `recipe_items` delete policy and cascade relationships, but should ship with explicit confirmation copy and list invalidation in a separate low-risk patch.

M22E.1D manual QA checklist:

- Generate a new AI recipe and verify tags appear on the AI recipe detail screen when the card includes `tags_json`.
- Open an existing AI recipe without tags and confirm the detail screen still opens cleanly.
- Search by saved-link title.
- Search by AI recipe title.
- Search by ingredient.
- Search by step text.
- Search by tag.
- Search by platform/source metadata.
- Save/share a link, start AI generation, leave the detail screen while processing, and confirm Home/Library eventually show the completed card.
- Confirm "Open Original Video" is easy to find on saved-link and AI recipe detail.
- Open paywall and confirm the Free vs Premium comparison preserves Free = 3 successful AI generations, Premium = 100 AI recipes/month, and 2-minute beta video length.
- Confirm paywall purchase/restore visibility and Premium entitlement name remain unchanged.
- Fresh install onboarding check remains pending device QA from M22E.1A.

## M22E.1E Processing and Paywall Polish

Status: implemented on `develop`; device QA pending.

Scope shipped:

- AI generation progress now has explicit "Go back to Home/Library" and "Wait here" actions.
- The leave action keeps the current background-job model and relies on existing Home/Library query refresh to show the completed card.
- The wait action stays on the detail screen and refetches the current recipe/media-job queries.
- Saved-link metadata copy now separates saving, pending preview, and failed preview states.
- Paywall comparison copy now clarifies that free users get 3 total AI recipe cards and unlimited saved links; ingredients, steps, and grocery lists apply to generated AI cards.
- Paywall usage clarity uses the existing `get-ai-access` query already present on the paywall; no new backend call was added.
- Tag QA note: M22E.1D app UI can only display/search tags when `recipe_cards.tags_json` is populated. Empty tags on newly generated cards should be handled in a separate prompt/Edge Function contract patch, not in this app-side processing/paywall polish.

M22E.1E manual QA checklist:

- Start AI generation and wait on the detail screen until completion.
- Start AI generation, tap Go back to Home/Library, and confirm the card updates in the list.
- Start AI generation, tap Wait here, and confirm the progress state remains visible.
- Close/reopen during processing and confirm Home/Library refresh.
- Force or observe a failed AI job and confirm friendly failure plus retry behavior.
- Save a link with pending metadata and confirm the saved-link detail says "Preparing preview...".
- Force or observe metadata failure and confirm retry details remains available.
- Open paywall as a free user and confirm the comparison does not imply unlimited ingredient/step generation.
- Open paywall as Premium and confirm active state, manage/restore controls, products, and entitlement behavior are unchanged.

## Fresh Install Expected State Machine

1. Native app launches and `app/_layout.tsx` renders `AppProviders`.
2. `AuthProvider` runs before route content. It calls `getSession()` from Supabase auth storage.
3. If no persisted session exists, `signInAnonymously()` creates a Supabase anonymous user.
4. `/` runs `useUserProfileQuery()` with key `['user-profile', user.id]`.
5. If there is no `user_profiles` row, or the row has `onboarding_completed = false`, `/` redirects to `/welcome`.
6. `/welcome` repeats the profile query guard. It shows the welcome screen only while `onboarding_completed` is not true.
7. Tapping Start Free routes to `/onboarding` and tracks `onboarding_started`.
8. `/onboarding` writes selections to the persisted Zustand/SecureStore onboarding store as the user answers.
9. Finish Setup calls `saveOnboardingProfile()`, upserts `user_profiles`, sets `onboarding_completed = true`, invalidates `['user-profile', user.id]`, tracks `onboarding_completed`, and routes to `/home`.

Fresh install expectation: a real clean install with no restored SecureStore session and no existing anonymous user profile should show `/welcome` before onboarding.

## Returning User Expected State Machine

1. Native app launches.
2. Supabase auth loads the persisted anonymous session from SecureStore.
3. `/` queries `user_profiles` for that session's `user.id`.
4. If `onboarding_completed = true`, `/` redirects to `/home`.
5. If `onboarding_completed = false` or the row is missing, `/` redirects to `/welcome`.
6. Opening `/welcome` directly also redirects to `/home` when the profile row is complete.

Continue Later nuance: `/onboarding` can route directly to `/home` after best-effort saving `onboarding_completed = false`, but a later normal launch through `/` will route that same user back to `/welcome`.

## Current Onboarding Behavior

Relevant files:

- `app/_layout.tsx`: root Stack is wrapped by `AppProviders`.
- `src/providers/app-providers.tsx`: provider order is Query -> Auth -> RevenueCat -> modal/share handlers.
- `src/providers/auth-provider.tsx`: bootstraps an existing Supabase session or creates anonymous auth.
- `src/lib/supabase/client.ts`: Supabase auth uses SecureStore-backed persistence with `persistSession: true`.
- `src/features/onboarding/use-user-profile-query.ts`: profile query key is `['user-profile', user?.id]`.
- `app/index.tsx`: `/` redirects to `/home` when `profileQuery.data?.onboarding_completed` is true, otherwise `/welcome`.
- `app/welcome.tsx`: welcome screen redirects to `/home` if the same profile row is complete.
- `app/onboarding.tsx`: finish upserts `user_profiles` and invalidates the user-profile query.
- `src/features/onboarding/onboarding-store.ts`: local onboarding selections persist in SecureStore under `recipe-dost-onboarding-profile`.

Likely cause of skipped welcome:

- The route guard is remote-profile-first, not local-onboarding-store-first. A persisted Supabase anonymous session whose `user_profiles.onboarding_completed` is already true will skip `/welcome` by design.
- This matches the QA note if the Play-installed production app reused previous app data, an existing anonymous session, a dev identity, or restored app data from the same package.
- The persisted Zustand onboarding flag is unlikely to be the direct redirect cause because `/` and `/welcome` do not read it for routing. It can preserve selections, but the redirect decision comes from `user_profiles`.

Open verification item: test a true clean install by clearing app data or uninstalling with backup restore disabled where possible, then confirm the first launch has no existing Supabase session and routes to `/welcome`.

## Current Home Stale Metadata Behavior

Relevant files:

- `src/providers/query-provider.tsx`: React Query defaults are `retry: 1` and `staleTime: 30_000`.
- `app/(tabs)/home.tsx`: `['recent-recipes', user.id]` fetches `getRecipeLibrary({ limit: 6 })` and polls only while a visible `latest_media_job` is active.
- `app/(tabs)/library.tsx`: `['recipe-library', user.id]` fetches `getRecipeLibrary()` and polls only while a visible `latest_media_job` is active.
- `src/features/save-recipe/save-recipe-modal.tsx`: save uses optimistic cache writes, replaces them with the saved item, invalidates list queries, then starts `refreshRecipeMetadata()` in the background.
- `app/recipe/[id].tsx`: detail uses `['recipe-item', recipeId]`, polls every 2 seconds while metadata is active, and refetches recipe/media-job queries on navigation focus.
- `src/lib/api/recipes.ts`: `getRecipeLibrary()` reads `recipe_items`, latest `media_jobs`, and latest `recipe_cards`; `getSavedRecipeItem()` reads the single row.

Likely cause of stale Home state:

- Home and Library know how to poll active AI media jobs, but they do not poll rows whose only active state is `recipe_items.metadata_status = 'saving'` or `'pending'`.
- Home and Library also do not refetch on navigation focus, and there is no global React Query/AppState foreground bridge.
- The save modal depends on its own background `refreshRecipeMetadata()` `finally` block to invalidate `['recent-recipes']` and `['recipe-library']`. If the app is backgrounded, killed, or resumed from memory while the server-side metadata write finishes, that client-side invalidation can be missed.
- Detail appears correct because it has its own focus refetch and metadata polling for `['recipe-item', recipeId]`. Opening detail fetches the completed row, while the already-mounted Home list can still be showing its cached pending/saving item.
- A full cold process restart should normally create a fresh QueryClient and fetch current data from Supabase. The reported symptom most strongly matches app resume/background behavior or a warm process with cached query data.

## Query Keys Involved

Onboarding and profile:

- `['user-profile', user.id]`: profile load/upsert routing source of truth.

Home and library:

- `['recent-recipes', user.id]`: Home recent grid.
- `['recipe-library', user.id]`: Library grid.

Saved-link detail and metadata:

- `['recipe-item', recipeId]`: saved-link detail row.
- `['media-job', 'recipe', recipeId]`: latest AI media job for a saved link.

AI recipe card:

- `['recipe-card', recipeCardId]`: generated AI recipe detail.

Related access/usage keys:

- `['ai-access-state', ...]`: AI access and quota state.
- `['usage-summary', ...]`: older usage/list invalidation surface.

Mutation and invalidation summary:

- Save modal save success writes optimistic/list cache data, invalidates `['recent-recipes']`, `['recipe-library']`, and `['usage-summary']`, then starts background metadata refresh.
- Save modal metadata refresh completion invalidates `['recipe-item', recipeItemId]`, `['recent-recipes']`, and `['recipe-library']`.
- Saved-link detail manual metadata retry invalidates `['recipe-item', recipe.id]`, `['recent-recipes']`, and `['recipe-library']`.
- AI job creation writes `['media-job', 'recipe', recipe.id]`, invalidates `['recipe-item', recipe.id]`, and may invalidate `['recipe-card', resultRecipeCardId]`.
- AI result discovery invalidates `['recent-recipes']`, `['recipe-library']`, `['recipe-item', recipeId]`, `['recipe-card', resultRecipeCardId]`, `['media-job', 'recipe', recipeId]`, and `['ai-access-state']`.
- Legacy preview save invalidates only `['recent-recipes', user.id]`; the current visible modal flow is broader.

## Minimal Patch Plan

Keep the implementation small and app-side only:

1. Add a tiny shared helper for active saved-link metadata states, treating `saving` and `pending` as active.
2. Update Home and Library `refetchInterval` predicates to continue polling while a visible row has active metadata or an active media job.
3. Add navigation-focus refetch to Home and Library, matching the existing detail-screen pattern.
4. Add a React Native `AppState` foreground bridge in the query/provider layer or a focused list hook so returning to the app invalidates/refetches `['recent-recipes']` and `['recipe-library']`.
5. Keep cache updates and invalidations scoped to existing query keys. Do not change quota/access logic, RevenueCat entitlement, backend/worker logic, package IDs, or env files.
6. Run `npm run qa:static` and `node scripts/env/env-doctor.mjs development`, then perform the manual QA below on a development/internal build before merging to `main`.

## Manual QA Checklist

- Fresh install: clear app data/uninstall, install build, launch, confirm `/welcome` appears before onboarding.
- Returning completed user: complete onboarding, close/reopen app, confirm it lands on Home.
- Returning incomplete user: tap Continue Later, close/reopen through normal app icon, confirm `/welcome` is shown, while direct Home remains usable after Continue Later.
- Existing production tester: install update over existing app data, confirm users with completed `user_profiles` skip welcome by design.
- Save link foreground: save a URL, keep app open, confirm Home and Library move from Saving/Preparing preview to completed metadata without opening detail.
- Save link background: save a URL, background or close app while metadata is processing, reopen to Home, confirm title/thumbnail/status refresh without opening detail.
- Warm resume under 30 seconds: save a URL, background briefly, reopen within the default stale window, confirm Home refresh still happens.
- Detail consistency: open the saved-link detail after metadata completes, confirm detail and Home/Library agree after returning.
- AI generation: generate a card from a saved link and confirm Home/Library still recognize completed `result_recipe_card_id` as AI Recipe.
- No regression: save/share does not create `media_jobs`; only Generate AI Recipe creates media jobs.
- Production safety: confirm custom dev/test UI remains hidden when `APP_ENV=production`.

## Production AAB VersionCode

Yes, a production AAB update will need Android `versionCode` 2 after the runtime fix is implemented and validated. The current production config documents `android.versionCode: 1`, and Google Play requires every uploaded update for the same package to have a higher version code.

This audit-only documentation patch does not require an AAB by itself. The runtime stabilization patch should bump `versionCode` only when preparing the production update from `main` through the guarded `npm run build:prod` flow.

## Recommended Next Implementation

Implement the minimal app-side refetch patch first. Do not touch Supabase functions, worker code, RevenueCat entitlement/access logic, package IDs, or env files. The fix should be limited to React Query/AppState/focus behavior and, if needed, a small metadata-status helper shared by Home and Library.

## M22E.1B Implementation

Status: implemented; device QA pending.

Changes:

- Added shared recipe-list refresh helpers in `src/lib/api/recipes.ts`.
- `saving` and `pending` metadata statuses now count as active list refresh states.
- Metadata-status polling is bounded by the row's recent `updated_at` age so a permanently stuck row does not cause unbounded polling.
- Home now polls `['recent-recipes', user.id]` while visible recent rows have active metadata or active media jobs.
- Library now polls `['recipe-library', user.id]` while fetched library rows have active metadata or active media jobs.
- Home and Library now refetch on navigation focus.
- Home and Library now refetch when the app returns to foreground through a shared AppState hook.
- Recipe Detail now invalidates Home/Library list keys immediately when `create-media-job` returns a media job with `result_recipe_card_id`; the existing result-ID effect still invalidates recipe-item, recipe-card, media-job, list, and AI access keys.

Runtime boundaries preserved:

- No backend, worker, Supabase schema, quota/access, product limit, RevenueCat entitlement, package ID, or env-file changes.
- No new user-facing feature or production dev/test UI exposure.
- Failed metadata remains a usable saved-link state, with Home/Library showing details unavailable instead of continuing active metadata polling.

Refetched or invalidated query keys:

- `['recent-recipes', user.id]`: Home list query, focus refetch, foreground refetch, active metadata/media-job polling.
- `['recipe-library', user.id]`: Library query, focus refetch, foreground refetch, active metadata/media-job polling.
- `['recent-recipes']`: broad invalidation after metadata retry/refresh and AI result discovery.
- `['recipe-library']`: broad invalidation after metadata retry/refresh and AI result discovery.
- `['recipe-item', recipeId]`: detail row refetch/polling and AI result invalidation.
- `['recipe-card', recipeCardId]`: generated recipe-card invalidation/refetch path.
- `['media-job', 'recipe', recipeId]`: AI media-job invalidation/refetch path.
- `['ai-access-state']`: existing AI result/access invalidation path.

## M22E.1B Manual QA Checklist

- Save link and stay open: save a supported recipe URL, remain on Home, and confirm the card moves from Saving/Preparing preview to completed title/thumbnail/status without opening detail.
- Save link, close app, reopen: save a supported URL, background or close the app while metadata is processing, reopen to Home, and confirm Home refreshes the completed metadata.
- Open detail, go back Home: open a saved-link detail after metadata completes, return to Home, and confirm Home and detail agree on title, thumbnail, and status.
- Generate AI recipe, return Home: generate an AI card, let it complete, return to Home, and confirm the item appears/opens as an AI Recipe.
- Failed metadata state: use a link that fails metadata refresh or force a retry failure, confirm Home/Library show Details unavailable/Saved Link behavior and do not poll forever.
- Fresh install onboarding check: clear app data or install without restored app data, launch, and confirm `/welcome` appears before onboarding for a new anonymous session.

## M22E.1C Competitor UX Audit

Status: decision log only; implementation deferred to M22E.1D.

Summary:

- ReciMe/Pluck-style apps emphasize fast retrieval, visual confidence, clear saved-state controls, and calm background processing.
- Recipe Dost should cherry-pick low-risk organizer and clarity improvements that strengthen the existing link-first AI flow.
- M22E.1D should remain app-side/product-surface focused unless a selected item clearly needs a later schema milestone.
- The current production stability work remains higher priority than large feature expansion.

Selected M22E.1D improvements:

1. Search across recipe title, ingredients, tags, platform, and source metadata.
2. Show AI-generated tags as chips on recipe cards/detail where data already exists.
3. Favorite/unfavorite recipe for quick retrieval.
4. Delete recipe with confirmation and safe ownership checks.
5. Better processing state that clearly tells users they can leave while the AI job continues.
6. Better paywall benefit comparison using the existing `premium` entitlement and current quota model.
7. Optional usage/credits pill in Home and Settings if it can reuse existing access data without new quota logic.
8. Stronger placement for Open original video on saved-link/AI recipe surfaces.
9. New AI Recipe ribbon on newly completed cards.
10. Basic manual tags add/remove, scoped to simple organization only.

Avoided features for now:

- Nutrition calculator/macros: high trust and liability surface; not required for the link-first MVP.
- Meal planner: large workflow expansion beyond save/link/library/paywall stability.
- Recipe scaling: needs ingredient normalization and accuracy guarantees that are not part of M22E.
- Print/export PDF: export polish is lower priority than core Android app QA.
- AI edit: would add new AI mutation paths and prompt/version complexity.
- Photo import: expands input sources beyond public link/caption/manual notes.
- Folders/cookbooks: heavier organization model; defer until simple tags/favorites prove useful.
- Push notifications: requires permission strategy, delivery plumbing, and store-policy review.
- Video downloading/storage: explicitly outside Recipe Dost's compliance stance.

Updated milestone plan:

1. M22E.1C documents the competitor UX decisions only.
2. M22E.1D should implement the smallest safe subset first: processing-state copy, stronger Open original video placement, AI tag chips if already present, and paywall comparison copy.
3. Favorites, delete, and manual tags require schema/API review before implementation; broader search can start client-side over fetched user-owned data.
4. Keep M22E.1D on `develop`, run static QA, then device QA before any production AAB update.

Exact next implementation prompt:

```text
Implement M22E.1D on develop: cherry-pick the lowest-risk competitor UX improvements for Recipe Dost. Documentation from M22E.1C selected search, AI tag chips, favorite/unfavorite, delete with confirmation, clearer leave-while-processing state, better paywall benefit comparison, optional usage/credits pill from existing access data, stronger Open original video placement, New AI Recipe ribbon, and basic manual tags. Start with app-side/UI-only improvements that require no schema/backend changes: processing-state copy, Open original video placement, AI-generated tag chips when existing data is already available, and paywall benefit comparison. Do not add nutrition, meal planner, scaling, PDF export, AI edit, photo import, folders/cookbooks, push notifications, or video downloading/storage. Do not change quota/access logic, RevenueCat entitlement, backend/worker behavior, package IDs, or env files. Update docs/decision-log.md and docs/milestones.md. Run npm run qa:static.
```

## Validation

- M22E.1A: `npm run qa:static` passed.
- M22E.1A: `node scripts/env/env-doctor.mjs development` passed on `develop`, using development env, development Supabase project ref, RevenueCat Test Store key type, and `com.recipedost.dev`.
- M22E.1B: `npm run qa:static` passed.
- M22E.1B: `node scripts/env/env-doctor.mjs development` passed on `develop`.
- M22E.1B: `node scripts/env/validate-env.mjs production` passed with masked production values only.
- M22E.1C: `npm run qa:static` passed.
- M22E.1D: `npm run qa:static` passed.
- M22E.1D: `node scripts/env/env-doctor.mjs development` passed.
- M22E.1D: `node scripts/env/validate-env.mjs development` passed with masked values only.
- M22E.1D: `node scripts/env/validate-env.mjs production` passed with masked values only.

Exact next prompt:

```text
Implement M22E.1B on develop: fix Home/Library stale saved-link metadata after app background/resume. Keep the patch app-side only. Add metadata pending/saving polling for Home and Library, add focus/foreground refetch for recent-recipes and recipe-library, preserve existing query keys and invalidation behavior, do not change quota/access logic, RevenueCat entitlement, backend/worker logic, package IDs, or env files. Update docs/decision-log.md and docs/m22e-app-state-stabilization.md with the implementation result. Run npm run qa:static and node scripts/env/env-doctor.mjs development.
```
