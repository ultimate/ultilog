import { describe, expect, it } from "vitest";
import { boatToForm } from "../../app/components/logbook/forms";
import { defaultDeviationTable, type Boat } from "../../app/models/logbook";

function boatWithMasterData(masterData: Pick<Boat, "manufacturer" | "mmsi">): Boat {
  return {
    id: "boat-1",
    archived: false,
    name: "Aurora",
    type: "Sail",
    registration: "CH-1",
    flagState: "CH",
    homePort: "Basel",
    owner: "Owner",
    dimensions: "10m",
    logfactor: 1,
    deviationTable: defaultDeviationTable(),
    ...masterData,
  };
}

describe("boatToForm", () => {
  it("keeps absent persisted master data blank through an edit/save conversion", () => {
    const form = boatToForm(boatWithMasterData({ manufacturer: undefined, mmsi: undefined }));
    const saved = {
      manufacturer: form.manufacturer || null,
      mmsi: form.mmsi || null,
    };

    expect(form).toMatchObject({ manufacturer: "", mmsi: "" });
    expect(saved).toEqual({ manufacturer: null, mmsi: null });
  });

  it("preserves real user-entered values without interpreting display text", () => {
    const form = boatToForm(boatWithMasterData({ manufacturer: "N/A Marine", mmsi: "To be completed later: 269" }));

    expect(form).toMatchObject({
      manufacturer: "N/A Marine",
      mmsi: "To be completed later: 269",
    });
  });
});
