import { describe, expect, it } from "vitest";
import { validateBoat, validateBoatUpdate } from "../../../app/lib/validation/boat";
import { boatToForm } from "../../../app/components/logbook/forms";

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
  it.each([
    ["Switzerland", "CH"],
    ["🇨🇭", "CH"],
    ["ch", "CH"],
  ])("normalizes a legacy flag value of %s before saving", (flagState, expected) => {
    expect(validateBoat({ ...boat, flagState }).flagState).toBe(expected);
  });

  it("preserves concurrency metadata while normalizing an update", () => {
    const update = validateBoatUpdate({ ...boat, flagState: "🇨🇭", revision: 2, createdAt: "created", updatedAt: "updated" });

    expect(update).toMatchObject({ flagState: "CH", revision: 2, createdAt: "created", updatedAt: "updated" });
  });

  it("normalizes legacy values before populating the boat editor", () => {
    expect(boatToForm({ ...boat, type: "Sail", flagState: "🇨🇭" }).flagState).toBe("CH");
  });

  it("rejects values that do not identify a supported country", () => {
    expect(() => validateBoat({ ...boat, flagState: "not-a-country" })).toThrow("must identify a supported country");
  });
});
