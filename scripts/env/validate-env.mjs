#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";

const EAS_PUBLIC_KEYS = [
  "APP_ENV",
  "APP_VARIANT",
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY",
  "EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID",
  "EXPO_PUBLIC_REVENUECAT_OFFERING_ID",
];

const POSTHOG_PUBLIC_KEYS = [
  "EXPO_PUBLIC_POSTHOG_API_KEY",
  "EXPO_PUBLIC_POSTHOG_HOST",
];

const EAS_OPTIONAL_PUBLIC_KEYS = [
  ...POSTHOG_PUBLIC_KEYS,
  "EXPO_PUBLIC_POSTHOG_DEV_TEST",
];

const SUPABASE_REQUIRED_KEYS = [
  "REVENUECAT_API_KEY",
  "REVENUECAT_ENTITLEMENT_ID",
  "MEDIA_WORKER_URL",
  "MEDIA_WORKER_SHARED_SECRET",
];

const SUPABASE_OPTIONAL_KEYS = [
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

const LOCAL_REQUIRED_KEYS = ["SUPABASE_PROJECT_REF"];
const LOCAL_OPTIONAL_KEYS = ["SUPABASE_ENV_NAME"];

const FORBIDDEN_PUBLIC_SECRET_PATTERNS = [
  /^EXPO_PUBLIC_.*ANTHROPIC_API_KEY$/,
  /^EXPO_PUBLIC_.*GEMINI_API_KEY$/,
  /^EXPO_PUBLIC_.*KIMI_API_KEY$/,
  /^EXPO_PUBLIC_.*MEDIA_WORKER_SHARED_SECRET$/,
  /^EXPO_PUBLIC_.*MEDIA_WORKER_SECRET$/,
  /^EXPO_PUBLIC_.*OPENAI_API_KEY$/,
  /^EXPO_PUBLIC_.*OPENROUTER_API_KEY$/,
  /^EXPO_PUBLIC_.*REVENUECAT_API_KEY$/,
  /^EXPO_PUBLIC_.*SUPABASE_SECRET_KEY$/,
  /^EXPO_PUBLIC_.*SUPABASE_SERVICE_ROLE_KEY$/,
  /^EXPO_PUBLIC_.*WORKER_API_SECRET$/,
];

const DEPRECATED_PUBLIC_KEYS = [
  "EXPO_PUBLIC_APP_ENV",
  "EXPO_PUBLIC_FREE_GROCERY_LIST_LIMIT",
  "EXPO_PUBLIC_FREE_RECIPE_CARD_LIMIT",
  "EXPO_PUBLIC_FREE_SAVED_LINK_LIMIT",
  "EXPO_PUBLIC_REVENUECAT_ANDROID_KEY",
  "EXPO_PUBLIC_POSTHOG_KEY",
  "EXPO_PUBLIC_SUPABASE_KEY",
];

const PRODUCTION_DEV_VALUE_CHECKS = [
  { label: "development Android package", value: "com.recipedost.dev" },
  { label: "development Supabase project ref", value: "xvsiuwjidmkdqzkswoki" },
  { label: "development marker", value: "DEV_" },
  { label: "development string", value: "development" },
];

function usage() {
  console.error(
    "Usage: node scripts/env/validate-env.mjs <development|production> [--example]",
  );
}

function parseArgs(argv) {
  const environment = argv[2];
  const useExample = argv.includes("--example");
  if (!["development", "production"].includes(environment)) {
    usage();
    process.exit(1);
  }
  return { environment, useExample };
}

function envPathFor(environment, useExample) {
  return `env/${environment}${useExample ? ".example" : ""}.env`;
}

function parseEnv(contents) {
  const env = new Map();
  const errors = [];

  contents.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      errors.push(`Line ${index + 1} is not KEY=value`);
      return;
    }

    const [, key, rawValue] = match;
    env.set(key, stripInlineComment(rawValue.trim()));
  });

  return { env, errors };
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

function mask(value) {
  if (!value) {
    return "<missing>";
  }
  if (value.length <= 4) {
    return "****";
  }
  return `${value.slice(0, 2)}***${value.slice(-2)} (${value.length} chars)`;
}

function printGroup(label, keys, env) {
  console.log(`\n${label}`);
  for (const key of keys) {
    console.log(`- ${key}=${mask(env.get(key) ?? "")}`);
  }
}

function validateRequired(env, keys) {
  return keys.filter((key) => !env.has(key) || !String(env.get(key)).trim());
}

function validateForbiddenPublicSecrets(env) {
  const forbidden = [];
  for (const key of env.keys()) {
    if (FORBIDDEN_PUBLIC_SECRET_PATTERNS.some((pattern) => pattern.test(key))) {
      forbidden.push(key);
    }
  }
  return forbidden;
}

function validateProductionValues(env) {
  const findings = [];
  for (const [key, rawValue] of env.entries()) {
    if (key === "APP_ENV" || key === "APP_VARIANT") {
      continue;
    }

    const value = String(rawValue);
    const lowerValue = value.toLowerCase();
    for (const check of PRODUCTION_DEV_VALUE_CHECKS) {
      const needle =
        check.value === "DEV_" ? check.value : check.value.toLowerCase();
      const haystack = check.value === "DEV_" ? value : lowerValue;
      if (haystack.includes(needle)) {
        findings.push(`${key} contains ${check.label}`);
      }
    }
  }
  return findings;
}

