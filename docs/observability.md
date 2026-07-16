# App observability

## Sentry transmission environments

Sentry fails closed. The app initializes the SDK only when a valid
`EXPO_PUBLIC_SENTRY_DSN` is present and the generated Expo configuration permits
transmission.

- Production: enabled only when `APP_ENV=production` and
  `APP_VARIANT=production`.
- Preview: always disabled, including when the development test override is
  present.
- Development: disabled by default. One controlled verification may opt in by
  setting `APP_ENV=development`, `APP_VARIANT=development`, and
  `EXPO_PUBLIC_SENTRY_DEV_TEST=true` for that development build or Metro
  session.

Every checked-in EAS profile pins both controlled-test flags to `false`.
Temporarily override the development flag only for the controlled verification,
then restore `false` and rebuild/restart Metro.
Values other than the exact lowercase string `true` do not enable reporting.

The runtime DSN is a public client identifier and must be configured externally
as `EXPO_PUBLIC_SENTRY_DSN`. Never store `SENTRY_AUTH_TOKEN` in an
`EXPO_PUBLIC_` variable; it is a build-only secret.

Initialization also disables default PII, request-failure capture, performance
tracing, screenshots, view hierarchy attachments, and breadcrumbs. Events drop
request, message, context, extra, and fingerprint fields before sending;
exception text is replaced with a fixed safe value while safe error type and
stack coordinates remain available. User context is absent unless it is exactly
the current Supabase UUID, in which case only `user.id` remains. Missing or
malformed configuration leaves the app operational with reporting as a no-op.

## PostHog product analytics

PostHog is product analytics only; Sentry remains the only technical exception
monitor. The mobile SDK is initialized only with a valid public project token
and HTTPS host and one of these exact build modes:

- Production: `APP_ENV=production` and `APP_VARIANT=production`.
- Development controlled test: `APP_ENV=development`,
  `APP_VARIANT=development`, and exact
  `EXPO_PUBLIC_POSTHOG_DEV_TEST=true`.
- Ordinary development and every preview build: disabled. Preview cannot be
  enabled by the development override.

Missing/placeholder configuration fails closed without blocking the app. The
required production EAS variables are `EXPO_PUBLIC_POSTHOG_API_KEY` (the public
project token) and `EXPO_PUBLIC_POSTHOG_HOST` (the matching ingest origin).
Every EAS profile pins `EXPO_PUBLIC_POSTHOG_DEV_TEST=false`; it must not remain
enabled after a controlled test. The former wizard name
`EXPO_PUBLIC_POSTHOG_KEY` is deprecated; no `POSTHOG_CLI_*` configuration is
required for mobile event ingestion.

While the controlled development mode is active, ordinary product and screen
events remain suppressed; only the intentional test event and UUID-only
identity/reset lifecycle are permitted.

Runtime protections:

- Session Replay, screen/touch/lifecycle autocapture, geographic enrichment,
  surveys, feature flags, remote config, logs, exception steps, JS/native error
  capture, and PostHog debug output are disabled.
- One root tracker maps routes to `home`, `add_recipe`, `library`,
  `saved_link_detail`, `ai_recipe_detail`, `grocery`, `grocery_list_detail`,
  `settings`, `paywall`, or `onboarding`. IDs, pathnames, route/query params,
  and search text are never sent.
- Events pass through a closed event/property schema and `before_send` defense.
  Unknown names/properties, URL-shaped values, token/authorization patterns,
  raw error fields, and strings longer than 80 characters are dropped.
- Blocked keys include email, phone, name/title/creator, URL/link/path, recipe
  and ingredient content, notes/captions, prompts/responses, error/message/stack,
  secrets/tokens/cookies, search/query text, and purchase/package/transaction or
  customer payloads.
- Identification accepts only the Supabase UUID and sends no person properties.
  Logout, session loss, and user switching reset PostHog identity.

The beta funnel includes app/opening, onboarding, Add Recipe, link save and
metadata outcomes, AI request/queue/terminal outcomes, recipe detail, Library
search, Grocery open, Paywall selection, confirmed purchase outcomes, restore,
and the controlled development test. Success events are emitted only after the
corresponding backend/entitlement state is known.

