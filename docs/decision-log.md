# Recipe Dost Decision Log

## 2026-06-20
- Project created as Expo React Native + TypeScript app.
- Backend selected: Supabase Auth + Postgres + Edge Functions.
- App direction: Android-first, link-first AI recipe organizer.
- Compliance rule: save links, notes, metadata, and AI recipe cards only. Do not download videos.
- Free plan: 20 saved links, 3 AI recipe cards, 3 grocery lists.
- Paywall trigger: after first successful AI recipe card and after free usage limits.
- Development method: use ChatGPT for planning and Codex for repo changes.
- Initial Supabase schema migration added for auth.users-backed profiles, recipe links, AI recipe cards, collections, grocery lists, usage counters, subscriptions, metadata logs, and support tickets.
- RLS baseline: authenticated users can access only rows where user_id equals auth.uid(); service-role Edge Functions remain responsible for AI generation, usage enforcement, subscription sync, and metadata logging.

## 2026-06-21
- Milestone M1 app foundation added with Expo Router routes for welcome, onboarding, home, library, grocery, settings, save recipe, and paywall.
- Root providers added for TanStack Query, i18n, PostHog placeholder tracking, and Sentry placeholder wrapping.
- Theme tokens and reusable UI primitives added for buttons, cards, inputs, text areas, empty states, error states, and loading states.
- Development telemetry decision: Sentry, PostHog, and RevenueCat are not initialized in development to avoid accidental quota usage; production setup will be handled in a later milestone.
