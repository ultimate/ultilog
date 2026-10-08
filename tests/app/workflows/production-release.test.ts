import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  ".github/workflows/production-release.yml",
  "utf8",
);
const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
  git?: { deploymentEnabled?: Record<string, boolean> };
};

describe("production release workflow", () => {
  it("automatically verifies immutable main revisions with complete history", () => {
    expect(workflow).toMatch(/push:\s+branches:\s+- main/);
    expect(workflow).toContain("ref: ${{ github.sha }}");
    expect(workflow).toContain("fetch-depth: 0");
    expect(workflow).not.toContain("workflow_dispatch");
  });

  it("retains verification and exact prebuilt deployment", () => {
    for (const command of [
      "npm run typecheck",
      "npm test",
      "npm run build",
      "npm run test:e2e:ci",
      "vercel@latest pull",
      "vercel@latest build --prod",
      "vercel@latest deploy --prebuilt --prod",
    ]) {
      expect(workflow).toContain(command);
    }
  });

  it("passes accurately named normalized build metadata", () => {
    expect(workflow).toContain("BUILD_COMMIT_SHA");
    expect(workflow).toContain("BUILD_STARTED_AT");
    expect(workflow).toContain("commit_sha=$GITHUB_SHA");
    expect(workflow).toContain("date -u +'%Y-%m-%dT%H:%M:%S.000Z'");
    expect(workflow).not.toContain("--build-env");
  });

  it("prevents obsolete runs and uses Actions as the sole deployment authority", () => {
    expect(workflow).toMatch(
      /group: production-release\s+cancel-in-progress: true/,
    );
    expect(workflow).toContain("git ls-remote origin refs/heads/main");
    expect(vercel.git?.deploymentEnabled?.main).toBe(false);
  });

  it("contains no tag allocation or GitHub Release behavior", () => {
    for (const retired of [
      "git fetch --force --tags",
      "git tag",
      "refs/tags",
      "release-version",
      "gh release",
      "generate-notes",
      "api.github.com",
    ]) {
      expect(workflow).not.toContain(retired);
    }
  });
});
