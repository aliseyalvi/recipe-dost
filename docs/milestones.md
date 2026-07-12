# Recipe Dost Milestones

## M22E.1R-G2 - Home Editorial Behavior Correction

- Status: Implemented on `develop`; device QA pending.
- Corrected Currently Processing so the card opens the existing saved-recipe detail/progress route with the real parent item ID; its independent Open Library action remains unchanged.
- Added Recent above Favorites. It selects one real item by latest item/card/job activity, supports saved links and completed AI cards, uses the existing editorial card/fallback, and opens the matching saved or generated detail route.
- Preserved M22E.1B bounded active polling, Home focus/foreground refetch, and save/AI completion invalidations so completed work replaces stale processing and becomes eligible for Recent.
- Made the existing `get-ai-access` usage pill pressable to `/paywall` for Free and Premium users, with safe analytics and the required accessibility label.
- Favorites now appears only when existing persisted `is_favorite` data exists and remains below Recent. No favorite/delete schema or API work was added.
- No backend/worker, quota/access, RevenueCat entitlement/products, package ID, env file, video storage, or production guard behavior changed. Shipping requires versionCode 2; the develop config remains unchanged.
- Validation passed: `npm run qa:static`, development env doctor, and development/production env validation. Manual Android QA remains pending.

## M22E.1R-G - Editorial Design System and Home Screen Redesign

- Status: Implemented on `develop`; device QA and screenshot review pending.
- Added centralized Obsidian/coral semantic tokens for colors, typography slots, spacing, radii, borders, and elevation, with compatibility aliases for screens awaiting later redesign.
- Added typed React Native editorial Home components for the screen/header/usage pill, section headings, processing state, real recipe hero cards, outline pills, empty states, and static skeleton placeholders. Stitch HTML/Tailwind and sample content were not copied.
- Home now uses the shared full `recipe-library` query for actual active work, persisted favorites, and the newest real AI card, plus the existing `get-ai-access` query for the Free/Premium remaining pill. Existing polling, focus/foreground recovery, navigation, save modal, and analytics are preserved.
- The existing custom Expo Router tab bar now uses a translucent dark container, coral active state, centered labeled Add FAB, and Android safe-area spacing without changing route names or the add/share/paste flow.
- Bodoni Moda and Work Sans are represented by centralized font slots with safe `serif`/system sans fallbacks because no font package/assets are currently installed. Bundled brand fonts are deferred rather than adding startup risk.
- No backend/worker, schema, quota/access, RevenueCat entitlement/products, package ID, env file, video storage, or production guard behavior changed. A shipped Play update requires versionCode 2, but the bump is deferred to the guarded production release from `main`.
- Validation passed: `npm run qa:static`, development env doctor, and development/production env validation. Small-device manual QA remains pending.

## M22E.1R-F - Professional Processing And Background Job UX

- Status: Implemented on `develop`; device QA pending.
- Saved-link and AI-job detail states now share a stage-aware dark processing panel. Existing statuses map to Saving link, Preparing preview, Watching video, Extracting recipe, Creating recipe card, Ready, and Failed; determinate progress appears only when supplied by the existing media job.
- The panel explicitly confirms that work continues after navigating away, routes Go to Library without cancelling the job, and makes Wait here perform a one-off refetch with visible checking feedback. Existing bounded polling, foreground/focus refresh, completed-card updates, friendly failure copy, and retry paths remain unchanged.
- Home and Library now show the current media-job stage in their pending card labels while retaining their existing active-state polling and failure states.
- No backend/worker, push notification, quota/access, RevenueCat, product, package ID, or env-file behavior changed.

## M22E.1R-E - Professional Paywall Redesign

- Status: Implemented on `develop`; device QA pending.
- Replaced the mixed benefit list/equal-cell layout with a concise Free vs Premium table, an existing-access usage card, selectable monthly/yearly RevenueCat plan cards, and a safe-area-aware bottom purchase/restore area.
- Free is stated as saved links, Library search, and 3 total AI recipe cards. Ingredients, steps, recipe help, and grocery lists are explicitly limited to those generated cards. Premium is stated as 100 AI recipe cards/month, Urdu + English help, ingredients/steps/grocery lists, videos up to two minutes in beta, and priority beta improvements.
- Existing offering loading/unavailable states, package IDs, Google Play purchase/restore handlers, `premium` entitlement, and Premium-active state are unchanged. Active Premium never receives a purchase CTA.
- No RevenueCat product, access/quota, backend, package ID, or env-file change was made.

## M22E.1R-D - Favorite And Delete Recipe Management

- Status: Implemented on `develop`; development database apply and device QA pending.
- Added migration `20260711080652_m22e_recipe_management.sql` with `recipe_items.is_favorite` and soft-delete `recipe_items.deleted_at`, plus an active-library partial index. `recipe_cards` and media jobs remain linked to the parent without duplicate management state.
- Favorite/unfavorite is available from saved-link and AI-card detail headers and appears as a lightweight Favorite badge on Home/Library cards.
- Delete requires the approved native confirmation and sets `deleted_at`; it never touches the original video. Active Home/Library/Search, detail, and grocery reads exclude the soft-deleted parent, while job/card/accounting records remain intact.
- Existing user-owned update RLS remains the enforcement boundary; app mutations additionally scope `id`, current `user_id`, and active rows. No access, paywall, RevenueCat, product, package ID, or env-file behavior changed.
- After linking development once, apply only to development after review: `node scripts/env/run-with-env.mjs development -- supabase db push --linked`. Do not apply production until development QA passes.

## M22E.1R-C - Professional Search And Tag UX

