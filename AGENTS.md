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

## CodeGraph

CodeGraph MCP is installed for this project and should be used before broad file reads.

Rules:
- For codebase questions, first check whether CodeGraph MCP tools are available.
- If available, use `codegraph_explore` before reading source files directly.
- Use CodeGraph to identify relevant files, modules, functions, and relationships.
- Do not scan the whole repository with raw grep/find/read commands unless CodeGraph is unavailable or insufficient.
- If CodeGraph returns enough context, answer from CodeGraph plus minimal direct file reads.
- If CodeGraph is unavailable, say so clearly and then use Graphify before falling back to direct file inspection.
- For implementation tasks, use CodeGraph first to identify the smallest relevant file set, then edit only those files.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships. Use Graphify for architecture, navigation, relationships, docs-aware context, and broad project understanding. Prefer CodeGraph first for source-code discovery, then Graphify if deeper context is needed.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` when available to keep the graph current. Prefer update/incremental commands over full `graphify .` to avoid unnecessary semantic extraction/API usage.
