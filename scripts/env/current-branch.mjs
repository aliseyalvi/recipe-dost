#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export function getCurrentGitBranch(cwd = process.cwd()) {
  const branchResult = spawnSync(
    "git",
    ["symbolic-ref", "--quiet", "--short", "HEAD"],
    {
      cwd,
      encoding: "utf8",
    },
  );

  const branch = branchResult.stdout.trim();
  if (branchResult.status === 0 && branch) {
    return branch;
  }

  const commitResult = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd,
    encoding: "utf8",
  });
  const commit = commitResult.stdout.trim();
  if (commitResult.status === 0 && commit) {
    return `detached:${commit}`;
  }

  return "unknown";
}

const isCli = process.argv[1] === fileURLToPath(import.meta.url);

if (isCli) {
  console.log(getCurrentGitBranch());
}
