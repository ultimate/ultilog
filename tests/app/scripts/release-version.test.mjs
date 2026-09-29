import { describe, expect, it } from "vitest";
import { calculateReleaseVersion, githubActionsOutput, utcReleaseDate } from "../../../scripts/release-version.mjs";

describe("release version generation", () => {
  it("uses suffix zero for the first release of a UTC day", () => {
    expect(calculateReleaseVersion([], new Date("2026-09-11T12:00:00Z"))).toEqual({
      version: "260911.0",
      tag: "v260911.0",
    });
  });

  it("increments the highest suffix across multiple releases", () => {
    expect(calculateReleaseVersion(["v260911.0", "v260911.1", "v260911.2"], new Date("2026-09-11T12:00:00Z"))).toEqual({
      version: "260911.3",
      tag: "v260911.3",
    });
  });

  it("uses the highest suffix when existing releases contain gaps", () => {
    expect(calculateReleaseVersion(["v260911.0", "v260911.7", "v260911.3"], new Date("2026-09-11T12:00:00Z")).version).toBe("260911.8");
  });

  it("ignores malformed and partial tag matches", () => {
    const tags = [
      "260911.12",
      "v260911",
      "v260911.-1",
      "v260911.1-beta",
      "prefix-v260911.9",
      "v260911.2+build",
      "v260911.9007199254740992",
    ];
    expect(calculateReleaseVersion(tags, new Date("2026-09-11T12:00:00Z")).version).toBe("260911.0");
  });

  it("ignores valid release tags from previous days", () => {
    expect(calculateReleaseVersion(["v260910.20", "v250911.4"], new Date("2026-09-11T12:00:00Z")).version).toBe("260911.0");
  });

  it("derives dates on either side of UTC midnight", () => {
    expect(utcReleaseDate(new Date("2026-09-11T23:59:59.999Z"))).toBe("260911");
    expect(utcReleaseDate(new Date("2026-09-12T00:00:00.000Z"))).toBe("260912");
    expect(calculateReleaseVersion(["v260911.4", "v260912.0"], new Date("2026-09-12T00:00:00Z")).version).toBe("260912.1");
  });

  it("formats both identifiers as GitHub Actions outputs", () => {
    expect(githubActionsOutput({ version: "260911.0", tag: "v260911.0" })).toBe("version=260911.0\ntag=v260911.0\n");
  });
});
