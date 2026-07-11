# M22E Professional UX Recovery Audit

Date: 2026-07-10

## Scope

M22E.1R-A is an audit-only recovery pass on `develop`. It makes no runtime, schema, Edge Function, worker, RevenueCat, quota/access, package ID, or environment-file changes. The recovery target is a credible versionCode 2 internal-test build without expanding beyond Recipe Dost's link-first recipe-card flow.

## Problems And Root Causes

### Tags

`recipe_cards.tags_json` already exists as `jsonb not null default '[]'::jsonb`. The mobile detail query and Library query both read it, normalize it to `string[]`, and the detail screen intentionally hides the tag section for an empty array. The QA observation is therefore consistent with the data path: tags are not being hidden by the app; the tested generated cards have no tags to render.

This audit did not query production rows directly. The data conclusion is based on the reported new-card result and the schema default. Development QA must safely inspect one disposable completed card before and after the owner fix: `tags_json` is expected to be `[]` today, then to contain 5-8 normalized tags.

The active user-facing generation path is `app -> create-media-job -> media_jobs -> external Render media worker -> recipe_cards`. `create-media-job` only creates the job and wakes `POST /process-job`; it does not generate or persist a recipe card. The external worker repository/service, absent from this repository, owns the AI prompt/schema and the `recipe_cards` insert/update that must write tags.

The in-repo legacy `generate-card` Edge Function does require `tags` and writes `card.tags` to `recipe_cards.tags_json`, but the app no longer invokes it for saved-link generation. Updating that function alone would not change production media-job results. The required worker contract change is: require a concise `tags` array, normalize/lowercase/deduplicate it, cap it at 5-8 useful values, and map it to `tags_json` when the worker inserts or updates the result card. Update `docs/ai-prompt-contract.md` afterward to mirror the deployed worker contract rather than documenting a dead path.

### Search

Library client-side filtering already matches user-owned title, source URL, source metadata title/description/author/platform/host, platform, notes, captions, manual ingredients, cuisine, meal type, AI title/summary, tags, ingredient fields, and step fields. That is suitable for the beta data volume and does not add a new backend/RLS risk.

It is not yet a strong product surface: search exists only in Library, tags are neither visible on list cards nor tappable from detail, empty live tags make tag search ineffective, the input offers no visible tag/filter discovery, and no-results copy says “another chip or search term” even when the cause is a text query. Raw search text is correctly not tracked and must remain untracked.

### Favorite And Delete

`recipe_items` has no `is_favorite` or `deleted_at`; there is no favorite/delete mutation or UI. Favorite needs a small development migration: `recipe_items.is_favorite boolean not null default false`, regenerated Supabase types, and a mutation constrained by both `id` and `user_id`. Existing RLS already permits only user-owned updates, so no new policy is required when that predicate remains in place.

Hard delete needs no schema migration. Existing RLS permits user-owned `recipe_items` deletion, and foreign keys cascade through recipe cards, media jobs/events, metadata logs, and collection items. `grocery_lists.source_recipe_ids` is a UUID array rather than a foreign key, so the implementation must clean those user-owned arrays or deliberately accept stale internal IDs. For versionCode 2, confirmed hard delete is lower risk than adding a soft-delete model, restore flow, and list filtering.

### Paywall

The current warm benefit list plus equal-width three-column comparison repeats the offer, crowds phone-width cells, and makes shared capabilities look like plan differentiators. `Saved recipe links: Included`, `Beta video length: Up to 2 min`, grocery, and Urdu/English rows have the same values in both columns, so they dilute the real decision. `Ingredients + steps: On 3 AI cards` is accurate but is too detached from the essential explanation: saving a link alone does not generate ingredients or steps.

The professional replacement is:

1. Existing usage pill first: remaining AI cards, billing/lifetime wording, and active processing count when available.
2. A compact Free/Premium comparison centered on the actual difference: `3 AI recipe cards total` versus `100 AI recipe cards each month`.
3. One shared-capability note: every generated AI card includes ingredients, steps, grocery help, and Urdu + English recipe help; saving a link alone does not create those details.
4. Existing Google Play product selection, purchase, restore, active state, and RevenueCat `premium` entitlement unchanged.

### Processing

