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

function assertProductionEnvSafe(envPath) {
  if (!existsSync(envPath)) {
    console.error(`Missing ${envPath}. Production builds require an explicit production env file.`);
    process.exit(1);
  }

  const contents = readFileSync(envPath, "utf8");
  if (contents.includes(DEV_SUPABASE_REF)) {
    console.error(
      "Production env contains the known development Supabase project ref. Refusing to build.",
    );
    process.exit(1);
  }
}

const { environment, profile } = parseArgs(process.argv);
const envPath = `env/${environment}.env`;

if (environment === "production") {
  assertProductionEnvSafe(envPath);
}

run("npm", ["run", "qa:static"]);
runNodeScript("scripts/env/validate-env.mjs", [environment]);
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
