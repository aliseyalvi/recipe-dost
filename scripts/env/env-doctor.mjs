#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename } from "node:path";
import { getCurrentGitBranch } from "./current-branch.mjs";

function usage() {
  console.error("Usage: node scripts/env/env-doctor.mjs <development|production>");
}

function parseArgs(argv) {
  const environment = argv[2];
  if (!["development", "production"].includes(environment)) {
    usage();
    process.exit(1);
  }
  return { environment };
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
  if (!value) {
    return "";
  }

  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    return value.slice(1, -1);
  }

  const commentIndex = value.search(/\s#/);
  return commentIndex === -1 ? value : value.slice(0, commentIndex).trim();
}

function runValidation(environment) {
  const result = spawnSync(
    process.execPath,
    ["scripts/env/validate-env.mjs", environment],
    {
      encoding: "utf8",
    },
  );

  if (result.status === 0) {
    return;
  }

  console.error(`Env validation failed for ${environment}.`);
  const validationErrors = result.stderr.trim();
  if (validationErrors) {
    console.error(validationErrors);
  }
  process.exit(result.status ?? 1);
}

function supabaseTarget(env) {
  const projectRef = env.get("SUPABASE_PROJECT_REF")?.trim();
  if (projectRef) {
    return `project-ref:${projectRef}`;
  }

  const url = env.get("EXPO_PUBLIC_SUPABASE_URL")?.trim();
  if (!url) {
    return "<missing>";
  }

  try {
    return `url-host:${new URL(url).host}`;
  } catch {
    return "url-host:invalid";
  }
}

function revenueCatKeyType(env) {
  const key = env.get("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY")?.trim() ?? "";
  const lowerKey = key.toLowerCase();

  if (!key) {
    return "<missing>";
  }
  if (lowerKey.startsWith("test_")) {
    return "test-store";
  }
  if (lowerKey.startsWith("goog_") || lowerKey.startsWith("google_")) {
    return "android-public";
  }
  return "unknown";
}

function resolveExpoAndroidPackage(environment, env) {
  const childEnv = { ...process.env };
  for (const [key, value] of env.entries()) {
    childEnv[key] = value;
  }

  const result = spawnSync("npx", ["expo", "config", "--json"], {
    env: childEnv,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    return "<unresolved>";
  }

  try {
    const config = JSON.parse(result.stdout);
    return config?.android?.package ?? config?.expo?.android?.package ?? "<missing>";
  } catch {
    return "<unresolved>";
  }
}

function printSummary(environment, envPath, env) {
  console.log(`Env doctor: ${environment} (${basename(envPath)})`);
  console.log(`- APP_ENV: ${env.get("APP_ENV") || "<missing>"}`);
  console.log(`- APP_VARIANT: ${env.get("APP_VARIANT") || "<missing>"}`);
  console.log(`- Supabase: ${supabaseTarget(env)}`);
  console.log(`- RevenueCat Android key type: ${revenueCatKeyType(env)}`);
  console.log(
    `- PostHog project token configured: ${Boolean(env.get("EXPO_PUBLIC_POSTHOG_API_KEY")?.trim())}`,
  );
  console.log(
    `- PostHog host configured: ${Boolean(env.get("EXPO_PUBLIC_POSTHOG_HOST")?.trim())}`,
  );
  console.log(
    `- PostHog controlled dev test: ${env.get("EXPO_PUBLIC_POSTHOG_DEV_TEST") === "true"}`,
  );
  console.log(
    `- EAS Android package: ${resolveExpoAndroidPackage(environment, env)}`,
  );
  console.log(`- Git branch: ${getCurrentGitBranch()}`);
  console.log("Env doctor passed. No secret values printed.");
}

const { environment } = parseArgs(process.argv);
const envPath = `env/${environment}.env`;

if (!existsSync(envPath)) {
  console.error(`Missing ${envPath}. Create it from env/${environment}.example.env.`);
  process.exit(1);
}

runValidation(environment);
printSummary(environment, envPath, parseEnv(readFileSync(envPath, "utf8")));
