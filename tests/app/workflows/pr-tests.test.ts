import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/pr-tests.yml", "utf8");

describe("pull request verification workflow", () => {
  it("checks out complete history for stable-ID introduction analysis", () => {
    expect(workflow).toContain("uses: actions/checkout@v4");
    expect(workflow).toContain("fetch-depth: 0");
  });
});
