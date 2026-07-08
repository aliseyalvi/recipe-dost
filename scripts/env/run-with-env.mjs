#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";

function usage() {
  console.error(
    "Usage: node scripts/env/run-with-env.mjs <development|production> -- <command> [args...]",
  );
}

function parseArgs(argv) {
  const environment = argv[2];
  const separatorIndex = argv.indexOf("--");
  if (!["development", "production"].includes(environment) || separatorIndex < 3) {
    usage();
    process.exit(1);
  }

  const command = argv[separatorIndex + 1];
  const args = argv.slice(separatorIndex + 2);
  if (!command) {
    usage();
    process.exit(1);
  }

  return { environment, command, args };
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

const { environment, command, args } = parseArgs(process.argv);
const envPath = `env/${environment}.env`;

if (!existsSync(envPath)) {
  console.error(`Missing ${envPath}. Create it from env/${environment}.example.env.`);
  process.exit(1);
}

const fileEnv = parseEnv(readFileSync(envPath, "utf8"));
const childEnv = { ...process.env };
for (const [key, value] of fileEnv.entries()) {
  childEnv[key] = value;
}

console.error(`Loaded ${fileEnv.size} env keys from ${envPath}.`);
console.error(`Running command with ${environment} env.`);

const child = spawn(command, args, {
  env: childEnv,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`Failed to start command: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Command terminated with signal ${signal}.`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});