M22E.1B's focus/foreground refresh and bounded active-state polling are sound. Saved-link detail distinguishes saving, pending, and failed metadata; active AI jobs have numeric progress plus leave/wait actions. The visual treatment remains weak: metadata states are plain text cards without a progress cue or direct leave action, every job is labeled “Analyzing” despite richer backend stages, Wait here has no explicit refreshing feedback, and error/retry states lack one consistent visual hierarchy.

The replacement should be a shared processing panel. It maps existing job statuses to friendly stages, shows determinate progress where supplied and indeterminate metadata progress otherwise, makes leaving the primary action, and lets Wait here visibly refresh without creating a second job. Existing polling, foreground refetch, failure handling, and result routing remain unchanged. No push-notification promise is added.

## Exact Implementation Sequence

1. Fix the external worker recipe-card contract and persistence mapper first. Deploy only to development and verify a disposable media-job result writes 5-8 safe tags to the linked `recipe_cards` row.
2. Align this repository's prompt-contract documentation with that worker contract. Do not treat the legacy `generate-card` function as the production fix.
3. Refine Library search presentation: a clear search affordance, visible tag previews where the card layout permits, tappable detail tags that open Library with an encoded query, and query-aware no-results guidance. Keep client-side matching and do not track raw text. A Home search entry point is optional; do not duplicate a second search flow before Library QA passes.
4. Add the favorite migration and type regeneration, then guarded mutations/actions in Home, Library, saved-link detail, and AI-card detail. Invalidate `['recent-recipes']`, `['recipe-library']`, and affected detail keys.
5. Add confirmed hard delete in detail screens first. Scope the delete by current user, resolve `grocery_lists.source_recipe_ids`, invalidate list/detail/grocery keys, and navigate only after success.
6. Replace the paywall composition with the focused quota comparison and existing access data. Do not alter access arithmetic, products, or entitlement behavior.
7. Replace the processing-card composition with the shared stage-aware panel. Add only safe leave/wait/retry interaction events.
8. Run static and development environment validation, worker development QA, true fresh-install QA, and Google Play internal-test QA before building the production versionCode 2 AAB.

## Acceptance Criteria

- A media-job-generated card has 5-8 normalized `tags_json` values, renders chips on detail, and existing empty-tag cards still load cleanly.
- Tapping a tag opens Library with matching user-owned results; Library search finds title, source/platform, ingredient, step, and tag values.
- Free copy says exactly `3 AI recipe cards total`; Premium says exactly `100 AI recipe cards each month`; shared generated-card benefits do not imply details are produced for saved links alone.
- Favorite state persists across restart and appears consistently on Home, Library, saved-link detail, and AI-card detail.
- Confirmed delete removes a user's link/card from all active views and does not expose another user's data.
- Processing shows a clear stage, Go back does not cancel work, Wait here does not create a duplicate job, and completed/failed jobs settle in a clear action state.
- Fresh install reaches Welcome before onboarding completion; the completed returning anonymous session still reaches Home.

## Manual QA Checklist

- Generate a development AI card and inspect the linked `recipe_cards.tags_json`; confirm 5-8 lowercase tags and no raw source/video values.
- Open the card, verify chips, tap a chip, and confirm Library shows the source card.
- Search by title, author/platform, ingredient, step, and tag; try a no-match query and confirm query-specific guidance.
- Favorite/unfavorite from every required surface; restart and confirm persistence.
- Cancel then confirm deletion; verify Home, Library, details, AI card, and grocery views no longer expose the recipe.
- Save a link and observe saving, pending, completed, and failed metadata. Leave during pending, background/reopen, and verify refresh.
- Start AI generation, use Wait here, then Go back; verify one continuing job and eventual completed card.
- Test paywall as Free and Premium; confirm usage, comparison copy, purchase/restore, and `premium` active state remain correct.
- Perform a true fresh install with no restored app data, then verify Welcome/onboarding and returning-session Home routing.

## M22E.1D/E Disposition

- Keep: M22E.1B refresh/invalidation work; it addresses the stale metadata defect independently of this UX audit.
- Keep but complete: tag/ingredient/step list normalization and conditional tag detail rendering; they become useful after the worker writes tags.
- Replace: current search/tag presentation, paywall benefit-list/equal-cell table, and processing-card composition.
- Do not revert: stronger Open Original Video placement or current failure/retry behavior; include them in the redesign.
- Still missing: favorite/unfavorite, confirmed delete, manual tags, visible tag navigation, and the selected New AI Recipe ribbon. Manual tags and the ribbon remain secondary to the recovery-critical work.

