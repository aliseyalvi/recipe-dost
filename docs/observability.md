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