- Status: Implemented on `develop`; device QA pending.
- Library text search remains client-side over user-owned rows and now renders active searches as compact thumbnail rows with title, platform, AI Recipe/Saved Link state, available time/servings, and up to three tag chips. Existing grid browsing, filters, and sorting remain unchanged.
- Search covers saved and AI titles, source metadata/author/platform, ingredients, steps, tags, notes/captions/manual ingredients, cuisine/meal type, and source URL.
- Recipe-card detail renders up to eight rounded existing tags; a tag opens Library with the tag prefilled as a query. Raw tags/search text are not sent to analytics.
- Added clear-search affordance and a query-aware “No recipes found” state. Empty-tag legacy cards remain supported.
- Follow-up: tag-search rows prioritize matching chips, show the same pending/failed/AI state as the grid, and lock thumbnail geometry to 92 by 92 with cover scaling on Android.
- No schema, worker, quota/access, RevenueCat, package ID, or env-file change was made. Tag search depends on the external worker populating `recipe_cards.tags_json` for newly generated cards.
- Validation passed: `npm run typecheck`, `npm run qa:static`, `node scripts/env/env-doctor.mjs development`, and `node scripts/env/validate-env.mjs production`.

## M22E.1R-A - Professional UX Recovery Audit

- Status: Audit complete on `develop`; implementation pending.
- `recipe_cards.tags_json` exists and mobile reads it, but current media-job cards are written by the external Render media worker rather than the legacy in-repo `generate-card` path. The worker contract/persistence mapper must generate and write tags before tag UI/search can meet acceptance criteria.
- Library search is client-side and technically broad, but is Library-only, has no visible/tappable tag discovery, and currently depends on empty tags in the active generation path.
- Favorite needs one small `recipe_items.is_favorite` migration. Confirmed hard delete can use existing user-owned `recipe_items` delete RLS/cascades, with an explicit decision for `grocery_lists.source_recipe_ids` cleanup.
- Keep M22E.1B stale-state refresh and M22E.1D normalization. Replace the paywall benefit-list/equal-cell comparison, weak search/tag presentation, and processing-card composition in the next implementation sequence.
- No runtime, schema, worker, quota/access, RevenueCat, package ID, or env-file change was made in this audit. A runtime recovery release needs the versionCode 2 production AAB after development/device QA.
- Validation passed: `npm run qa:static` and `node scripts/env/env-doctor.mjs development`.

## M22E.1E - Processing State and Paywall Polish

- Status: Implemented on `develop`; device QA pending.
- AI generation processing now tells users they can leave while work continues and provides explicit "Go back to Home/Library" and "Wait here" actions.
- Saved-link metadata states now use separate saving, pending, and failed copy; "Preparing preview..." is reserved for pending metadata preview fetches.
- Failed metadata keeps the existing retry-details path, and AI failed jobs keep the existing friendly failure/retry behavior.
- Paywall comparison now clarifies Free = 3 total AI recipe cards and unlimited saved links, while ingredients/steps/grocery lists are available on generated AI cards. Premium remains 100 AI recipe cards/month with the existing `premium` entitlement and current Google Play subscription UI.
- Paywall now shows an optional usage card from the already-loaded `get-ai-access` query; no new backend call, quota/access logic, product, entitlement, package ID, or env-file change was added.
- Tag QA note: tag chips/search depend on `recipe_cards.tags_json`; if generated cards have empty tags, fix that in a separate prompt/Edge Function contract patch.
- Validation passed: `npm run qa:static`, `node scripts/env/env-doctor.mjs development`, and `node scripts/env/validate-env.mjs production`.

## M22E.1D - App-Side Search and UX Polish

- Status: Implemented on `develop`; device QA pending.
- Improved Library search client-side over fetched user-owned rows: saved-link title, source URL, source metadata title/description/author/platform/host, platform, notes/caption/manual ingredients, cuisine, meal type, AI recipe title/summary, AI tags, ingredients, and steps.
- Displayed existing AI-generated `recipe_cards.tags_json` as chips on the AI recipe detail screen; older cards without tags remain supported.
- Strengthened saved-link detail Open Original Video placement and processing copy so users know metadata/AI jobs continue while they leave the screen.
- Added a Free vs Premium paywall comparison while preserving Free = 3 successful AI generations, Premium = 100 AI recipes/month, `premium` entitlement, existing products, and the 2-minute beta video limit.
- No schema migration, backend/worker change, quota/access change, RevenueCat change, package ID change, env-file change, video download/storage, nutrition, meal planner, scaling, PDF export, AI edit, photo import, folders/cookbooks, social login, or push notification work was added.
- Favorite/unfavorite, delete with confirmation, and manual tags are deferred to a separate schema/API review patch.
- Validation passed: `npm run qa:static`, `node scripts/env/env-doctor.mjs development`, `node scripts/env/validate-env.mjs development`, and `node scripts/env/validate-env.mjs production`.

## M22E.1C - Competitor UX Cherry-Pick Decision Log

- Status: Documentation complete.
- Reviewed ReciMe/Pluck-style competitor patterns and selected low-risk Recipe Dost improvements for a future M22E.1D implementation.
- Selected: broader search, AI-generated tag chips, favorite/unfavorite, delete with confirmation, clearer leave-while-processing state, better Premium benefit comparison, optional usage/credits pill from existing access data, stronger Open original video placement, New AI Recipe ribbon, and basic manual tags.
- Avoided for now: nutrition/macros, meal planner, recipe scaling, PDF export, AI edit, photo import, folders/cookbooks, push notifications, and video downloading/storage.
- M22E.1D should begin with app-side/UI-only work that does not require schema/backend changes, while favorites/delete/manual tags get schema/API review before implementation.
- No runtime, env, quota/access, RevenueCat entitlement, backend, worker, or package ID changes were made.
- Validation passed: `npm run qa:static`.

## M22E.1B - Home/Library Metadata Refresh Stabilization

- Status: Completed; device QA pending.
- Home and Library now treat saved-link metadata `saving` and `pending` as active list refresh states alongside active media jobs.
- Active metadata polling is bounded by recent `updated_at` age to avoid unbounded network polling for stuck rows.
- Home and Library refetch their existing list query keys on screen focus and app foreground resume.
- Fast AI media-job responses with `result_recipe_card_id` now invalidate Home/Library list keys immediately, while the existing result discovery path continues to invalidate recipe item, recipe card, media job, list, and AI access keys.
- No backend, worker, quota/access, product limit, RevenueCat entitlement, package ID, or env-file changes were made.
- Validation passed: `npm run qa:static`, `node scripts/env/env-doctor.mjs development`, and `node scripts/env/validate-env.mjs production`.

