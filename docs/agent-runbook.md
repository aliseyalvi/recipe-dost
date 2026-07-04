# Recipe Dost Agent Runbook

## Current Decision

- Recipe Dost is using lightweight agent QA docs and guardrails now.
- Heavy closed-loop QA automation is deferred.
- The next product milestone after M21.10A is M22 RevenueCat paywall + entitlement sync.

Deferred for now:
- Expo MCP setup
- React runtime introspection
- Browser/device visual QA automation
- Automated self-healing loops
- Maestro, serve-sim, and agent-device setup

## Project Architecture

- Expo React Native app with Expo Router.
- Supabase Auth, Postgres, Storage, and Edge Functions.
- Python media worker running in a Render-like environment.
- Android-first development build.
- RevenueCat integration comes later.
- Worker media processing has a strict 120-second guardrail.

## Layer Classification

Before patching, classify the task as one layer:

- App UI/navigation
- App data/query/cache
- Supabase Edge Function
- Database/migration
- Worker/media pipeline
- EAS/native config
- Docs only

## Scope Rules

- Inspect targeted files only.
- Avoid broad refactors.
- Do not touch worker code for app UI bugs.
- Do not touch Supabase for visual-only bugs.
- Do not add dependencies unless the current implementation is proven unstable and the user approves.
- Do not change native config unless required.
- Do not log full source URLs, CDN URLs, secrets, cookies, temp paths, or raw worker payloads.

## Circuit Breaker

- Maximum 2 self-healing correction attempts.
- Attempt 0: make the smallest patch and validate.
- Attempt 1: fix the exact validation or runtime issue.
- Attempt 2: make one final local correction only if obvious.
- Then stop, log the blocker, and ask a human.
- No infinite terminal loops.
- No repeated git status or typecheck loops.
- No massive log reprocessing.

## Validation Order

- App code touched: `npm run typecheck`
- Config touched: `npx expo config --json`
- Supabase function touched: deploy only the changed function.
- Worker touched: run worker validation once and redeploy Render.
- Native config or dependency touched: EAS dev build required.
- Docs only: `git diff -- docs AGENTS.md` is enough.

## Logging Rules

- Update `docs/decision-log.md` after each milestone or patch.
- Update `docs/milestones.md` when status changes.
- Keep entries short.
- Include validation result.
- Include human QA needed.
- Do not paste huge logs.

## Token Optimization

- Prefer targeted `rg` and `find` searches.
- Open only relevant file ranges.
- Keep diffs small.
- Reuse existing components, hooks, and helpers.
- Prefer native or Expo platform controls over custom abstractions.
- Ask a human before a large refactor.

## Recipe Dost Invariants

- Save/share link must not create `media_job`.
- AI generation only happens through Generate AI Recipe.
- Free users get 3 AI recipe generations, with active jobs reserving slots.
- Failed jobs do not permanently consume credits.
- Save links remain free.
- Duplicate source videos are blocked.
- Raw videos are not stored permanently.
- Worker has a 120-second media guardrail.
- Direct video/CDN URLs must not be exposed to the app.
- Metadata failure must not block saved link usage.
- Platform thumbnails should not be downgraded by AI job thumbnails.
