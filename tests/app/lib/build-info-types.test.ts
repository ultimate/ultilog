import { describe, expect, it } from "vitest";
import { isReleaseVersion, parseBuildInfo } from "../../../app/lib/build-info-types";

describe("build info", () => {
  it.each(["0.1.0", "1.0.0", "12.34.56-rc.1", "1.2.3+build.5"])("accepts version %s", (version) => {
    expect(isReleaseVersion(version)).toBe(true);
  });

  it.each(["v1.2.3", "1.2", "01.2.3", "1.2.3-01", "", null])("rejects version %s", (version) => {
    expect(isReleaseVersion(version)).toBe(false);
  });

  it.each(["preview", "staging", "development"] as const)("accepts a metadata-free %s build", (environment) => {
    expect(parseBuildInfo({ environment })).toEqual({ environment });
  });

  it("requires a valid version in production and accepts deployment metadata", () => {
    expect(() => parseBuildInfo({ environment: "production" })).toThrow(/require/i);
    expect(() => parseBuildInfo({ environment: "production", version: "latest" })).toThrow(/version/i);
    expect(parseBuildInfo({ environment: "production", version: "1.2.3", branch: "main", commitSha: "abcdef1", targetEnvironment: "production", deploymentUrl: "https://ultilog.example" })).toMatchObject({ environment: "production", version: "1.2.3" });
  });
});
