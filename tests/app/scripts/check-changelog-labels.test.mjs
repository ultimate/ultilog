import { describe, expect, it } from "vitest";
import { validatePullRequestLabels } from "../../../scripts/check-changelog-labels.mjs";

describe("pull request changelog label check", () => {
  it("allows an unlabeled PR and unrelated labels", () => {
    expect(validatePullRequestLabels(10, [])).toBeUndefined();
    expect(validatePullRequestLabels(10, [{ name: "dependencies" }])).toBeUndefined();
  });

  it("accepts exactly one recognized label", () => {
    expect(validatePullRequestLabels(11, [{ name: "changelog:fix" }, { name: "ready" }])).toBe("changelog:fix");
  });

  it("reports conflicting recognized labels", () => {
    expect(() => validatePullRequestLabels(12, [{ name: "changelog:security" }, { name: "changelog:feature" }]))
      .toThrow("PR #12 has multiple recognized changelog labels: changelog:feature, changelog:security");
  });
});
