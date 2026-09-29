#!/usr/bin/env node

import { appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** Format a Date as the six-digit UTC date used by release versions. */
export function utcReleaseDate(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) {
    throw new TypeError("A valid release date is required");
  }

  return date.toISOString().slice(2, 10).replaceAll("-", "");
}

/**
 * Calculate today's next release identifiers from a list of complete Git tag
 * names. Only exact production release tags participate in the calculation.
 */
export function calculateReleaseVersion(tags, date = new Date()) {
  if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string")) {
    throw new TypeError("Git tags must be provided as an array of strings");
  }

  const releaseDate = utcReleaseDate(date);
  const tagPattern = new RegExp(`^v${releaseDate}\\.(\\d+)$`);
  let highestSuffix = -1;

  for (const tag of tags) {
    const match = tag.match(tagPattern);
    if (match === null) continue;

    const suffix = Number(match[1]);
    if (Number.isSafeInteger(suffix) && suffix >= 0) highestSuffix = Math.max(highestSuffix, suffix);
  }

  const version = `${releaseDate}.${highestSuffix + 1}`;
  return { version, tag: `v${version}` };
}

export function githubActionsOutput({ version, tag }) {
  return `version=${version}\ntag=${tag}\n`;
}

function main() {
  const tags = execFileSync("git", ["tag", "--list"], { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
  const output = githubActionsOutput(calculateReleaseVersion(tags));

  process.stdout.write(output);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output, "utf8");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
