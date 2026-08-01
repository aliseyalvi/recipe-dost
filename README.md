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

# Deployment Quick Guide

Details: [release runbook](docs/m22e-1.0.1-beta-release.md), [production Supabase](docs/m22d-production-supabase-setup.md), [worker environments](../recipe-dost-media-worker/docs/m22d-worker-environments.md).

## 1. Environment Map

1. Development: app/worker branch `develop`; package `com.recipedost.dev`; EAS environment/profile `development`/`development`; development Supabase `…woki`; Render service/group `recipe-dost-media-worker-dev`/`recipe-dost-worker-dev`.
2. Production: app/worker branch `main`; package `com.recipedost.app`; EAS environment/profile `production`/`production`; production Supabase `…blfw`; Render service/group `recipe-dost-media-worker-prod`/`recipe-dost-worker-prod`.

Production-internal APK profile is not currently configured. Use the development APK for development QA and the production AAB for Play closed testing.

## 2. Development Update

1. Pull `develop` and require clean output from both worktrees:

   ```sh
   cd /Users/sadaqatali/Documents/AiAppBuilder/recipe-dost/recipe-dost
   git switch develop && git pull --ff-only origin develop && git status --short --branch
   cd /Users/sadaqatali/Documents/AiAppBuilder/recipe-dost/recipe-dost-media-worker
   git switch develop && git pull --ff-only origin develop && git status --short --branch
   ```

2. Run existing validations:

   ```sh
   cd /Users/sadaqatali/Documents/AiAppBuilder/recipe-dost/recipe-dost
   npm run qa:static && npm run test && npm run doctor && npm run functions:check && npm run env:doctor:dev
   cd /Users/sadaqatali/Documents/AiAppBuilder/recipe-dost/recipe-dost-media-worker
   make check-dev && python -m unittest discover -s tests -p "test_*.py" && python -m pip check
   ```

3. From the app repo, link development, inspect, dry-run, then apply canonical pending migrations:

   ```sh
   node scripts/env/run-with-env.mjs development -- sh -c 'supabase link --project-ref "$SUPABASE_PROJECT_REF" --yes'
   supabase migration list --linked
   supabase db push --linked --dry-run
   supabase db push --linked && supabase migration list --linked
   ```

4. Dry-run/sync function secrets, then deploy each changed function (replace `<changed-function>`):

   ```sh
   npm run env:supabase:dev:dry
   node scripts/env/sync-supabase-secrets.mjs development --apply
   node scripts/env/run-with-env.mjs development -- sh -c 'supabase functions deploy <changed-function> --project-ref "$SUPABASE_PROJECT_REF"'
   ```

5. Push worker `develop`, record `git rev-parse HEAD`, and deploy that SHA from the development Render service:

   ```sh
   cd /Users/sadaqatali/Documents/AiAppBuilder/recipe-dost/recipe-dost-media-worker
   git push origin develop && git rev-parse HEAD
   ```

6. Verify safe development health output:

   ```sh
   cd /Users/sadaqatali/Documents/AiAppBuilder/recipe-dost/recipe-dost
   node scripts/env/run-with-env.mjs development -- sh -c 'curl -fsS "${MEDIA_WORKER_URL%/}/health" | jq -e ".safe_config | {app_env, worker_execution_mode, process_job_mode, max_source_video_duration_seconds, queue_idle_poll_seconds, queue_stale_after_seconds, queue_stale_max_recovery_attempts, queue_stale_scan_interval_seconds, raw_url_logging_enabled, config_source}"'
   ```

7. Generate/install the dev-client APK; test onboarding, Magic Link recovery, FIFO queue processing, and sources through three minutes:

   ```sh
   npm run build:dev
   ```

## 3. Production Release

1. Require development QA and clean app/worker worktrees. Push app `develop`, open/review/merge its `develop` -> `main` PR, then:

   ```sh
   cd /Users/sadaqatali/Documents/AiAppBuilder/recipe-dost/recipe-dost
   git switch develop && git push origin develop
   git switch main && git pull --ff-only origin main && git status --short --branch
   npm run env:doctor:prod && npm run build:prod:dry
   git rev-parse HEAD
   ```

