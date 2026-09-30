#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { CATEGORY_DEFINITIONS } from "./generate-release-notes.mjs";

const recognizedLabels = new Set(CATEGORY_DEFINITIONS.map(({ label }) => label));

export function validatePullRequestLabels(number, labels) {
  const recognized = [...new Set(labels.map((label) => typeof label === "string" ? label : label.name).filter((label) => recognizedLabels.has(label)))].sort();
  if (recognized.length > 1) {
    throw new Error(`PR #${number} has multiple recognized changelog labels: ${recognized.join(", ")}. Keep at most one changelog:* label.`);
  }
  return recognized[0];
}

function main() {
  if (!process.env.GITHUB_EVENT_PATH) throw new Error("GITHUB_EVENT_PATH is required");
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  if (!event.pull_request) throw new Error("The event does not contain a pull request");
  const label = validatePullRequestLabels(event.pull_request.number, event.pull_request.labels ?? []);
  process.stdout.write(label ? `PR #${event.pull_request.number} will be published as ${label}.\n` : `PR #${event.pull_request.number} is intentionally omitted from the changelog.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
