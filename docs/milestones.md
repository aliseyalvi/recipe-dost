# Recipe Dost Milestones

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
