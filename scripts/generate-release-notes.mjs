#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const CATEGORY_DEFINITIONS = Object.freeze([
  { category: "feature", label: "changelog:feature", heading: "Features" },
  { category: "improvement", label: "changelog:improvement", heading: "Improvements" },
  { category: "fix", label: "changelog:fix", heading: "Fixes" },
  { category: "security", label: "changelog:security", heading: "Security" },
]);

const categoryByLabel = new Map(CATEGORY_DEFINITIONS.map((item) => [item.label, item.category]));

export function entriesFromPullRequests(pullRequests, repository) {
  const unique = new Map();
  for (const pullRequest of pullRequests) {
    if (unique.has(pullRequest.number)) continue;
    const recognized = [...new Set((pullRequest.labels ?? []).map((label) => typeof label === "string" ? label : label.name).filter((label) => categoryByLabel.has(label)))];
    if (recognized.length > 1) {
      throw new Error(`PR #${pullRequest.number} has multiple changelog labels: ${recognized.sort().join(", ")}. Apply exactly one recognized changelog label.`);
    }
    if (recognized.length === 0) continue;
    unique.set(pullRequest.number, {
      category: categoryByLabel.get(recognized[0]),
      prNumber: pullRequest.number,
      prUrl: `https://github.com/${repository}/pull/${pullRequest.number}`,
      title: { en: pullRequest.title },
    });
  }
  const categoryOrder = new Map(CATEGORY_DEFINITIONS.map((item, index) => [item.category, index]));
  return [...unique.values()].sort((a, b) => categoryOrder.get(a.category) - categoryOrder.get(b.category) || a.prNumber - b.prNumber);
}

export function mergeRelease(existing, release) {
  const withoutReplacedVersion = existing.filter((item) => item.version !== release.version);
  return [...withoutReplacedVersion, release].sort((a, b) => b.version.localeCompare(a.version));
}

export function renderReleaseBody(entries) {
  if (entries.length === 0) return "No user-facing changes in this release.\n";
  const sections = [];
  for (const definition of CATEGORY_DEFINITIONS) {
    const categoryEntries = entries.filter((entry) => entry.category === definition.category);
    if (categoryEntries.length === 0) continue;
    sections.push(`## ${definition.heading}\n\n${categoryEntries.map((entry) => `- ${escapeMarkdown(entry.title.en)} ([#${entry.prNumber}](${entry.prUrl}))`).join("\n")}`);
  }
  return `${sections.join("\n\n")}\n`;
}

function escapeMarkdown(value) {
  return value.replace(/([\\`*_[\]<>])/g, "\\$1").replace(/\r?\n/g, " ");
}

function command(name, args) {
  return execFileSync(name, args, { encoding: "utf8" }).trim();
}

export function previousProductionTag(target) {
  try {
    return command("git", ["describe", "--tags", "--abbrev=0", "--match", "v[0-9][0-9][0-9][0-9][0-9][0-9].[0-9]*", `${target}^`]);
  } catch {
    return null;
  }
}

function findMergedPullRequests(repository, previousTag, target) {
  const range = previousTag ? `${previousTag}..${target}` : target;
  const commits = command("git", ["rev-list", "--reverse", range]).split(/\r?\n/).filter(Boolean);
  const pulls = [];
  for (const sha of commits) {
    const response = command("gh", ["api", `repos/${repository}/commits/${sha}/pulls`, "-H", "Accept: application/vnd.github+json"]);
    for (const pull of JSON.parse(response || "[]")) {
      if (pull.merged_at) pulls.push({ number: pull.number, title: pull.title, labels: pull.labels });
    }
  }
  return pulls;
}

function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const version = process.env.RELEASE_VERSION;
  const target = process.env.RELEASE_TARGET ?? "HEAD";
  const output = process.env.RELEASES_OUTPUT ?? "app/content/releases.json";
  const bodyOutput = process.env.RELEASE_BODY_OUTPUT ?? "release-body.md";
  if (!repository || !version) throw new Error("GITHUB_REPOSITORY and RELEASE_VERSION are required");

  const previousTag = previousProductionTag(target);
  const entries = entriesFromPullRequests(findMergedPullRequests(repository, previousTag, target), repository);
  const releasedAt = new Date(command("git", ["show", "-s", "--format=%cI", target])).toISOString();
  let existing = [];
  try { existing = JSON.parse(readFileSync(output, "utf8")); } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const releases = mergeRelease(existing, { version, releasedAt, entries });
  writeFileSync(output, `${JSON.stringify(releases, null, 2)}\n`);
  writeFileSync(bodyOutput, renderReleaseBody(entries));
  process.stdout.write(`Generated ${entries.length} changelog entries from ${previousTag ?? "repository history"} to ${target}.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
