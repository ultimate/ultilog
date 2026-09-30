import { describe, expect, it } from "vitest";
import {
  CATEGORY_DEFINITIONS,
  entriesFromPullRequests,
  mergeRelease,
  renderReleaseBody,
} from "../../../scripts/generate-release-notes.mjs";

const repo = "example/ultilog";
const pr = (number, title, labels) => ({ number, title, labels: labels.map((name) => ({ name })) });

describe("release changelog generation", () => {
  it("ignores PRs without a recognized label", () => {
    expect(entriesFromPullRequests([pr(1, "Internal", []), pr(2, "Docs", ["documentation"])], repo)).toEqual([]);
  });

  it.each(CATEGORY_DEFINITIONS)("supports $label", ({ label, category }) => {
    expect(entriesFromPullRequests([pr(3, "Change", [label])], repo)[0]).toMatchObject({ category, prNumber: 3 });
  });

  it("reports all conflicting recognized labels", () => {
    expect(() => entriesFromPullRequests([pr(7, "Ambiguous", ["changelog:fix", "changelog:security"])], repo))
      .toThrow("PR #7 has multiple changelog labels: changelog:fix, changelog:security");
  });

  it("deduplicates PRs associated with multiple commits", () => {
    expect(entriesFromPullRequests([pr(8, "Once", ["changelog:feature"]), pr(8, "Once", ["changelog:feature"])], repo)).toHaveLength(1);
  });

  it("renders an empty release", () => {
    expect(renderReleaseBody([])).toBe("No user-facing changes in this release.\n");
  });

  it("orders categories and PRs deterministically", () => {
    const input = [pr(9, "Fix nine", ["changelog:fix"]), pr(5, "Feature", ["changelog:feature"]), pr(2, "Fix two", ["changelog:fix"])];
    expect(entriesFromPullRequests(input, repo).map(({ prNumber }) => prNumber)).toEqual([5, 2, 9]);
    expect(renderReleaseBody(entriesFromPullRequests(input.reverse(), repo))).toMatch(/^## Features[\s\S]*## Fixes[\s\S]*#2[\s\S]*#9/);
  });

  it("preserves title characters verbatim and safely serializes them", () => {
    const title = 'Fix "quotes", backslash \\ and <tags>\nnext line';
    const entries = entriesFromPullRequests([pr(10, title, ["changelog:fix"])], repo);
    expect(entries[0].title).toEqual({ en: title });
    expect(JSON.parse(JSON.stringify(entries))[0].title.en).toBe(title);
    expect(renderReleaseBody(entries)).toContain('- Fix "quotes", backslash \\\\ and \\<tags\\> next line');
  });

  it("preserves existing releases and sorts releases newest first", () => {
    const oldRelease = { version: "260929.0", releasedAt: "2026-09-29T00:00:00.000Z", entries: [] };
    const newRelease = { version: "260930.0", releasedAt: "2026-09-30T00:00:00.000Z", entries: [] };
    expect(mergeRelease([oldRelease], newRelease)).toEqual([newRelease, oldRelease]);
  });
});
