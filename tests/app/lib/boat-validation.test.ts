import { describe, expect, it } from "vitest";
import { validateBoat, validateBoatUpdate } from "../../../app/lib/validation/boat";

const boat = {
  id: "boat-1",
  name: "Aurora",
  type: "Sail",
  registration: "CH-1",
  flagState: "CH",
  homePort: "Basel",
  owner: "Skipper",
  dimensions: "10m",
  logfactor: 1,
  yachtData: {},
  deviationTable: [],
};

describe("boat validation", () => {
  it.each(["Switzerland", "🇨🇭", "ch"])("rejects the legacy flag value %s", (flagState) => {
    expect(() => validateBoat({ ...boat, flagState })).toThrow("uppercase ISO 3166-1 alpha-2");
  });

  it("preserves concurrency metadata on a strict update", () => {
    const update = validateBoatUpdate({ ...boat, revision: 2, createdAt: "created", updatedAt: "updated" });

    expect(update).toMatchObject({ flagState: "CH", revision: 2, createdAt: "created", updatedAt: "updated" });
  });

  it("rejects values that do not identify a supported country", () => {
    expect(() => validateBoat({ ...boat, flagState: "not-a-country" })).toThrow("uppercase ISO 3166-1 alpha-2");
  });
});