## M22E.1A - App State Flow Audit

- Status: Audit completed; implementation pending.
- Audited app startup, anonymous auth bootstrap, onboarding route guards, persisted onboarding profile state, `user_profiles` load/upsert flow, Home/Library/detail query keys, metadata refresh invalidation, AI-card invalidation, and existing launch/QA docs.
- Likely onboarding root cause: the Play-installed app reused an existing Supabase anonymous session with `user_profiles.onboarding_completed = true`; `/` and `/welcome` redirect to Home from the remote profile row, not from the local Zustand onboarding flag.
- Likely Home stale metadata root cause: Home/Library list queries poll active `media_jobs` but not `recipe_items.metadata_status = saving/pending`, and they lack navigation focus or foreground refetch when a background metadata refresh completes while the app is not actively invalidating queries.
- Recommended minimal implementation: app-side metadata active polling plus Home/Library focus/foreground refetch using existing query keys only.
- Production AAB note: the runtime fix will need Android `versionCode` 2 when released to Google Play; this audit-only docs patch does not.

## M22E.0A - Branching and Environment Safety

- Status: Completed.
- `main` is production-stable and `develop` is daily development.
- Production AAB builds are guarded to run from `main` unless `ALLOW_NON_MAIN_PROD_BUILD=1` is set explicitly.
- Development and preview builds normally run from `develop` and warn, without failing, on other branches.
- `env/development.env` and `env/production.env` remain gitignored source-of-truth files loaded through scripts only.
- M22E bug fixes happen on `develop` first, then release via `develop` QA, merge to `main`, production build, and Google Play internal update.
- Validation passed: `npm run qa:static`, both env doctor commands, and the development env-loader Expo config command.

## M22D.5F - Production Backend/Worker Smoke Test Completion

- Status: Completed.
- Production Supabase ref `cjlvkagkcfswsycsblfw`, production Render worker `recipe-dost-media-worker-prod`, production Edge Functions, and the production app are working end to end.
- Anonymous auth works against production Supabase.
- YouTube, Instagram, and TikTok AI recipe generation all passed production smoke testing through the app, Supabase DB/functions, Render worker, and Gemini pipeline.
- Final root cause: production Render env was clean, but the worker Docker image did not include `config/worker.production.json`, so the worker fell back to defaults.
- Final fix: worker Dockerfile now copies `config/`, and production config loads from `/service/config`.
- Remaining blocker: RevenueCat and Google Play subscription setup.
- Next milestone: M22C.3 RevenueCat + Google Play billing setup.

## M22C.3 - RevenueCat + Google Play Billing Setup

- Status: Next.
- Configure production RevenueCat and Google Play subscription products for the existing `premium` entitlement.
- Preserve the RevenueCat Test Store fallback for development/testing.
- Do not change quota/access logic while setting up store billing.

## M22B.3C - Lifecycle Safety and Static QA Guards

- Status: Completed; pending device QA.
- Tightened RevenueCat provider mounted guards around configure/login, customer info refresh, offerings, purchase, restore, and entitlement sync paths.
- Added `scripts/qa-static-guards.mjs` plus `qa:guards` and `qa:static` scripts for hook order, forbidden copy, unsafe logs, secret assignments, and lifecycle hazard smoke checks.
- Agent runbook now requires reporting `npm run qa:static` after app patches.
- No migration, worker, RevenueCat dashboard/config, save/share, metadata, or media-processing changes were made.

## M22B.3A - Restore and Refresh Downgrade Guard

- Status: Completed; pending device QA.
- Restore and Refresh no longer downgrade backend Premium on uncertain RevenueCat local state, missing CustomerInfo, malformed API response, identity mismatch, or transient API failure.
- Backend entitlement sync only writes inactive when RevenueCat returns a definitive inactive/expired Premium entitlement for the same Supabase app user id.
- Settings and Paywall restore flows refresh CustomerInfo, run safe backend sync, and refetch `get-ai-access` before showing Free/no-subscription copy.
- Deploy note: run `supabase functions deploy sync-revenuecat-entitlement`.
- No migration, worker, RevenueCat dashboard/config, save/share, metadata, or media-processing changes were made.

## M22B.3 - Monetization and Access QA Hardening

- Status: Completed; pending device QA.
- Final consistency pass before Google Play subscription setup: Settings, Recipe Detail, Paywall, and developer diagnostics use backend-first access/quota state.
- Premium quota remains 100 AI recipes/month, Free remains 3 successful AI recipes total, active jobs reserve slots, and failed jobs do not count.
- Paywall active Premium state now reflects backend access and quota when available while RevenueCat local state remains for purchase, restore, and manage/cancel actions.
- Test Store monetization/access flow is ready for M22C Google Play real subscription setup/testing.
- Remaining limitation: videos are still limited to 2 minutes in beta.
- No migration, worker, RevenueCat dashboard/config, save/share, metadata, or media-processing changes were made.

## M22B.2E - AI Failure Copy and Subscription Actions

- Status: Completed; pending device QA.
- Added friendly AI extraction failure copy for Gemini structured extraction failures, daily AI dev limit failures, and long-video failures.
- Settings subscription actions are now plan-aware: Free shows Upgrade, Restore, and Refresh; Premium shows Manage / cancel subscription, Restore, and Refresh.
- Manage / cancel opens the RevenueCat/store management URL when available and otherwise explains the RevenueCat Test Store fallback.
- No migration, worker, RevenueCat dashboard/config, save/share, metadata, or media-processing changes were made.

## M22B.2C - RevenueCat Sync and Sticky AI Job UI

- Status: Completed; pending device QA.
- Stabilized RevenueCat identity readiness around the Supabase user id for status, purchase, and restore flows.
- Settings keeps backend Premium as the source of truth during backend/local RevenueCat races and does not flash final Free until both sources are loaded and inactive.
- Source Detail keeps the active media job visible through refetch gaps, broadens active job status handling, and prevents idle Generate from appearing while a job is running.
- `sync-revenuecat-entitlement` now rejects malformed RevenueCat subscriber responses instead of overwriting entitlement state as inactive.
- Deploy note: run `supabase functions deploy sync-revenuecat-entitlement`.

