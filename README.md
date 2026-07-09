# Recipe Dost

Recipe Dost is an Android-first Expo React Native app. The MVP is link-first:
paste or share a recipe URL, optionally add a note, generate an AI recipe card,
save it to the library, create a grocery list, and use the Premium paywall when
AI access is exhausted.

## Branch Model

- `main` is production-stable.
- `develop` is daily development.
- Bug fixes start on `develop` first.
- Release flow: QA on `develop`, merge to `main`, production build from `main`,
  then upload the new AAB to Google Play internal testing.

Production builds are blocked unless the current Git branch is `main`. Use the
emergency override only when deliberately shipping from another branch:

```sh
ALLOW_NON_MAIN_PROD_BUILD=1 npm run build:prod
```

## Environment Files

Local env files are the source of truth and are intentionally gitignored:

- `env/development.env`
- `env/production.env`

Do not manually source these files in a normal terminal. Load custom env files
through the scripts in `scripts/env/` so Expo, EAS, and Supabase commands receive
the right values without printing secrets.

## Env Doctor

Run these before app launches, env deploys, or builds when you want a safe
operator summary:

```sh
npm run env:doctor:dev
npm run env:doctor:prod
```

The env doctor validates the selected env file, resolves the Expo Android
package, reports the current Git branch, and prints only safe summary fields:
`APP_ENV`, `APP_VARIANT`, Supabase project ref or URL host, and RevenueCat key
type. It must not print secret values.

## Normal Development

Use the development env for day-to-day Android work:

```sh
npm run dev:android
```

This loads `env/development.env` and starts Expo with the dev client. Normal
development should happen on `develop`.

Use production env locally only for explicit smoke testing:

```sh
npm run dev:android:prod-smoke
```

This command is intentionally named loudly because it loads `env/production.env`.
Do not use it for routine development.

## Builds

Development and preview builds use `env/development.env` and normally run from
`develop`:

```sh
npm run build:dev
npm run build:preview
```

Production builds use `env/production.env`, require branch `main`, reject the
known development Supabase project ref, reject RevenueCat Test Store Android
keys, sync env, and build the Android App Bundle:

```sh
npm run build:prod
```

Use the emergency override only when the non-`main` production build is
intentional and approved:

```sh
ALLOW_NON_MAIN_PROD_BUILD=1 npm run build:prod
```

## Env Deploys

Deploy app env values through the scripts, not by manually exporting variables:

```sh
npm run env:deploy:dev
npm run env:deploy:prod
```

These commands sync allowlisted EAS public/app variables and Supabase Edge
Function secrets/config from the selected gitignored env file.

## Validation

Before finishing code changes, run:

```sh
npm run typecheck
```

For broader static QA, run:

```sh
npm run qa:static
```

For Supabase Edge Function checks, run:

```sh
npm run functions:check
```
