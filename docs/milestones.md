# Recipe Dost Milestones

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
- `ai_credit_limit_reached` now shows a clear "Free AI recipes used" upgrade placeholder with Unlock Pro and Maybe later actions.
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
