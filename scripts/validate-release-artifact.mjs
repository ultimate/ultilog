#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const versionPattern = /^\d{6}\.(?:0|[1-9]\d*)$/;
const categories = new Set(["feature", "improvement", "fix", "security"]);
const utcTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function isReleaseVersion(value) {
  if (typeof value !== "string" || !versionPattern.test(value)) return false;
  const year = 2000 + Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validateReleaseArtifact(releases, expectedVersion, expectedTag) {
  if (!Array.isArray(releases)) throw new Error("Release artifact must contain an array");
  if (!isReleaseVersion(expectedVersion) || expectedTag !== `v${expectedVersion}`) {
    throw new Error(`Allocated tag ${expectedTag} must be the immutable v<yyMMdd.suffix> form of version ${expectedVersion}`);
  }
  if (!releases[0] || releases[0].version !== expectedVersion) {
    throw new Error(`Current artifact version must be ${expectedVersion}, found ${releases[0]?.version ?? "no release"}`);
  }

  const seenPullRequests = new Map();
  for (const release of releases) {
    if (!release || !isReleaseVersion(release.version) || !utcTimestampPattern.test(release.releasedAt) || Number.isNaN(Date.parse(release.releasedAt)) || !Array.isArray(release.entries)) {
      throw new Error("Release artifact contains malformed release data");
    }
    for (const entry of release.entries) {
      if (!Number.isSafeInteger(entry?.prNumber) || entry.prNumber <= 0) throw new Error(`Release ${release.version} contains an invalid PR number`);
      if (!categories.has(entry.category) || typeof entry.title?.en !== "string" || !entry.title.en.trim()) {
        throw new Error(`Release ${release.version} contains malformed PR #${entry.prNumber}`);
      }
      const expectedUrlSuffix = `/pull/${entry.prNumber}`;
      let url;
      try { url = new URL(entry.prUrl); } catch { throw new Error(`PR #${entry.prNumber} has an invalid URL`); }
      if (url.protocol !== "https:" || !url.pathname.endsWith(expectedUrlSuffix)) throw new Error(`PR #${entry.prNumber} has an invalid URL`);
      const previous = seenPullRequests.get(entry.prNumber);
      if (previous) throw new Error(`Duplicate PR #${entry.prNumber} appears in releases ${previous} and ${release.version}`);
      seenPullRequests.set(entry.prNumber, release.version);
    }
  }
  return releases;
}

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`${name} is required`);
  return process.argv[index + 1];
}

function main() {
  const file = argument("--file");
  validateReleaseArtifact(JSON.parse(readFileSync(file, "utf8")), argument("--version"), argument("--tag"));
  process.stdout.write(`Validated ${file}.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
