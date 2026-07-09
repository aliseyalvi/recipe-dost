#!/usr/bin/env node

import { getCurrentGitBranch } from "./current-branch.mjs";

function usage() {
  console.error(
    "Usage: node scripts/env/assert-release-branch.mjs <development|preview|production>",
  );
}

function parseArgs(argv) {
  const profile = argv[2];
  if (!["development", "preview", "production"].includes(profile)) {
    usage();
    process.exit(1);
  }
  return { profile };
}

const { profile } = parseArgs(process.argv);
const branch = getCurrentGitBranch();

if (profile === "production") {
  if (branch === "main") {
    console.log("Release branch check passed: production build is on main.");
    process.exit(0);
  }

  if (process.env.ALLOW_NON_MAIN_PROD_BUILD === "1") {
    console.warn(
      `Warning: ALLOW_NON_MAIN_PROD_BUILD=1 set. Continuing production build from ${branch}.`,
    );
    process.exit(0);
  }

  console.error(
    `Production builds must run from main. Current branch: ${branch}.`,
  );
  console.error(
    "For an emergency override, set ALLOW_NON_MAIN_PROD_BUILD=1 explicitly.",
  );
  process.exit(1);
}

if (branch !== "develop") {
  console.warn(
    `Warning: ${profile} builds normally run from develop. Current branch: ${branch}.`,
  );
} else {
  console.log(`${profile} branch check passed: current branch is develop.`);
}
