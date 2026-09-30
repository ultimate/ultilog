import { describe, expect, it } from "vitest";
import { validateReleaseArtifact } from "../../../scripts/validate-release-artifact.mjs";

const release = (version, numbers = []) => ({
  version,
  releasedAt: "2026-09-30T12:00:00.000Z",
  entries: numbers.map((prNumber) => ({ category: "fix", prNumber, prUrl: `https://github.com/example/ultilog/pull/${prNumber}`, title: { en: `Fix ${prNumber}` } })),
});

describe("generated release artifact validation", () => {
  it("accepts the allocated version and immutable tag", () => {
    const artifact = [release("260930.1", [42]), release("260929.0", [41])];
    expect(validateReleaseArtifact(artifact, "260930.1", "v260930.1")).toBe(artifact);
  });

  it("requires the current version to match the allocated tag", () => {
    expect(() => validateReleaseArtifact([release("260929.0")], "260930.0", "v260930.0")).toThrow("Current artifact version");
    expect(() => validateReleaseArtifact([release("260930.0")], "260930.0", "260930.0")).toThrow("immutable");
  });

  it("rejects duplicate PR numbers within or across releases", () => {
    expect(() => validateReleaseArtifact([release("260930.0", [42, 42])], "260930.0", "v260930.0")).toThrow("Duplicate PR #42");
    expect(() => validateReleaseArtifact([release("260930.0", [42]), release("260929.0", [42])], "260930.0", "v260930.0")).toThrow("Duplicate PR #42");
  });
});
