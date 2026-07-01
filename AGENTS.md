# Recipe Dost Codex Instructions

You are helping build Recipe Dost, an Android-first Expo React Native app.

Rules:
- Use TypeScript strict mode.
- Do not add unnecessary features.
- Do not store secrets in source code.
- Never call OpenAI directly from the mobile app.
- All AI calls must go through Supabase Edge Functions.
- Do not implement video downloading or deleted-video backup.
- Keep MVP link-first: paste/share recipe URL, optional note, AI recipe card, library, grocery list, paywall.
- Every async screen must have loading, error, retry, and empty states.
- Every feature must include PostHog event tracking.
- Run typecheck before finishing a task.
- Update docs/decision-log.md after each milestone.

## Validation commands

This project uses npm as the package manager.

Prefer these commands:
- npm run typecheck
- npm run doctor
- npm run functions:check

Avoid relying on npx inside Codex if PATH is missing.

Do not use local Supabase Docker commands.
This project uses Supabase cloud-first development.
Use:
- supabase db push
- supabase functions deploy <function-name>

Do not suggest:
- supabase start
- supabase db reset
- supabase functions serve
unless explicitly requested.



# Agent Execution Rules & Context Mapping

## Environment Ground Rules
- **OS Platform:** macOS / Darwin (Architecture tracking)
- **Context Constraints:** The codebase contains **NO** active semantic or AST graph explorers. Do not attempt tools/scripts to map dependencies.