## M22B.2B - Backend-First Subscription Status

- Status: Completed; pending device QA.
- Unified Settings, Source Detail, and access diagnostics around backend `get-ai-access` plan/quota fields.
- Backend AI access is now the app-side source of truth for Premium status and monthly quota display, while RevenueCat local state remains for purchase, restore, refresh, and manage-subscription actions.
- Fixed the Expo reload mismatch where Settings could show Free while backend access diagnostics and Recipe Detail correctly treated the user as Premium.
- No migration, Supabase Function, RevenueCat dashboard/config, save/share, worker, or media-processing changes were made.

## M22B.2A - Recipe Detail Hook Order Hotfix

- Status: Completed; pending device QA.
- Fixed the Source Detail hook order regression after M22B.2 by keeping start-lock and active-job effects above conditional returns.
- Preserved Generate AI Recipe start locking, active job progress, completed-job auto-open, Premium quota helper text, and compact failure UI.
- No Supabase Function, migration, RevenueCat, save/share, worker, or media-processing changes were made.

## M22B.2 - AI Job State Reconciliation and Premium Quota Display

- Status: Completed.
- Source Detail now attaches to the created or existing media job returned by `create-media-job` immediately, preventing the UI from falling back to idle Generate state while a job is active.
- Added a local start lock around Generate AI Recipe so the primary CTA stays disabled until an active job is attached or the mutation fails.
- Live active jobs discovered on mount/focus continue polling and auto-open the AI Recipe detail once completed with a `result_recipe_card_id`.
- Premium quota helper text now uses backend monthly remaining and used counts when available.
- Failure UI remains compact and avoids duplicate large Generate AI Recipe buttons.
- No migration was added for M22B.2.
- Deploy note: run `supabase functions deploy create-media-job`.

## M22B - RevenueCat Backend Entitlement Sync and AI Quota Enforcement

- Status: Completed.
- Added backend RevenueCat entitlement sync using existing `user_profiles` RevenueCat columns, plus optional safe metadata columns for product, expiry, and store.
- Added `sync-revenuecat-entitlement` Edge Function to fetch RevenueCat server-side with `REVENUECAT_API_KEY` and update only the current user's profile entitlement mirror.
- Server-side AI access is now the source of truth: Free users get 3 successful AI recipes total, Premium gets 100 successful AI recipes/month, active jobs reserve slots, and failed/cancelled jobs do not count.
- `get-ai-access` now returns free and Premium quota fields, including `plan`, `block_reason`, and Premium monthly remaining counts.
- `create-media-job` now blocks before insert with specific quota error codes and keeps the 2-minute beta video duration guard server-side.
- Source Detail syncs local Premium with backend entitlement state before starting AI generation when needed and no longer shows a duplicate Generate retry button after errors.
- RevenueCat webhooks may be added later.
- Deploy notes: run `supabase db push`, then `supabase functions deploy sync-revenuecat-entitlement`, `supabase functions deploy get-ai-access`, and `supabase functions deploy create-media-job`.

## M22A.2 - Paywall and AI Generation CTA Polish

- Status: Completed.
- Improved Source Detail AI generation hierarchy so ready, generating, Premium, free remaining, free-limit, metadata pending, and long-video states show focused CTAs instead of competing buttons.
- Free-limit state now shows a single Upgrade to Premium card with quiet Maybe later navigation and keeps Premium copy at 100 AI recipe cards/month.
- Paywall copy is shorter and clearer, with compact benefits and selectable monthly/yearly package cards using RevenueCat `priceString`.
- Paywall purchase flow now uses one selected-plan Continue CTA, with Restore purchases and Maybe later as quiet secondary actions.
- Paywall active Premium state stays clean and does not show purchase plans or duplicate close actions.
- RevenueCat Test Store purchase dialogs remain expected during development testing and are not customized by the app.
- Server-side Premium monthly quota enforcement remains M22B/M22B.1.

## M22A.1 - Premium UX Polish and Subscription Management

- Status: Completed.
- Polished the Premium paywall, Settings subscription section, and Source Detail quota copy around the Premium beta plan.
- Copy now uses `Premium` instead of `Pro`, and Premium is described as 100 AI recipe cards/month rather than unlimited usage.
- Paywall now shows a clean Premium active state, plan cards for monthly/yearly RevenueCat packages, restore/retry states, and store subscription management when `customerInfo.managementURL` is available.
- Settings now shows Free and Premium-specific subscription states, including Manage subscription, Restore purchases, Refresh status, and RevenueCat renewal/access dates when available.
- Source Detail now shows `Premium active` instead of `Pro` and keeps the M22B server-side monthly quota enforcement note visible.
- Real server-side monthly quota enforcement and Supabase entitlement sync remain M22B/M22B.1.
- Google Play real subscription testing remains M22C.

## M22A - RevenueCat Paywall Foundation

- Status: Completed.
- Added centralized RevenueCat app config for the `premium` entitlement, `default` offering, and Android public API key environment variable without committing real keys.
- Added an app-side RevenueCat provider that configures after Supabase anonymous auth is available and uses the Supabase `user.id` as the RevenueCat appUserID.
- Replaced the placeholder paywall with a Premium screen that loads monthly/yearly packages from RevenueCat offerings, uses RevenueCat price strings, supports purchase and restore, and handles unavailable plans gracefully.
- Settings now shows Free/Premium status, opens the paywall from Upgrade, and restores purchases from the Subscription section.
- Generate AI Recipe remains backend-gated: free users see the paywall after the free limit, local Premium can show the M22B sync message if the backend still blocks, and long-video/metadata guards still run first.
- Save/share links, metadata preview, library/search, open original, and existing grocery viewing remain free.
- Supabase/backend entitlement sync remains M22B; Google Play real subscription setup remains M22C.

## M21.11C - Delete Account Backend

