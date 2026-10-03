import { describe, expect, it } from "vitest";
import { parseBuildInfo } from "../../../app/lib/build-info-types";

const fullSha = "0123456789abcdef0123456789abcdef01234567";

describe("build info types", () => {
  it("requires a full production SHA and derives its display identity", () => {
    expect(
      parseBuildInfo({ environment: "production", commitSha: fullSha }),
    ).toEqual({
      environment: "production",
      commitSha: fullSha,
      identity: "0123456",
    });
    expect(() => parseBuildInfo({ environment: "production" })).toThrow(
      /full commit SHA/i,
    );
    expect(() =>
      parseBuildInfo({ environment: "production", commitSha: "0123456" }),
    ).toThrow(/full commit SHA/i);
    expect(() =>
      parseBuildInfo({ environment: "production", commitSha: "x".repeat(40) }),
    ).toThrow(/full commit SHA/i);
  });

  it("composes preview identities from whichever normalized components exist", () => {
    expect(
      parseBuildInfo({
        environment: "preview",
        branch: "fix-map",
        commitSha: "abcdef1",
      }).identity,
    ).toBe("fix-map@abcdef1");
    expect(
      parseBuildInfo({ environment: "preview", branch: "fix-map" }).identity,
    ).toBe("fix-map");
    expect(
      parseBuildInfo({ environment: "preview", commitSha: fullSha }).identity,
    ).toBe("0123456");
    expect(parseBuildInfo({ environment: "preview" })).toEqual({
      environment: "preview",
    });
  });

  it("keeps long branch display identities compact without changing their metadata", () => {
    const branch = `feature-${"a".repeat(80)}`;
    const result = parseBuildInfo({
      environment: "preview",
      branch,
      commitSha: fullSha,
    });
    expect(result.branch).toBe(branch);
    expect(result.identity).toHaveLength(40);
    expect(result.identity).toMatch(/…@0123456$/);
  });

  it.each(["preview", "staging", "development"] as const)(
    "does not let %s metadata claim production",
    (environment) => {
      expect(
        parseBuildInfo({ environment, targetEnvironment: "production" }),
      ).toEqual({ environment });
    },
  );

  it("accepts only normalized UTC timestamps and HTTPS Vercel deployment origins", () => {
    expect(
      parseBuildInfo({
        environment: "preview",
        commitTimestamp: "2026-10-03T12:00:00.000Z",
        deploymentUrl: "https://ultilog-topic.vercel.app",
      }),
    ).toMatchObject({
      commitTimestamp: "2026-10-03T12:00:00.000Z",
      deploymentUrl: "https://ultilog-topic.vercel.app",
    });
    expect(() =>
      parseBuildInfo({
        environment: "preview",
        commitTimestamp: "2026-10-03T12:00:00+02:00",
      }),
    ).toThrow(/commitTimestamp/);
    expect(() =>
      parseBuildInfo({
        environment: "preview",
        deploymentUrl: "https://ultilog.vercel.app/path",
      }),
    ).toThrow(/deploymentUrl/);
  });
});