function validateRevenueCatStoreKeys(env, environment, useExample) {
  if (useExample || environment !== "production") {
    return [];
  }

  const androidApiKey = env.get("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY") ?? "";

  return isRevenueCatTestStoreKey(androidApiKey)
    ? ["Production env must not use a RevenueCat Test Store Android API key."]
    : [];
}

function isRevenueCatTestStoreKey(value) {
  return String(value).trim().toLowerCase().startsWith("test_");
}

function validateDeprecatedPublicKeys(env) {
  return DEPRECATED_PUBLIC_KEYS.filter((key) => env.has(key));
}

function validatePostHog(env, environment, useExample) {
  if (useExample) return [];

  const findings = [];
  const key = String(env.get("EXPO_PUBLIC_POSTHOG_API_KEY") ?? "").trim();
  const host = String(env.get("EXPO_PUBLIC_POSTHOG_HOST") ?? "").trim();
  const devTest = String(env.get("EXPO_PUBLIC_POSTHOG_DEV_TEST") ?? "").trim();
  const requiresProject = environment === "production" || devTest === "true";

  if (devTest && devTest !== "true" && devTest !== "false") {
    findings.push("EXPO_PUBLIC_POSTHOG_DEV_TEST must be exactly true or false.");
  }
  if (environment === "production" && devTest === "true") {
    findings.push("Production must not enable EXPO_PUBLIC_POSTHOG_DEV_TEST.");
  }
  if (requiresProject && !isValidPostHogKey(key)) {
    findings.push("A valid EXPO_PUBLIC_POSTHOG_API_KEY project token is required.");
  }
  if (requiresProject && !isValidPostHogHost(host)) {
    findings.push("EXPO_PUBLIC_POSTHOG_HOST must be a valid HTTPS origin without a path.");
  }
  return findings;
}

function isValidPostHogKey(value) {
  return value.startsWith("phc_") && value.length >= 20 && !/^phc_YOUR/i.test(value);
}

function isValidPostHogHost(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password &&
      url.pathname.replace(/\/+$/, "") === ""
    );
  } catch {
    return false;
  }
}

function validatePlaceholderValues(env, keys, useExample) {
  if (useExample) {
    return [];
  }

  return keys.filter((key) => isPlaceholder(env.get(key) ?? ""));
}

function isPlaceholder(value) {
  return /^YOUR(_|-)/i.test(value) || value.includes("example.com");
}

const { environment, useExample } = parseArgs(process.argv);
const path = envPathFor(environment, useExample);

if (!existsSync(path)) {
  console.error(`Missing ${path}.`);
  process.exit(1);
}

const { env, errors } = parseEnv(readFileSync(path, "utf8"));
const requiredKeys = [
  ...EAS_PUBLIC_KEYS,
  ...(environment === "production" ? POSTHOG_PUBLIC_KEYS : []),
  ...SUPABASE_REQUIRED_KEYS,
  ...LOCAL_REQUIRED_KEYS,
];
const missing = validateRequired(env, requiredKeys);
const forbiddenPublicSecrets = validateForbiddenPublicSecrets(env);
const deprecatedPublicKeys = validateDeprecatedPublicKeys(env);
const placeholderKeys = validatePlaceholderValues(env, requiredKeys, useExample);
const productionFindings =
  environment === "production" ? validateProductionValues(env) : [];
const revenueCatFindings = validateRevenueCatStoreKeys(
  env,
  environment,
  useExample,
);
const postHogFindings = validatePostHog(env, environment, useExample);

console.log(
  `Validating ${basename(path)} for ${environment}${useExample ? " template" : ""}`,
);
printGroup("EAS public/app vars", EAS_PUBLIC_KEYS, env);
printGroup("PostHog public analytics vars", EAS_OPTIONAL_PUBLIC_KEYS, env);
printGroup("Required Supabase Edge Function secrets/config", SUPABASE_REQUIRED_KEYS, env);
printGroup("Optional Supabase Edge Function secrets/config", SUPABASE_OPTIONAL_KEYS, env);
printGroup("Local-only helper vars", LOCAL_REQUIRED_KEYS, env);
printGroup("Optional local-only helper vars", LOCAL_OPTIONAL_KEYS, env);

if (
  errors.length ||
  missing.length ||
  forbiddenPublicSecrets.length ||
  deprecatedPublicKeys.length ||
  placeholderKeys.length ||
  productionFindings.length ||
  revenueCatFindings.length ||
  postHogFindings.length
) {
  console.error("\nEnv validation failed.");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  for (const key of missing) {
    console.error(`- Missing required key: ${key}`);
  }
  for (const key of forbiddenPublicSecrets) {
    console.error(`- Forbidden mobile public secret key: ${key}`);
  }
  for (const key of deprecatedPublicKeys) {
    console.error(`- Deprecated public env key: ${key}`);
  }
  for (const key of placeholderKeys) {
    console.error(`- Replace placeholder value for required key: ${key}`);
  }
  for (const finding of productionFindings) {
    console.error(`- Production env contains obvious dev value: ${finding}`);
  }
  for (const finding of revenueCatFindings) {
    console.error(`- ${finding}`);
  }
  for (const finding of postHogFindings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log("\nEnv validation passed. Values were masked.");
