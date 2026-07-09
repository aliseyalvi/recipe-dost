#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const DEV_SUPABASE_REF = "xvsiuwjidmkdqzkswoki";

const ALLOWED_COMBINATIONS = new Set([
  "development:development",
  "development:preview",
  "production:production",
]);

function usage() {
  console.error(
    "Usage: node scripts/env/build-app.mjs <development|production> <development|preview|production>",
  );
}

function parseArgs(argv) {
  const environment = argv[2];
  const profile = argv[3];
  const key = `${environment}:${profile}`;
  if (!ALLOWED_COMBINATIONS.has(key)) {
    usage();
    process.exit(1);
  }
  return { environment, profile };
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runNodeScript(script, args) {
  run(process.execPath, [script, ...args]);
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

function assertProductionEnvSafe(envPath) {
  if (!existsSync(envPath)) {
    console.error(`Missing ${envPath}. Production builds require an explicit production env file.`);
    process.exit(1);
  }

  const contents = readFileSync(envPath, "utf8");
  const env = parseEnv(contents);
  if (contents.includes(DEV_SUPABASE_REF)) {
    console.error(
      "Production env contains the known development Supabase project ref. Refusing to build.",
    );
    process.exit(1);
  }

  const revenueCatAndroidKey =
    env.get("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY") ?? "";
  if (revenueCatAndroidKey.trim().toLowerCase().startsWith("test_")) {
    console.error(
      "Production env appears to use a RevenueCat Test Store Android key. Refusing to build.",
    );
    process.exit(1);
  }
}

const { environment, profile } = parseArgs(process.argv);
const envPath = `env/${environment}.env`;

runNodeScript("scripts/env/assert-release-branch.mjs", [profile]);

if (environment === "production") {
  assertProductionEnvSafe(envPath);
}

runNodeScript("scripts/env/env-doctor.mjs", [environment]);
run("npm", ["run", "qa:static"]);
runNodeScript("scripts/env/deploy-app-env.mjs", [environment, "--apply"]);
runNodeScript("scripts/env/run-with-env.mjs", [
  environment,
  "--",
  "eas",
  "build",
  "--platform",
  "android",
  "--profile",
  profile,
]);
