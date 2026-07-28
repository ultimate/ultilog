import { describe, expect, it } from "vitest";
import { updateLogLineFormForInput } from "../../../../app/domain/log-lines/log-line-editor";
import { defaultLineForm } from "../../../../app/components/logbook/forms";
import type { Boat } from "../../../../app/models/logbook";

const boatWithDeviation = {
  deviationTable: [
    { heading: 0, deviation: "0" },
    { heading: 10, deviation: "5" },
    { heading: 20, deviation: "10" },
  ],
} as Pick<Boat, "deviationTable">;

describe("log line editor business logic", () => {
  it("normalizes coordinate edits before returning the updated form", async () => {
    await expect(Promise.resolve(updateLogLineFormForInput(defaultLineForm, { field: "latitude", value: "91" }))).resolves.toMatchObject({ latitude: "90" });
    const updated = await Promise.resolve(updateLogLineFormForInput(defaultLineForm, { field: "longitude", value: "180.1" }));
    expect(Number(updated.longitude)).toBeCloseTo(-179.9, 6);
  });

  it("recalculates course fields and lets the boat deviation table override a typed deviation", () => {
    const form = { ...defaultLineForm, compassCourse: "10", deviation: "99", variation: "2" };

    expect(updateLogLineFormForInput(form, { field: "compassCourse", value: "10" }, { boat: boatWithDeviation })).toMatchObject({
      compassCourse: "10",
      deviation: "5",
      magneticCourse: "15",
      variation: "2",
      trueCourse: "17",
    });
  });

  it("uses renamed course form fields when calculating drift corrections", () => {
    const form = { ...defaultLineForm, trueCourse: "100", windDrift: "5" };

    expect(updateLogLineFormForInput(form, { field: "windDrift", value: "5" })).toMatchObject({
      trueCourse: "100",
      windDrift: "5",
      courseThroughWater: "105",
    });
  });

  it("keeps a course field empty when the user explicitly clears it", () => {
    const form = { ...defaultLineForm, trueCourse: "100", windDrift: "5", courseThroughWater: "105" };

    expect(updateLogLineFormForInput(form, { field: "trueCourse", value: "" })).toMatchObject({
      trueCourse: "",
      windDrift: "5",
      courseThroughWater: "105",
    });
  });

  it("uses coordinates and date for async variation lookup", async () => {
    const form = { ...defaultLineForm, time: "2026-05-14T07:35", latitude: "38", longitude: "20", magneticCourse: "15" };

    await expect(updateLogLineFormForInput(form, { field: "latitude", value: "39" }, {
      variationLookup: async (request) => {
        expect(request.latitude).toBe(39);
        expect(request.longitude).toBe(20);
        expect(request.date?.toISOString()).toBe("2026-05-14T07:35:00.000Z");
        return 3;
      },
    })).resolves.toMatchObject({ latitude: "39", variation: "3", trueCourse: "18" });
  });
});

it("uses the boat wind drift table when wind direction and true course are known", () => {
  const boat = {
    deviationTable: [],
    windDriftTable: {
      windSpeedLimits: { fullSail: "0", secondReef: "15", stormSail: "30" },
      rows: [
        { angle: "closeHauled", values: { fullSail: "4", secondReef: "8", stormSail: "16" } },
        { angle: "beamReach", values: { fullSail: "2", secondReef: "4", stormSail: "8" } },
        { angle: "broadReach", values: { fullSail: "1", secondReef: "2", stormSail: "4" } },
      ],
    },
  } as Pick<Boat, "deviationTable" | "windDriftTable">;
  const form = { ...defaultLineForm, trueCourse: "100", windDirection: "E", windStrength: "10", windUnit: "m/s", windDrift: "99" };

  expect(updateLogLineFormForInput(form, { field: "windDirection", value: "E" }, { boat })).toMatchObject({
    trueCourse: "100",
    windDrift: "8",
    courseThroughWater: "108",
  });
});