## M22E.1R-C Professional Search And Tag UX

Status: implemented on `develop`; device QA pending.

- Library remains the dedicated retrieval surface. Its existing client-side, user-owned search now presents active text queries as compact result rows with thumbnail, platform badge, AI Recipe/Saved Link badge, title, available time/servings, and up to three tag chips.
- Search continues to cover saved-link title, AI recipe title/summary, source URL and source metadata title/author/platform/host, notes/captions/manual ingredients, cuisine/meal type, platform, AI ingredients, AI steps, and `recipe_cards.tags_json`.
- Recipe-card detail shows up to eight existing tags as rounded chips. Tapping one opens Library with that tag prefilled as the search query; the interaction tracks only a safe tag-count property, never the tag text or recipe content.
- The Library search field now has a clear affordance, a query-scope hint, and a query-aware no-results state: “No recipes found” with suggested terms and a clear search/filter action. Existing grid browsing, content filters, sorting, refresh, and foreground behavior remain unchanged.
- No schema, worker, access, RevenueCat, package ID, or environment change was added. Cards with empty tags remain supported; tag search is only useful when the active worker has populated `tags_json`.

M22E.1R-C manual QA:

- Search `chicken` against a recipe title, ingredient, and generated tag.
- Search `instagram` and confirm Instagram saved recipes appear.
- Open a generated recipe, tap a tag, and confirm Library opens with that tag applied.
- Search a no-match term and verify the compact no-results state plus clear action.
- Open older cards with empty tags and confirm no blank tags section or layout issue.
- Check active search rows on a small Android screen: thumbnail, badges, metadata, and tag chips must not overflow.

## M22E.1R-D Favorite And Delete Recipe Management

Status: implemented on `develop`; development database apply and device QA pending.

Migration: `supabase/migrations/20260711080652_m22e_recipe_management.sql`.

- `recipe_items.is_favorite boolean not null default false` owns favorite state for both saved-link and AI-card surfaces.
- `recipe_items.deleted_at timestamptz null` provides soft delete. The migration also adds a partial active-library index on `(user_id, created_at desc)` where `deleted_at is null`.
- No RLS policy changed. Existing select/update RLS policies require the authenticated user to own the `recipe_items` row. Every app mutation also scopes by both `id` and current `user_id`; favorite and delete only affect an active row where `deleted_at is null`.
- `deleteRecipe()` sets `deleted_at`; it does not delete the original social video, recipe-card data, jobs, or accounting rows. Home, Library, Search, saved-link detail, recipe-card detail, and grocery readers now require an active parent recipe item, so soft-deleted records are not presented again.
- Favorite/unfavorite is available in both detail headers and is reflected on Home/Library cards. Delete is a confirmed danger action on both detail surfaces and routes to Library after success.
- Query invalidation covers `['recent-recipes']`, `['recipe-library']` (including active search results), affected recipe-item/card details, and grocery list keys. No quota/access, RevenueCat, paywall, product, or original-video behavior changed.

Development apply command after code review:

```sh
node scripts/env/run-with-env.mjs development -- supabase db push --linked
```

Do not apply this migration to production until development migration/device QA passes. Rollback is only appropriate before feature data is relied upon: first revert the app code, then in development run `alter table public.recipe_items drop column if exists deleted_at, drop column if exists is_favorite;`. Do not run that destructive rollback on production without an explicit data-retention decision.

M22E.1R-D manual QA:

- Apply the migration to development, save a new link, and confirm `is_favorite = false` and `deleted_at is null`.
- Favorite/unfavorite from saved-link and AI-card detail; verify Home and Library badges, background/reopen persistence, and no paywall/access change.
- Delete from saved-link detail, cancel once, then confirm. Verify Home, Library, active search, saved-link detail, AI-card detail, and grocery views no longer expose the recipe.
- Repeat deletion from AI-card detail and confirm the app returns safely to Library.
- Verify a second anonymous/dev user cannot favorite or delete another user's ID through the app/RLS.
- Confirm older rows load with the migration defaults and empty tags continue to render cleanly.

## Release Note

This audit-only patch does not require an AAB. Any runtime recovery release for internal testers requires the production versionCode 2 AAB, unless another release consumes that version code first.
