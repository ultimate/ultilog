import { describe, expect, it } from "vitest";
import { isReleaseVersion, parseBuildInfo } from "../../../app/lib/build-info-types";

describe("build info", () => {
  it.each(["260911.0", "260911.1", "240229.34"])("accepts version %s", (version) => {
    expect(isReleaseVersion(version)).toBe(true);
  });

  it.each(["v260911.0", "260911", "260911.01", "260911.1-beta", "260231.0", "", null])("rejects version %s", (version) => {
    expect(isReleaseVersion(version)).toBe(false);
  });

  it.each(["preview", "staging", "development"] as const)("accepts a metadata-free %s build", (environment) => {
    expect(parseBuildInfo({ environment })).toEqual({ environment });
  });

  it("requires a valid version in production and accepts deployment metadata", () => {
    expect(() => parseBuildInfo({ environment: "production" })).toThrow(/require/i);
    expect(() => parseBuildInfo({ environment: "production", version: "latest" })).toThrow(/version/i);
    expect(parseBuildInfo({ environment: "production", version: "260911.0", branch: "main", commitSha: "abcdef1", targetEnvironment: "production", deploymentUrl: "https://ultilog.example" })).toMatchObject({ environment: "production", version: "260911.0" });
  });
});