- Status: Scaffold completed; backend automation deferred before store submission.
- Added a nested Delete account & data settings page explaining the data categories to delete and warning that deletion cannot be undone.
- Current action is a safe request/contact placeholder; no service-role deletion function was added in the mobile app.
- Backend deletion automation and public store deletion link remain M23 before release unless prioritized sooner.

## M21.11B - Secondary Recipe Language Preference

- Status: Completed.
- Added `SUPPORTED_SECONDARY_RECIPE_LANGUAGES` with Urdu as the only selectable secondary recipe language and an AI instruction field for future prompt consumption.
- Added `user_profiles.secondary_recipe_language_code` with default `ur` and a check constraint for supported values.
- Added a nested Secondary recipe language settings screen that loads, retries, saves, and shows Urdu / اردو selected.
- Generate AI Recipe now sends the selected secondary language code to `create-media-job`; the Edge Function stores it safely in `media_jobs.source_metadata` without changing the worker contract.

## M21.11A - Settings Screen Redesign

- Status: Completed.
- Settings is now a clean production-ready hub with Profile, Subscription, Recipe Preferences, Appearance, Privacy & Data, Support, and Developer sections.
- Profile shows the guest/app profile identity without adding sign-in.
- Subscription shows the free-plan and Premium/restore placeholders without adding RevenueCat purchase logic.
- Secondary recipe language, theme, privacy/data usage, delete account/data, contact support, and app version rows are present as structured settings rows.
- Developer identity/access tools are grouped under a Developer section and hidden unless running in dev mode or the access role is admin/tester.
- RevenueCat integration remains M22, and automated delete account backend work remains M23 before release.

## M22 - RevenueCat Paywall + Entitlement Sync

- Status: Deferred until after the M21.11 settings and compliance foundation.
- Scope: Add RevenueCat paywall behavior and entitlement sync after the lightweight agent QA docs milestone is complete.
- Save links remain free, and AI generation remains the monetized path.

## M21.10E - Automated QA Scenarios

- Status: Deferred.
- Deferred until after monetization because automated closed-loop QA would add complexity and token burn before the paywall milestone.

## M21.10D - Device/Simulator Visual QA Loop

- Status: Deferred.
- Deferred until later; no browser/device visual QA automation, self-healing loops, Maestro, serve-sim, or agent-device setup is being added now.

## M21.10C - Runtime Component Inspection

- Status: Deferred.
- Deferred until later; no React runtime introspection is being added now.

## M21.10B - Expo MCP Local Setup

- Status: Deferred.
- Deferred until later; no Expo MCP setup is being added now.

## M21.10A - Lightweight Agent QA Contract Docs

- Status: Current docs-only milestone, completed.
- Added lightweight agent runbook and QA scenario docs instead of implementing a full closed-loop QA architecture.
- Heavy QA automation remains deferred to avoid complexity and token burn before monetization.
- Validation: docs-only diff review with `git diff -- docs AGENTS.md`.
- Human QA needed: review the runbook and checklist for fit before starting M22 RevenueCat paywall work.

## M21.9C - Core MVP QA Freeze

- Status: Stable/done.
- Manual save URL flow, Android share URL flow, duplicate blocking, metadata bridge, thumbnails, AI generation, long-video/failed-AI UX, save modal, headers/back navigation, grocery thumbnails, and offline/cache behavior are stable enough to move toward paywall.
- Save/share still must not create `media_jobs`; only Generate AI Recipe can start AI generation.

## M21.9C.6 - Duplicate Source Detection and No-Glitch Save Flow

- Status: Completed after focused validation.
- M21.9C.6 prevents duplicate saved videos by normalizing recipe source URLs, blocking local duplicate optimistic cards, and returning existing recipe_items from save-recipe-link when already saved.
- YouTube, Instagram, TikTok, Facebook, and generic HTTP(S) links now produce deterministic duplicate keys with common tracking params removed.
- Save/share still uses `save-recipe-link` plus background `refresh-recipe-metadata`; duplicate saves do not create `media_jobs`, reset existing metadata, or show a second loading card.

## M21.9C.5 - Router Mount, AI Duration Guard, and Credit Refresh QA Fixes

- Status: Completed after focused validation.
- Fixed navigation side-effects to avoid Expo Router mounted warnings by guarding AI auto-open and share-intent modal work with mount checks and post-interaction scheduling.
- Blocked AI generation while saved-link metadata is still pending/saving/loading/fetching, with clear "Preparing video details..." copy.
- Added a 120-second app-side duration guard using saved recipe duration and safe source metadata duration flags before calling `create-media-job`.
- Mapped duration-related create/job failure codes to friendly long-video copy and kept the original video action available.
- Refreshed AI access, media-job, recipe-item, and recipe-card queries after failed jobs so failed jobs do not remain visible as analyzing/reserved.
- Save/share, bottom sheet behavior, thumbnail strategy, back navigation, and Grocery thumbnails were preserved.

## M21.9C.4 - Navigation, Live Metadata, and Offline Cache QA Fixes

- Status: Completed after focused validation.
- Fixed QA issues: back navigation avoids duplicate Home stack entries by using real stack back first and `replace` fallbacks only when needed.
- Home now opens detail screens with `/` as the safe parent fallback, while Library and Grocery keep route-specific parent fallbacks.
- AI result auto-open replaces Source Detail with AI Recipe while preserving the original parent `returnTo`, so back returns to the parent screen instead of the old source detail.
- Saved Recipe detail now refetches on focus and polls while metadata is pending/saving/fetching, so title, thumbnail, and duration update without reopening the screen.
- Home/Library loading cards avoid duplicate "Fetching details" text and show a placeholder preview with lightweight activity feedback.
- Home, Library, and Grocery preserve cached list data during background offline/refetch errors and show non-blocking friendly offline messaging when previous data exists.
- Save/share still use saved-link metadata functions only and do not create `media_jobs` or consume AI credits.

## M21.9C - Final Core-Flow QA Freeze

