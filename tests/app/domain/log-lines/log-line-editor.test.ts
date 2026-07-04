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
