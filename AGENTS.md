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