#!/usr/bin/env node

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const REQUIRED_SUPABASE_SECRET_KEYS = [
  "REVENUECAT_API_KEY",
  "REVENUECAT_ENTITLEMENT_ID",
  "REVENUECAT_BINDING_HMAC_SECRET",
  "RECIPE_DOST_ENV",
  "MEDIA_WORKER_URL",
  "MEDIA_WORKER_SHARED_SECRET",
];

const OPTIONAL_SUPABASE_SECRET_KEYS = [
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "AI_PROVIDER",
  "GEMINI_MODEL",
  "GEMINI_VIDEO_MODEL",
  "OPENAI_MODEL",
  "MAX_INPUT_CHARS",
  "FREE_AI_GENERATION_LIMIT",
  "MEDIA_PROCESSOR_MODE",
  "WORKER_WAKE_TIMEOUT_MS",
  "METADATA_PREVIEW_TIMEOUT_MS",
];

function usage() {
  console.error(
    "Usage: node scripts/env/sync-supabase-secrets.mjs <development|production> <--dry-run|--apply>",
  );
}

function parseArgs(argv) {
  const environment = argv[2];
  const dryRun = argv.includes("--dry-run");
  const apply = argv.includes("--apply");
  if (!["development", "production"].includes(environment) || dryRun === apply) {
    usage();
    process.exit(1);
  }
  return { environment, dryRun, apply };
}

function parseEnv(contents) {
  const env = new Map();
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }
    env.set(match[1], stripInlineComment(match[2].trim()));
  }
  return env;
}

function stripInlineComment(value) {
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    return value.slice(1, -1);
  }
  const commentIndex = value.search(/\s#/);
  return commentIndex === -1 ? value : value.slice(0, commentIndex).trim();
}

function mask(value) {
  if (!value) {
    return "<missing>";
  }
  if (value.length <= 4) {
    return "****";
  }
  return `${value.slice(0, 2)}***${value.slice(-2)} (${value.length} chars)`;
}

function requireValues(env) {
  if (env.has("SUPABASE_ENV_NAME")) {
    console.error(
      "SUPABASE_ENV_NAME is reserved/deprecated; use RECIPE_DOST_ENV instead.",
    );
    process.exit(1);
  }
  const requiredKeys = ["SUPABASE_PROJECT_REF", ...REQUIRED_SUPABASE_SECRET_KEYS];
  const missing = requiredKeys.filter(
    (key) => !env.has(key) || !String(env.get(key)).trim(),
  );
  if (missing.length) {
    console.error("Missing Supabase sync keys:");
    for (const key of missing) {
      console.error(`- ${key}`);
    }
    process.exit(1);
  }
}

function syncKeys(env) {
  return [
    ...REQUIRED_SUPABASE_SECRET_KEYS,
    ...OPTIONAL_SUPABASE_SECRET_KEYS.filter(
      (key) => env.has(key) && String(env.get(key)).trim() && !isPlaceholder(env.get(key)),
    ),
  ];
}

function isPlaceholder(value) {
  return /^YOUR(_|-)/i.test(value) || value.includes("example.com");
}

function writeTempEnv(env) {
  const dir = mkdtempSync(join(tmpdir(), "recipe-dost-supabase-env-"));
  const path = join(dir, "supabase-secrets.env");
  const contents = syncKeys(env).map(
    (key) => formatEnvLine(key, env.get(key)),
  ).join("\n");
  writeFileSync(path, `${contents}\n`, { encoding: "utf8", mode: 0o600 });
  return { dir, path };
}

function formatEnvLine(key, value) {
  return `${key}=${JSON.stringify(value)}`;
}

const { environment, dryRun } = parseArgs(process.argv);
const sourcePath = `env/${environment}.env`;
if (!existsSync(sourcePath)) {
  console.error(`Missing ${sourcePath}. Create it from env/${environment}.example.env.`);
  process.exit(1);
}

const env = parseEnv(readFileSync(sourcePath, "utf8"));
requireValues(env);

console.log(`Supabase secrets ${dryRun ? "dry-run" : "apply"} for ${environment}`);
console.log("Target project ref: SUPABASE_PROJECT_REF");
for (const key of syncKeys(env)) {
  console.log(`- ${key}`);
}

if (dryRun) {
  console.log("\nNo Supabase changes made.");
  process.exit(0);
}

const temp = writeTempEnv(env);
try {
  console.log(
    "\nRunning: supabase secrets set --env-file <temp allowlisted env file> --project-ref <masked project ref>",
  );
  const result = spawnSync(
    "supabase",
    [
      "secrets",
      "set",
      "--env-file",
      temp.path,
      "--project-ref",
      env.get("SUPABASE_PROJECT_REF"),
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
} finally {
  rmSync(temp.dir, { recursive: true, force: true });
}
