# PostHog integration report

## Current architecture

- SDK: `posthog-react-native@4.50.0`.
- Provider: one client owned by `src/providers/posthog-placeholder-provider.tsx`;
  the filename is retained for stable imports, but it is no longer a no-op.
- Expo plugin: not installed or configured. The plugin/native symbols path is
  unnecessary because Sentry owns error monitoring and PostHog native errors
  are prohibited.
- Optional peers: the Expo app/device/file/localization/safe-area peers used by
  the SDK are installed. Replay and native-error plugin peers are intentionally
  absent; other declared peers are optional and not required by this setup.
- Disabled: Session Replay, touch/screen/lifecycle autocapture, exception/error
  capture, exception steps, logs, flags, surveys, remote config, GeoIP, and
  verbose debug output.

## Transmission gate

Production transmits only with production env + production variant and valid
`EXPO_PUBLIC_POSTHOG_API_KEY` / `EXPO_PUBLIC_POSTHOG_HOST`. Development and
preview fail closed. A development/development build may temporarily transmit
only with exact `EXPO_PUBLIC_POSTHOG_DEV_TEST=true`; preview remains blocked.
The override is not included in EAS sync and must be removed after one test.

## Privacy and identity

Typed helpers and a runtime event/property allowlist feed a `before_send`
sanitizer. Unknown names/properties, URLs, route/search/content values, person
fields, raw errors, auth/token material, and purchase/package/customer payloads
are removed. Strings are capped at 80 characters. Screens are normalized and
contain no route params. Identify accepts only a Supabase UUID and sets no
person properties; logout/session loss/user switching resets the client.

## Wizard artifacts superseded

The former report claimed a config file/client, touch capture, fallback `App.tsx`
wrapper, planned routes that do not match this repository, and completed
dashboards. Those claims did not match the audited runtime. The unused no-op
`src/config/posthog.ts` was removed. Old dashboard links may point to an existing
project but are not treated as current-project verification. No new PostHog
organization, project, insight, or dashboard was created.

## External completion

Configure the public project token and matching HTTPS ingest host in the
production EAS environment. Run the one-shot Settings verification described in
`docs/observability.md`, inspect Live Events for the safe schema, and remove the
override. Dashboards, flags, experiments, and worker analytics are deferred.
Static QA and nine analytics tests pass. Real development and production env
validation currently stops because the configured host is a label rather than
an HTTPS origin. No PostHog connector was available, so dashboard verification
and controlled device delivery remain external steps.