- Status: Completed after focused validation.
- Core-flow QA freeze kept the MVP scope unchanged: manual save/share save still use saved-link metadata functions only, and only Generate AI Recipe can create `media_jobs` or reserve AI access.
- Fixed QA-blocking display consistency by treating completed `media_jobs.result_recipe_card_id` the same as `latest_card` for Home/Library AI filters and grocery affordances.
- Reduced Home/Library card pill clutter so platform stays in subtitle/meta text while the image keeps one primary status pill.
- Fixed nested header back behavior to honor explicit `returnTo` parents before falling back to native history, keeping Source Detail, AI Recipe, Library, and Grocery detail returns predictable.
- Extended friendly offline/network error copy to Library empty errors, grocery list APIs, and usage summary loading.
- Known non-blocking deferred items: native Android share-intent and full device core-flow acceptance still require human QA on a development APK.
- Ready for M21.10A agent QA contract if human acceptance passes.

## M21.9C.3 - Nested Header Back Behavior and Grocery Thumbnails

- Status: Done after validation.
- Nested header back behavior now prefers a safe `returnTo` route param, then `router.back()`, then the screen fallback route.
- Home, Library, Grocery, Source Detail, AI Recipe, and Grocery detail navigations pass parent `returnTo` context into nested screens.
- Auto-opening an AI Recipe from Source Detail keeps a safe return route back to that source detail when the stack has been replaced.
- Grocery cards now reuse the Library thumbnail fallback chain by resolving latest media-job thumbnails before recipe-item thumbnails.
- Main tab roots remain headerless, and the compact nested header style remains unchanged.

## M21.9C.2 - Standard Nested-Screen Header

- Status: Done after validation.
- Replaced the custom large Back pill header with a compact `NestedScreenHeader` using a back arrow, one-line title, and optional right-side icon actions.
- Tab roots still have no back header: Home, Library/Saved Links, Grocery root, and Settings keep the bottom tab shell only.
- Nested/detail screens keep safe fallback back navigation through `router.back()` with route fallback when there is no history.
- Source Detail and AI Recipe detail support compact open-original right actions using existing open-source behavior only.
- Grocery detail uses a simple back arrow plus "Grocery List" title with no right action.

## M21.9C.1 - Navigation Headers and Back Buttons Audit

- Status: Done after validation.
- Main tab roots remain headerless: Home, Library/Saved Links, Grocery root, and Settings keep the existing bottom tab behavior with no back header.
- Nested/detail screens now use visible back navigation: Saved Recipe/Source Detail, AI Recipe detail, and recipe-specific Grocery List.
- Grocery root at `/grocery` stays a tab-root index with no back button; grocery detail at `/grocery?recipeCardId=...` shows a safe in-screen back header.
- Back headers call `router.back()` when history exists and fall back to a parent route (`/grocery` or `/library`) so detail screens do not trap users.
- Header spacing is inside the existing safe-area-aware `Screen` layout, avoiding Android status bar overlap and duplicate native headers.
- Settings has no nested route files in the current Expo Router tree, so Settings remains a headerless tab root.

## M21.9A.2 - Save Recipe Bottom Sheet Modal

- Status: Done after validation.
- Save Recipe URL now uses one global `@gorhom/bottom-sheet` `BottomSheetModal` instead of the custom React Native `Modal` plus Pressable overlay.
- `GestureHandlerRootView` and `BottomSheetModalProvider` are mounted once near the app root.
- Backdrop tap through `BottomSheetBackdrop`, Android hardware back, and the X button are the supported close methods.
- Swipe-to-close and sheet panning are disabled for the MVP to avoid keyboard gesture glitches.
- Shared URLs still open the same provider flow prefilled with "Shared from another app"; invalid shares still show one friendly message only.
- Save still validates the URL, dismisses quickly, shows one optimistic card, and finishes save/metadata refresh in the background.
- New native bottom sheet/gesture dependency behavior requires a fresh development build before device QA.

## M21.9A.1 - Save Recipe Modal Stabilization

- Status: Done after validation.
- Save Recipe now uses a stable full-screen transparent React Native `Modal` with one dark opacity backdrop and one bottom-anchored sheet.
- Backdrop tap, Android hardware back, and the X button close the modal and clear the initial URL/share hint state.
- Swipe-to-close is disabled for this MVP because reliable backdrop/back/X close behavior is safer with the Android keyboard.
- Keyboard-safe layout uses `KeyboardAvoidingView`, a handled-taps `ScrollView`, and preserved Android resize mode so the URL input and Save Recipe button stay reachable.
- Save behavior remains unchanged: validate URL, close quickly, show one optimistic card, then save and refresh metadata in the background.

## M21.9A - AI Queue Reservation and Detail Polish

- Status: Done after validation.
- Active AI jobs now reserve free AI slots while queued, processing, analyzing, pending, running, resolving, downloading, validating, thumbnailing, uploading to AI, or saving results.
- Successful AI jobs count permanently; failed/cancelled/non-result jobs do not permanently consume free credits.
- `get-ai-access` and `create-media-job` share the same server-side slot math and expose safe fields for successful used, active reserved, free limit, remaining to start, and can-start state.
- Source Detail disables duplicate Generate AI Recipe starts, treats duplicate active jobs as analyzing, and auto-opens the AI recipe card when a job started from that screen completes.
- Save modal backdrop/outside close behavior remains the simple modal save flow; sharing/saving still never creates `media_jobs`.
- Source Detail and AI Recipe screens now use visible stack headers, and Android status bar content stays visible on the dark app background.
- Network failures now show friendly offline retry UI on Home, Source Detail, AI access, AI status, and recipe-card loads.

## M21.8C - Share State, Optimistic Save, and Splash Polish

- Status: Done after validation.
- Normal app launch now stays on Home silently: no share error screen and no save modal unless the plus button is tapped or a valid native share URL is received.
- Share handling now uses an explicit idle/valid/invalid/consumed state flow; invalid share text shows one friendly message only after an actual native share payload is received.
- Save modal close behavior was tightened with a visible close button, backdrop close, Android back handling, shared URL cleanup, Android keyboard resize, and scrollable bottom-sheet content.
- Optimistic saves now use one `optimistic:<normalizedUrl>` card, dedupe/replace by normalized `source_url`, and remove the optimistic card on save failure.
- Home background refetch is silent after initial load, avoiding repeated loading/refetch cards and layout jumps.
- AI recipe cards continue to override vague source metadata titles/summaries for Home, Library, and saved-link detail display without mutating `source_url` or source metadata.
- Splash/icon config now references `assets/images/icon.png`, `assets/images/adaptive-icon.png`, `assets/images/splash-icon.png`, and `assets/images/favicon.png`; splash/icon changes require a rebuilt dev APK.

