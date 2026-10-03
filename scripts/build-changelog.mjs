#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const categories = new Set(["feature", "improvement", "fix", "security"]);
const locales = new Set(["en", "de", "fr", "it"]);
const entryFields = new Set(["id", "category", "title"]);
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function validateSource(value, context) {
  if (!Array.isArray(value))
    throw new Error(`${context}: changelog must be a JSON array`);
  const ids = new Set();
  let previousId;

  for (const [index, entry] of value.entries()) {
    const label = `${context}: entry ${index + 1}`;
    if (!isRecord(entry)) throw new Error(`${label} must be an object`);
    const unexpected = Object.keys(entry).find(
      (field) => !entryFields.has(field),
    );
    if (unexpected)
      throw new Error(
        `${label} has unexpected field ${JSON.stringify(unexpected)}`,
      );
    if (typeof entry.id !== "string" || !idPattern.test(entry.id))
      throw new Error(`${label} has a malformed ID`);
    if (ids.has(entry.id))
      throw new Error(
        `${context}: duplicate changelog ID ${JSON.stringify(entry.id)}`,
      );
    if (previousId !== undefined && previousId >= entry.id)
      throw new Error(`${context}: entries must be ordered by ID`);
    if (!categories.has(entry.category))
      throw new Error(`${label} has an unsupported category`);
    if (!isRecord(entry.title))
      throw new Error(`${label}.title must be an object`);
    const unsupportedLocale = Object.keys(entry.title).find(
      (locale) => !locales.has(locale),
    );
    if (unsupportedLocale)
      throw new Error(
        `${label}.title has unsupported locale ${JSON.stringify(unsupportedLocale)}`,
      );
    for (const locale of locales) {
      const title = entry.title[locale];
      if (locale === "en" && title === undefined)
        throw new Error(`${label}.title.en is required`);
      if (
        title !== undefined &&
        (typeof title !== "string" || title.trim() === "")
      ) {
        throw new Error(`${label}.title.${locale} must be a non-empty string`);
      }
    }
    ids.add(entry.id);
    previousId = entry.id;
  }
  return value;
}

function parseJson(contents, context, { validate = true } = {}) {
  let value;
  try {
    value = JSON.parse(contents);
  } catch (error) {
    throw new Error(`${context}: malformed JSON (${error.message})`);
  }
  return validate ? validateSource(value, context) : value;
}

function git(repositoryPath, args) {
  try {
    return execFileSync("git", ["-C", repositoryPath, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const diagnostic = error.stderr?.trim() || error.message;
    throw new Error(
      `Git command failed (git ${args.join(" ")}): ${diagnostic}`,
    );
  }
}

function repositoryRelativePath(repositoryPath, sourcePath) {
  const path = relative(repositoryPath, sourcePath);
  if (
    path === "" ||
    path === ".." ||
    path.startsWith(`..${sep}`) ||
    resolve(repositoryPath, path) !== sourcePath
  ) {
    throw new Error("The changelog source must be inside the Git repository");
  }
  return path.split(sep).join("/");
}

function idsAtRevision(repositoryPath, commitSha, sourcePath) {
  let contents;
  try {
    contents = execFileSync(
      "git",
      ["-C", repositoryPath, "show", `${commitSha}:${sourcePath}`],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
  } catch {
    return new Set();
  }

  const value = parseJson(contents, `changelog at commit ${commitSha}`, {
    validate: false,
  });
  if (!Array.isArray(value))
    throw new Error(
      `changelog at commit ${commitSha}: changelog must be a JSON array`,
    );
  const ids = new Set();
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.id !== "string") {
      throw new Error(
        `changelog at commit ${commitSha}: malformed changelog entry`,
      );
    }
    if (ids.has(entry.id))
      throw new Error(
        `changelog at commit ${commitSha}: duplicate changelog ID ${JSON.stringify(entry.id)}`,
      );
    ids.add(entry.id);
  }
  return ids;
}

export function deriveChangelogArtifact({
  repositoryPath = process.cwd(),
  sourcePath,
  outputPath,
} = {}) {
  const repository = resolve(repositoryPath);
  const source = resolve(
    repository,
    sourcePath ?? "app/content/changelog.json",
  );
  const output = resolve(
    repository,
    outputPath ?? "public/generated/changelog.json",
  );
  const relativeSource = repositoryRelativePath(repository, source);

  const entries = parseJson(readFileSync(source, "utf8"), relativeSource);
  if (
    entries.length > 0 &&
    git(repository, ["rev-parse", "--is-shallow-repository"]).trim() === "true"
  ) {
    throw new Error(
      "Cannot derive changelog introductions from shallow Git history; fetch the complete history first",
    );
  }
  const wantedIds = new Set(entries.map(({ id }) => id));
  const introductions = new Map();
  const commits = git(repository, [
    "log",
    "--reverse",
    "--format=%H%x09%cI",
    "--",
    relativeSource,
  ])
    .trim()
    .split("\n")
    .filter(Boolean);

  for (const line of commits) {
    const [commitSha, committedAt] = line.split("\t");
    for (const id of idsAtRevision(repository, commitSha, relativeSource)) {
      if (wantedIds.has(id) && !introductions.has(id)) {
        introductions.set(id, {
          commitSha,
          shortSha: commitSha.slice(0, 7),
          introducedAt: new Date(committedAt).toISOString(),
        });
      }
    }
  }

  const missing = entries
    .map(({ id }) => id)
    .filter((id) => !introductions.has(id));
  if (missing.length > 0) {
    throw new Error(
      `No introduction commit found for changelog ID(s): ${missing.join(", ")}. Commit the entries and ensure complete Git history is available.`,
    );
  }

  const artifact = entries.map((entry) => ({
    ...entry,
    introduction: introductions.get(entry.id),
  }));
  const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, serialized, "utf8");
  return { artifact, serialized };
}

function main() {
  const [sourcePath, outputPath] = process.argv.slice(2);
  try {
    deriveChangelogArtifact({ sourcePath, outputPath });
  } catch (error) {
    process.stderr.write(`Unable to build changelog: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main();
