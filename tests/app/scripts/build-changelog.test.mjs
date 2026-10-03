import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deriveChangelogArtifact } from "../../../scripts/build-changelog.mjs";

const title = (en) => ({ en });
const entry = (id, en = id) => ({ id, category: "feature", title: title(en) });

function repository() {
  const path = mkdtempSync(join(tmpdir(), "ultilog-changelog-"));
  execFileSync("git", ["init", "--quiet", "--initial-branch=main", path]);
  execFileSync("git", ["-C", path, "config", "user.name", "Test Author"]);
  execFileSync("git", ["-C", path, "config", "user.email", "test@example.com"]);
  mkdirSync(join(path, "app/content"), { recursive: true });
  return path;
}

let timestamp = 0;
function commit(repo, entries, message = "update changelog", commitDate) {
  writeFileSync(
    join(repo, "app/content/changelog.json"),
    `${JSON.stringify(entries, null, 2)}\n`,
  );
  execFileSync("git", ["-C", repo, "add", "app/content/changelog.json"]);
  const date =
    commitDate ?? new Date(Date.UTC(2026, 0, 1, 10, timestamp++)).toISOString();
  execFileSync("git", ["-C", repo, "commit", "--quiet", "-m", message], {
    env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
  });
  return execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
}

function derive(repo) {
  return deriveChangelogArtifact({
    repositoryPath: repo,
    outputPath: "artifact/changelog.json",
  });
}

describe("changelog build artifact", () => {
  it("finds entries introduced together and in separate commits", () => {
    const repo = repository();
    const first = commit(
      repo,
      [entry("alpha"), entry("alpha-two")],
      "introduce entries",
      "2026-01-01T12:00:00+02:00",
    );
    const second = commit(repo, [
      entry("alpha"),
      entry("alpha-two"),
      entry("beta"),
    ]);
    const { artifact } = derive(repo);

    expect(artifact.map(({ introduction }) => introduction.commitSha)).toEqual([
      first,
      first,
      second,
    ]);
    expect(artifact[0].introduction).toMatchObject({
      shortSha: first.slice(0, 7),
      introducedAt: "2026-01-01T10:00:00.000Z",
    });
  });

  it("ignores translations, title edits, and historical JSON reordering", () => {
    const repo = repository();
    const first = commit(repo, [entry("alpha"), entry("beta")]);
    commit(repo, [
      entry("beta", "Beta renamed"),
      { ...entry("alpha"), title: { en: "Alpha", de: "Alfa" } },
    ]);
    commit(repo, [
      { ...entry("alpha"), title: { en: "Alpha renamed", fr: "Alpha" } },
      entry("beta", "Beta renamed"),
    ]);

    expect(
      derive(repo).artifact.map(({ introduction }) => introduction.commitSha),
    ).toEqual([first, first]);
  });

  it("distinguishes similar IDs and accepts special characters in titles", () => {
    const repo = repository();
    const first = commit(repo, [entry("route", "Route: wind & waves — 🌊")]);
    const second = commit(repo, [
      entry("route", "Route: wind & waves — 🌊"),
      entry("route-map", "L'été / Zürich"),
    ]);

    const artifact = derive(repo).artifact;
    expect(artifact[0].introduction.commitSha).toBe(first);
    expect(artifact[1].introduction.commitSha).toBe(second);
    expect(artifact[1].title.en).toBe("L'été / Zürich");
  });

  it("fails clearly for malformed, duplicate, and uncommitted entries", () => {
    const repo = repository();
    commit(repo, [entry("alpha")]);
    writeFileSync(
      join(repo, "app/content/changelog.json"),
      JSON.stringify([entry("alpha"), entry("alpha")]),
    );
    expect(() => derive(repo)).toThrow(/duplicate changelog ID "alpha"/i);

    writeFileSync(
      join(repo, "app/content/changelog.json"),
      JSON.stringify([entry("alpha"), entry("beta")]),
    );
    expect(() => derive(repo)).toThrow(/No introduction commit found.*beta/i);

    writeFileSync(join(repo, "app/content/changelog.json"), "not JSON");
    expect(() => derive(repo)).toThrow(/malformed JSON/i);
  });

  it("rejects shallow history", () => {
    const source = repository();
    commit(source, [entry("alpha")]);
    commit(source, [entry("alpha"), entry("beta")]);
    const shallow = mkdtempSync(join(tmpdir(), "ultilog-changelog-shallow-"));
    execFileSync("git", [
      "clone",
      "--quiet",
      "--depth",
      "1",
      `file://${source}`,
      shallow,
    ]);
    expect(() => derive(shallow)).toThrow(
      /shallow-history boundary.*fetch-depth: 0.*git fetch --unshallow/i,
    );
  });

  it("accepts shallow history when every introduction follows the shallow boundary", () => {
    const source = repository();
    commit(source, []);
    commit(source, [entry("alpha")]);
    const shallow = mkdtempSync(
      join(tmpdir(), "ultilog-changelog-sufficient-shallow-"),
    );
    execFileSync("git", [
      "clone",
      "--quiet",
      "--depth",
      "2",
      `file://${source}`,
      shallow,
    ]);
    expect(derive(shallow).artifact[0].id).toBe("alpha");
  });

  it("writes byte-for-byte deterministic output", () => {
    const repo = repository();
    commit(repo, [entry("alpha", "Alpha")]);
    const first = derive(repo).serialized;
    const second = derive(repo).serialized;
    expect(second).toBe(first);
    expect(readFileSync(join(repo, "artifact/changelog.json"), "utf8")).toBe(
      first,
    );
    expect(first.endsWith("\n")).toBe(true);
  });
});