## M21.8B - Android Share Payload + Save UX Polish

- Status: Done after validation.
- Added `expo-share-intent` to read Android shared text payloads in JS; Android share testing still requires a dev build/APK, not Expo Go.
- Shared Instagram, TikTok, YouTube, and Facebook URLs now open the existing Save Recipe modal with the URL prefilled and a "Shared from another app" hint, without creating `media_jobs` or consuming AI credits.
- The save modal is keyboard-safe on Android with resize mode and scrollable bottom-sheet content.
- Saving a valid link now closes the modal immediately, shows an optimistic "Saving" card, replaces it with the saved `recipe_item`, and refreshes metadata in the background.
- Home/Library card states are limited to Saving, Fetching details, Saved Link, Analyzing, AI Recipe, and AI failed, with platform shown in the metadata row.
- When AI generation completes, saved-link detail and list cards prefer the AI recipe title/summary over vague source metadata while preserving the original source URL and metadata.

## M21.8A - EAS Android Development Build Setup

- Status: Done after validation.
- Added `expo-dev-client` aligned with Expo SDK 56 so Android share-to-app can be tested in a development build instead of Expo Go.
- Added a temporary stable Android application ID, `com.recipedost.dev`, for development APK testing until the production package name is finalized.
- Added `eas.json` with internal Android APK profiles: `development` uses `developmentClient: true`, and `preview` builds an internal APK without adding production release settings.
- Android text share intent config remains in `app.config.js` for `ACTION_SEND` with `text/plain` and `text/*`.
- Expo Go cannot fully test native Android share intents; use an EAS development APK or local native build, and rebuild/reinstall the dev app after native config changes.

## M21.8 - Android Share-To-App Modal Save

- Status: Done after validation.
- Android text share intent support remains configured through Expo app config for `ACTION_SEND` with `text/plain`/`text/*`; full native share testing requires a development build/APK, and Expo Go may not receive Android share intents reliably.
- Shared text is parsed for the first supported Instagram, TikTok, YouTube, Facebook, or `fb.watch` HTTP(S) recipe URL, with unsupported text showing "Could not find a recipe video link in the shared text."
- Valid shares open the existing Save Recipe modal with the URL prefilled and a "Shared from another app" hint instead of auto-saving or opening the old preview flow.
- Saving from share uses `save-recipe-link`, then background `refresh-recipe-metadata`, and does not create `media_jobs` or consume AI credits.
- `save-recipe-link` now returns an existing saved item for the same user and normalized URL instead of creating a duplicate row.
- `Generate AI Recipe` remains the only user-facing AI generation path through `create-media-job`.

## M21.7G - Metadata Preview Payload Contract Fix

- Status: Done after validation.
- Direct production worker curl to `/metadata-preview` worked with `{ "url": "...", "platform": "instagram" }`, while the Edge Function reached the worker but received `worker_status = 422` from an invalid payload contract.
- `refresh-recipe-metadata` now validates the saved source URL before calling the worker, logs only safe payload proof fields (`url_present`, `url_length`, `url_host`), and sends the worker body as `{ url, platform }`.
- Worker 422 responses are classified as `worker_validation_error` without retrying or logging raw response text; missing/invalid saved URLs fail locally with `source_url_missing`.
- Saved link metadata failure remains non-blocking: no `media_jobs` are created, cards show `Saved Link` with `Details unavailable`, and Source Detail keeps `Retry details` plus `Generate AI Recipe`.

## M21.7F - Metadata Bridge Warmup and Saved-Link State Polish

- Status: Done after validation.
- Direct production worker curl to `/metadata-preview` works for the known Instagram URL, but the Supabase Edge metadata bridge had previously marked refreshes failed with `worker_status = 503`.
- `refresh-recipe-metadata` now warms the worker with best-effort `GET /ping`, uses a 30-second default metadata timeout, retries once with backoff for timeout/502/503/504, and classifies auth, unavailable, timeout, and config failures with safe error codes.
- Successful worker title, description, thumbnail, duration, platform, and safe metadata now persist back to `recipe_items`; partial useful metadata remains `partial`, and failed metadata remains a usable saved link without creating `media_jobs`.
- Home and Library cards now avoid overlapping/repeated pills and use a clean RD fallback thumbnail with one top status pill.
- Source Detail shows a calm metadata failure message with `Retry details` while keeping `Generate AI Recipe` available through backend access checks.
- The Android share route now saves through `save-recipe-link` and refreshes details through `refresh-recipe-metadata`, avoiding the old visible parse-preview flow.

## M21.7E - Metadata Bridge Fix and Saved-Link UI Cleanup

- Status: Done after validation.
- `refresh-recipe-metadata` now calls worker `/metadata-preview` with `Authorization: Bearer WORKER_API_SECRET`, a 25-second default timeout, and one retry for timeout/502/503/504 only.
- Successful worker title or thumbnail metadata now persists to `recipe_items` with `metadata_status = completed`; partial useful metadata stores `partial`, and failures keep the saved item usable.
- `source_metadata` on saved links is sanitized to safe fields only; full source URLs, thumbnails, CDN URLs, cookies, secrets, temp paths, Gemini URIs, and raw worker responses are excluded.
- Safe metadata refresh logs were added without source URLs, thumbnails, worker secrets, cookies, or raw responses.
- `create-media-job` now prefers `WORKER_API_SECRET` with `MEDIA_WORKER_SECRET` as a temporary fallback.
- `get-ai-access` / shared AI access reads `FREE_AI_GENERATION_LIMIT` from Edge Function env with fallback `3`.
- Home and Library now treat metadata failure as a usable Saved Link with `Details unavailable`; only AI job failures show `AI failed`.

