import { describe, expect, it } from "vitest";
import { getBuildInfo } from "../../../app/lib/build-info";

const fullSha = "fedcba9876543210fedcba9876543210fedcba98";

describe("build info", () => {
  it("derives a production identity from its full commit SHA", () => {
    expect(
      getBuildInfo({
        VERCEL: "1",
        VERCEL_ENV: "production",
        BUILD_COMMIT_SHA: fullSha,
        BUILD_STARTED_AT: "2026-10-03T12:00:00.000Z",
      }),
    ).toMatchObject({
      environment: "production",
      commitSha: fullSha,
      identity: "fedcba9",
      buildStartedAt: "2026-10-03T12:00:00.000Z",
    });
  });

  it("rejects missing and invalid production SHAs", () => {
    expect(() => getBuildInfo({ VERCEL_ENV: "production" })).toThrow(
      /full commit SHA/i,
    );
    expect(() =>
      getBuildInfo({
        VERCEL_ENV: "production",
        VERCEL_GIT_COMMIT_SHA: "abcdef1",
      }),
    ).toThrow(/full commit SHA/i);
  });

  it("supports short preview SHAs and omits unavailable identity components", () => {
    expect(
      getBuildInfo({
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "topic",
        VERCEL_GIT_COMMIT_SHA: "abcdef1",
      }),
    ).toMatchObject({
      environment: "preview",
      identity: "topic@abcdef1",
    });
    expect(getBuildInfo({ VERCEL_ENV: "preview" })).toEqual({
      environment: "preview",
    });
  });

  it("represents Vercel custom environments as staging", () => {
    expect(
      getBuildInfo({
        VERCEL_ENV: "preview",
        VERCEL_TARGET_ENV: "qa",
        VERCEL_GIT_COMMIT_SHA: "abcdef1",
      }),
    ).toEqual({
      environment: "staging",
      commitSha: "abcdef1",
      targetEnvironment: "qa",
      identity: "abcdef1",
    });
  });

  it("treats local and non-Vercel builds as development", () => {
    expect(getBuildInfo({})).toEqual({ environment: "development" });
    expect(getBuildInfo({ VERCEL_GIT_COMMIT_REF: "local" })).toEqual({
      environment: "development",
      branch: "local",
      identity: "local",
    });
  });
});
