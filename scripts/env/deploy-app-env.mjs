#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const DEV_SUPABASE_REF = "xvsiuwjidmkdqzkswoki";

function usage() {
  console.error(
    "Usage: node scripts/env/deploy-app-env.mjs <development|production> <--dry-run|--apply>",
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
  return { environment, mode: dryRun ? "--dry-run" : "--apply" };
}

function runNodeScript(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function assertProductionEnvSafe(envPath) {
  if (!existsSync(envPath)) {
    console.error(`Missing ${envPath}. Production env must be created explicitly.`);
    process.exit(1);
  }

  const contents = readFileSync(envPath, "utf8");
  if (contents.includes(DEV_SUPABASE_REF)) {
    console.error(
      "Production env contains the known development Supabase project ref. Refusing to continue.",
    );
    process.exit(1);
  }

  console.log(
    "Production env selected. Confirm env/production.env contains production-only Supabase, worker, and RevenueCat values before applying.",
  );
}

const { environment, mode } = parseArgs(process.argv);
const envPath = `env/${environment}.env`;

if (environment === "production") {
  assertProductionEnvSafe(envPath);
}

console.log(`Deploy app env ${mode === "--dry-run" ? "dry-run" : "apply"} for ${environment}.`);
runNodeScript("scripts/env/validate-env.mjs", [environment]);
runNodeScript("scripts/env/sync-eas-env.mjs", [environment, mode]);
runNodeScript("scripts/env/sync-supabase-secrets.mjs", [environment, mode]);
