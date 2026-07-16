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

The development override is intentionally absent from checked-in environment
files and EAS profiles. Remove it from the shell/EAS environment or set it to
`false` immediately after the single verification, then rebuild/restart Metro.
Values other than the exact lowercase string `true` do not enable reporting.

The runtime DSN is a public client identifier and must be configured externally
as `EXPO_PUBLIC_SENTRY_DSN`. Never store `SENTRY_AUTH_TOKEN` in an
`EXPO_PUBLIC_` variable; it is a build-only secret.

Initialization also disables default PII, request-failure capture, performance
tracing, screenshots, view hierarchy attachments, and breadcrumbs. Events drop
request, user, message, context, extra, and fingerprint fields before sending;
exception text is replaced with a fixed safe value while safe error type and
stack coordinates remain available. Missing or malformed configuration leaves
the app operational with reporting as a no-op.

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
`EXPO_PUBLIC_POSTHOG_DEV_TEST` is intentionally excluded from EAS sync and must
not persist after a controlled test. The former wizard name
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