## M21.7 - Worker Metadata + Modal Save UX

- Status: Done after validation.
- Center plus now opens a FoFo-style save modal instead of the old full add screen.
- Saving a link is one step: paste URL, call `save-recipe-link`, show the Home card immediately, then refresh metadata in the background through `refresh-recipe-metadata`.
- Home and Library cards now use user-facing states: Fetching details, Saved Link, Analyzing, AI Recipe, and Failed.
- Source Detail is focused on the saved source, original video link, AI recipes left, and one primary `Generate AI Recipe` CTA.
- `Generate AI Recipe` is the only user-facing action that calls `create-media-job`; saved links and metadata refresh do not consume AI credits.
- AI credit limit errors show the upgrade placeholder copy instead of a generic generation failure.
- Recipe result UI stays focused on recipe content and source actions while keeping technical details dev-only.

## M21.7B - Supabase Saved-Link and Worker Metadata Bridge

- Status: Done after validation.
- Added `save-recipe-link` for authenticated/anonymous users to create saved `recipe_items` only; it does not create `media_jobs`, call AI, or consume credits.
- Added `refresh-recipe-metadata` to call the protected worker `/metadata-preview` endpoint with server-side worker secrets and store only safe metadata on `recipe_items`.
- Metadata preview failures mark the saved item failed without deleting it or blocking the saved-link flow.
- `create-media-job` can now start AI analysis from `recipe_item_id`; it verifies ownership, enforces AI access, then creates the linked `media_jobs` row.
- Edge Functions own auth and DB writes; the worker owns metadata extraction and AI analysis.
- Saved links and metadata preview remain unlimited; AI generation remains credit-gated.

## M21.6 - UX Flow Simplification and Single AI Credit Source of Truth

- Status: Done after validation.
- Saved links, metadata preview, library, and grocery viewing are unlimited for the MVP; visible saved-link and grocery quotas were removed.
- Home, Settings, and saved-link detail now use `get-ai-access` for AI generation credit state instead of local recipe-card remaining values.
- Saved-link detail has one user-facing AI action: `Generate AI Recipe`, which uses the backend-gated `create-media-job` flow.
- The old user-facing manual `generate-card` path is no longer exposed from saved-link detail.
- `ai_credit_limit_reached` now shows a clear "Free AI recipes used" upgrade placeholder with Unlock Premium and Maybe later actions.
- Recipe result UI hides model/source-mode/confidence debug badges from production UI and keeps technical details in a dev-only section.

## M21.5 - Dev Identity Switcher and AI Access QA

- Status: Done after validation and deployment.
- Added a dev-only Settings panel gated by `__DEV__` or `EXPO_PUBLIC_DEV_TOOLS_ENABLED=true`.
- Dev tools show current Supabase anonymous user ID, anonymous status, saved local identity status, and safe AI access state.
- Developers can copy the current user ID, refresh access state, create a fresh anonymous test user, and switch to anonymous users previously saved on the same device.
- Added `get-ai-access` Edge Function using the same server-side access helper as `create-media-job` without creating jobs or exposing source URLs/secrets.
- Mobile dev tools do not allow role changes; admin/tester/premium simulation remains SQL-only.

## M21 - Monetization / Account Foundation

- Status: Done after validation and deployment.
- Added anonymous-first account and entitlement foundation on `user_profiles` for roles, tester flags, AI monthly overrides, and RevenueCat premium entitlement mirror fields.
- Added server-side AI generation access checks before `create-media-job` inserts queued jobs.
- Free users can create jobs while under 3 lifetime successful AI media generations; failed jobs do not count.
- Premium, tester, and admin users use monthly fair-use limits without adding full paywall or signup UI.
- Queue processor behavior remains unchanged after access is granted.

## M19 - App E2E Polish

- Status: Done after validation.
- URL preview now keeps working when metadata fetch fails, and uses safe preview metadata when available: title, thumbnail, creator, platform, and duration.
- Media job and saved-link views prefer live `source_metadata` title/thumbnail while keeping source metadata separate from generated recipe-card titles.
- Completed jobs route only through `media_jobs.result_recipe_card_id`; missing result links show a safe unavailable state while polling can continue.
- Recipe result rendering now handles normalized/stringified JSON more defensively, avoids blank Urdu cards, derives grocery rows from ingredients when needed, and strips old markdown markers from displayed recipe text.
- The app clearly shows the 2-minute video analysis limit and handles over-limit duration errors with friendly copy.

## M17B - Explicit Queue Processor Mode with Render Wake

- Status: Done after validation.
- Added `MEDIA_PROCESSOR_MODE=queue` for Render queue workers: media jobs remain `queued`, `/process-job` is not called, and the worker can be woken with a short GET `/wake` request.
- Queue mode records `queued_for_queue_worker` plus a wake success/failure event without storing the worker URL.
- Manual mode and worker webhook mode remain unchanged.

## A-M15C - Real Source Metadata Display

- Status: Done after validation.
- Media job polling now includes `source_metadata` and the app displays safe source title, description, platform, resolver, duration, size, and thumbnail metadata when available.
- Completed recipe result screens can show the same safe source metadata without querying private processing metadata or displaying CDN URLs.
- Mock recipe result labeling remains subtle and development-oriented.

## A-M15B - Public Source Metadata + Private Processing Metadata Schema

- Status: Done after migration applied.
- Added public app-visible `media_jobs.source_metadata` JSONB storage for safe source metadata.
- Added private backend-only `media_job_private_metadata` storage for resolver/CDN/raw processing metadata.
- CDN URLs remain backend-only and must not be stored in `media_jobs.source_metadata`.

## Current Worker Testing

- A-M14R1 local worker testing requires `MEDIA_PROCESSOR_MODE=manual` for `supabase/functions/create-media-job`.
- Cloud Run worker triggering remains available with `MEDIA_PROCESSOR_MODE=worker`, the default.
- During local and Render worker testing, Cloud Run is bypassed so app-created `media_jobs` can stay queued for manual/local processing instead of being picked up by the old worker.