### One controlled development verification

Load development values into the current shell, override the test flag for only
that command, and restart Metro so Expo embeds the values:

```sh
set -a
source env/development.env
set +a
APP_ENV=development APP_VARIANT=development EXPO_PUBLIC_POSTHOG_DEV_TEST=true npm exec expo start -- --dev-client --clear
```

In Settings > Developer, tap **Send PostHog test event** once. The button locks,
the SDK captures exactly `posthog_test_event`, and the app flushes it. Verify in
the existing PostHog project's Live Events that its only custom properties are
`app_env`, `platform`, `test_source`, and `analytics_schema_version`. Then stop
Metro. In `env/development.env`, remove `EXPO_PUBLIC_POSTHOG_DEV_TEST` or set it
to `false`, and restart normally:

```sh
npm run env:validate:dev
npm run dev:android
```

The control must disappear and development transmission must return to a no-op.
No dashboard/project was created by this milestone; dashboard verification is
an external follow-up against the existing project. To emergency-disable
production analytics, remove either PostHog public variable from the production
EAS environment and rebuild. Dashboards, flags, experiments, and worker-side
analytics remain deferred.

## M22E.2E unified responsibility matrix

“App Sentry: yes” means an unexpected technical exception only. PostHog
properties are closed, normalized scalar allowlists; worker Sentry uses only
active-flow tags and safe retry state.

| Signal | App Sentry | PostHog | Worker Sentry | Safe properties | Expected/noise exclusion |
| --- | --- | --- | --- | --- | --- |
| Mobile crash | yes | no | no | env/variant/version/build; UUID-only user | expected UI/product states excluded |
| React render failure | yes | no | no | same app metadata | one root boundary; retry captures only a new throw |
| Mobile API/query failure | yes | no | no | no request/body/content | grocery query errors dedupe by error transition |
| Link validation failure | no | no | no | none | empty, invalid, unsupported links are expected |
| Quota blocked | no | `ai_generation_blocked` | no | entry point, tier, failure code | paywall/quota denial are expected |
| Metadata terminal failure | technical only | `metadata_preview_failed` | no | failure code | content/provider-unavailable outcomes excluded from Sentry |
| AI terminal failure | technical only | `ai_generation_failed` | no | platform, job status, failure code | quota/duration/safety/content-quality outcomes excluded |
| Worker provider exception | no | no | yes | service/flow/feature/operation/stage/code/platform | expected quota/auth/content refusals excluded |
| Worker retry exhaustion | no | no | yes | retry/exhausted/recoverable/terminal/status | intermediate retries dropped; exception object once |
| Paywall opened | no | `paywall_opened` | no | entry point, tier | quota-triggered display is not an exception |
| Purchase started | no | `purchase_started` | no | entry point, interval | duplicate taps blocked |
| Purchase completed | no | `purchase_completed` | no | entry point, interval, success | only after local and backend Premium sync |
| Purchase cancelled | no | `purchase_cancelled` | no | entry point, interval, cancelled | never a failure/crash |
| Purchase failed | technical only | `purchase_failed` | no | entry point, interval, failure code | pending/already-owned expected; no store identifiers |
| Restore failed | technical only | `restore_failed` | no | entry point, failure code | not-ready/no-purchase is not a crash |
| Onboarding started | no | `onboarding_started` | no | none | once after guards; completed users excluded |
| Onboarding completed | no | `onboarding_completed` | no | none | only after persistence succeeds |
| Onboarding skipped | no | no separate event; successful Skip uses `onboarding_completed` | no | none | Skip shares persisted completion |
| Logout/user reset | clear user, no event | SDK `reset()`, no event | no | no person properties | old UUID cannot reach next session |

## Environment enablement matrix

| Runtime | Production | Normal development | Controlled development | Preview | Missing config |
| --- | --- | --- | --- | --- | --- |
| App Sentry | production env/variant + valid DSN | off | development env/variant + valid DSN + exact flag | hard off | off |
| PostHog | production env/variant + valid token/HTTPS host | off | development env/variant + valid project + exact flag; test event only | hard off | off |