2. Promote worker with its fast-forward convention and record the production SHA:

   ```sh
   cd /Users/sadaqatali/Documents/AiAppBuilder/recipe-dost/recipe-dost-media-worker
   git switch main && git pull --ff-only origin main && git status --short --branch
   git merge --ff-only develop && make check-prod
   git push origin main && git rev-parse HEAD
   ```

3. Link guarded production, inspect history, and dry-run. Stop unless the target ends `…blfw` and only reviewed migrations are pending:

   ```sh
   cd /Users/sadaqatali/Documents/AiAppBuilder/recipe-dost/recipe-dost
   node scripts/env/run-with-env.mjs production -- sh -c 'supabase link --project-ref "$SUPABASE_PROJECT_REF" --yes'
   supabase migration list --linked
   supabase db push --linked --dry-run
   npm run env:supabase:prod:dry
   ```

> **WARNING:** Obtain manual confirmation immediately before the first production write below.

4. After approval, apply migrations, sync secrets, and deploy only each changed function (replace `<changed-function>`):

   ```sh
   supabase db push --linked && supabase migration list --linked
   node scripts/env/sync-supabase-secrets.mjs production --apply
   node scripts/env/run-with-env.mjs production -- sh -c 'supabase functions deploy <changed-function> --project-ref "$SUPABASE_PROJECT_REF"'
   ```

5. Deploy the exact worker `main` SHA to `recipe-dost-media-worker-prod`; confirm branch `main`, env group `recipe-dost-worker-prod`, one instance, and repeat step 2.6 with `production`.
6. In Play Console, note the highest version code; require `app.config.js` `android.versionCode` to be higher, then generate the AAB:

   ```sh
   npm run build:prod
   ```

7. Manually create a Play **Closed testing** release, upload the AAB, add notes, review, roll out, and install from the tester link. EAS submit currently targets `internal`, not closed testing.
8. Complete the final smoke checklist before widening the audience.

## 4. Supabase Deployment Rules

1. The app repo is canonical for migrations/functions. Verify guarded link and `supabase migration list --linked`; dry-run every production `db push`.
2. Never edit an applied migration; add a reviewed forward migration. Deploy only changed/required functions. Never print service-role keys, secrets, or env files.

## 5. Render Worker Rules

1. `develop` deploys to development; `main` to production. Deploy the recorded commit to one sequential queue-worker instance.
2. Load `worker.defaults.json` then `worker.development.json` or `worker.production.json`. Build: `pip install -r requirements.txt`.
3. `render.yaml` uses `uvicorn app.main:app --host 0.0.0.0 --port $PORT --timeout-keep-alive 120`; Docker/current docs also use `python -m app.workers.combined_worker`. **Confirm the actual Render dashboard start command before deployment.**
4. After every deploy, `/health` must show queue mode, 180-second limit, liveness `5/600/2/60`, matching config, and raw URL logging off.
5. Secret/switch names only: `WORKER_API_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `INSTAGRAM_RAPIDAPI_KEY`, `TIKTOK_AKNG_ACCESS_TOKEN`, optional `SENTRY_DSN`, `SENTRY_DEV_CANARY`, `SENTRY_DEV_TEST`.

## 6. Final Smoke Checklist

1. Fresh-install onboarding; Magic Link restores the same UUID/data; RevenueCat entitlement refreshes.
2. Jobs appear and drain FIFO; 121–180-second sources work; over-180-second sources reject; recipe duration is correct.
3. No diagnostics, raw URLs, or secrets are public; closed-testing build installs and launches.

## 7. Rollback

1. App: revert and build a higher `versionCode`. Worker: redeploy the previous Render SHA.
2. Supabase: reviewed forward migration only; never edit history. Play: halt release; never reuse a `versionCode`.
