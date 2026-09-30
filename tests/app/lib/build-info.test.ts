import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let buildInfoFromEnvironment: typeof import("../../../app/lib/build-info").buildInfoFromEnvironment;

beforeAll(async () => {
  ({ buildInfoFromEnvironment } = await import("../../../app/lib/build-info"));
});

describe("server build information", () => {
  it("requires the workflow version for production", () => {
    const base = { VERCEL: "1", VERCEL_ENV: "production" };
    expect(() => buildInfoFromEnvironment(base)).toThrow("Invalid release version");
    expect(() => buildInfoFromEnvironment({ ...base, BUILD_VERSION: "latest" })).toThrow("Invalid release version");
    expect(buildInfoFromEnvironment({ ...base, BUILD_VERSION: "260930.2", VERCEL_URL: "ultilog.vercel.app" }))
      .toEqual({ environment: "production", identity: "260930.2", version: "260930.2", targetEnvironment: "production", deploymentUrl: "https://ultilog.vercel.app" });
  });

  it("builds a preview identity from the full branch and seven SHA characters", () => {
    const branch = `feature/${"long-branch-".repeat(20)}`;
    expect(buildInfoFromEnvironment({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: branch, VERCEL_GIT_COMMIT_SHA: "abcdef1234567890" }))
      .toMatchObject({ environment: "preview", identity: `${branch}@abcdef1`, branch, commitSha: "abcdef1" });
  });

  it("uses VERCEL_TARGET_ENV for a custom staging environment", () => {
    expect(buildInfoFromEnvironment({ VERCEL_ENV: "preview", VERCEL_TARGET_ENV: "staging", VERCEL_GIT_COMMIT_REF: "staging", VERCEL_GIT_COMMIT_SHA: "123456789" }))
      .toMatchObject({ environment: "staging", targetEnvironment: "staging", identity: "staging@1234567" });
  });

  it("omits missing and unusably short preview identity components", () => {
    expect(buildInfoFromEnvironment({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "topic" })).toMatchObject({ identity: "topic" });
    expect(buildInfoFromEnvironment({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_SHA: "abc" })).not.toHaveProperty("identity");
    expect(buildInfoFromEnvironment({ VERCEL_ENV: "preview" })).toEqual({ environment: "preview", targetEnvironment: "preview" });
  });

  it.each([
    {},
    { NODE_ENV: "production", BUILD_VERSION: "260930.2" },
    { VERCEL: "1" },
    { VERCEL_ENV: "development", BUILD_VERSION: "260930.2" },
  ])("represents local and non-Vercel execution as development", (environment) => {
    expect(buildInfoFromEnvironment(environment)).toEqual({ environment: "development", identity: "development" });
  });
});