| Worker Sentry case | Result |
| --- | --- |
| Render + production + `main` + valid DSN | enabled |
| Render + production + `develop` | disabled |
| Render + ordinary development | disabled |
| Render + development + `develop` + DSN + exact flag + controlled-test command | one diagnostic enabled |
| Render + development + `main` | disabled |
| Non-Render, missing branch, or missing/invalid DSN | disabled |

## Privacy, identity, expected outcomes, and duplicates

- App Sentry reconstructs an allowlisted event: fixed exception text, safe type
  and frame coordinates/basenames, safe release/dist, four app tags, and UUID-only
  `user.id`. Requests, headers, bodies, breadcrumbs, contexts, extras, messages,
  locals, source context, RevenueCat objects, URLs/tokens, and recipe/AI content
  are absent.
- PostHog accepts only `src/lib/analytics/policy.ts`. Unknown events/properties,
  URLs/search/content, Error/stack values, purchase identifiers, and email/name
  properties are dropped. Replay, autocapture, errors, logs, flags, surveys,
  tracing, and experiments remain off.
- Authentication identifies both systems with the Supabase UUID only. Session
  loss, sign-out, and user switch reset PostHog and clear Sentry; repeat identify
  for the same UUID is suppressed.
- Unsupported/invalid links, quota/paywall, purchase cancellation/pending,
  onboarding success/Skip, normal empty/loading, and expected offline/retry states
  are not Sentry exceptions. Bootstrap, render, terminal technical metadata/AI,
  Grocery query, offerings, non-cancellation purchase, restore, and access-refresh
  failures report through the sanitized helper.
- `app_opened`, screen views, onboarding, and loading have one-shot/transition
  guards. The duplicate generic plus shared save emissions were removed from the
  share-intent handler.
- Worker `before_send` keeps only current-flow/process diagnostic tags, safe retry
  context, fixed exception text, and sanitized frames. Legacy/untagged events,
  request/user/extra/breadcrumb/local data, expected outcomes, and intermediate
  retries are dropped. The active Render path remains `uvicorn app.main:app` ->
  queue loop -> queue job -> current extraction/Gemini/persistence flow; legacy
  direct routes remain uninstrumented.

## Dashboard acceptance checklist

App Sentry:

- [ ] Correct production environment and release/build tags.
- [ ] Current Supabase UUID only; a reset/new anonymous session never inherits
  the prior UUID; no email.
- [ ] No URLs, tokens, recipe/AI/purchase content, headers, or bodies.
- [ ] Readable stack; production source-map symbolication verified.

PostHog:

- [ ] Approved event name and only approved normalized properties.
- [ ] Correct anonymous/UUID state; logout starts a new anonymous identity.
- [ ] No content, Error/stack, URL/search text, or purchase identifier.
- [ ] No duplicate from rerender, focus, bootstrap, or share-intent flow.

Worker Sentry:

- [ ] `service=recipe-dost-media-worker`; correct environment/branch/release.
- [ ] Current active flow or controlled process diagnostic only.
- [ ] No request/user/locals/source context/URL/job/AI/transcript/recipe content.
- [ ] Retry exhaustion once; expected failures/intermediate retries absent.

## Production readiness and release-only evidence

EAS profiles map `APP_ENV`/variant and pin both controlled flags false. Production
runtime names are `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_POSTHOG_API_KEY`, and
`EXPO_PUBLIC_POSTHOG_HOST`. Source-map configuration uses `SENTRY_ORG` and
`SENTRY_PROJECT`; `@sentry/react-native/expo` is included only when both exist in
production. `SENTRY_AUTH_TOKEN` is a build-only EAS secret, never public, and is
not synced by the general runtime helper.

Render production requires production + `main` + DSN + test flag false. Render
development requires development + `develop` and the flag restored false after
verification; a retained DSN is inert under the runtime guard.

M22E.2E did not deploy or emit another controlled event. Remaining release-only
checks are real production source-map symbolication and real production PostHog
delivery for the versionCode 2 release candidate. App version `1.0.0` and Android
`versionCode` 1 remain unchanged in this milestone.
