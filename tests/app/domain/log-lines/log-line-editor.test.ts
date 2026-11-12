import { describe, expect, it } from "vitest";
import { updateLogLineFormForInput, recalculateLogLineCourses, logLineInputKey } from "../../../../app/domain/log-lines/log-line-editor";
import { defaultLineForm } from "../../../../app/components/logbook/forms";
import { courseSourcesFor } from "../../../../app/models/course-field-sources";
import type { Boat, LineForm } from "../../../../app/models/logbook";

const boat = { deviationTable: [{ heading: 0, deviation: "2" }] } as Pick<Boat, "deviationTable">;
const inputForm = (fields: Partial<LineForm>): LineForm => ({ ...defaultLineForm, ...fields, courseFieldSources: courseSourcesFor(fields) });

describe("source-aware course editor", () => {
  it("closes a saved draft after automatic refreshes but retains subsequent user edits", () => {
    const form = inputForm({ compassCourse: "20", remarks: "Original" });
    const refreshed = { ...form, magneticCourse: "22", courseFieldSources: { ...form.courseFieldSources } };
    expect(logLineInputKey(refreshed)).toBe(logLineInputKey(form));
    expect(logLineInputKey({ ...refreshed, remarks: "Typed while saving" })).not.toBe(logLineInputKey(form));
    expect(logLineInputKey({ ...refreshed, courseFieldSources: { ...form.courseFieldSources, magneticCourse: "input" } })).not.toBe(logLineInputKey(form));
  });

  it("recalculates the whole derived chain for every typed digit", async () => {
    let form = inputForm({ variation: "3", windDrift: "1", currentDrift: "2" });
    for (const compass of ["1", "12", "123"]) {
      form = await updateLogLineFormForInput(form, { field: "compassCourse", value: compass }, { boat });
      expect(form.magneticCourse).toBe(String(Number(compass) + 2));
      expect(form.courseOverGround).toBe(String(Number(compass) + 8));
      expect(form.courseFieldSources.compassCourse).toBe("input");
      expect(form.courseFieldSources.magneticCourse).toBe("calculated");
    }
  });

  it.each(["input", "scanned"] as const)("protects %s values including table corrections and zero", async source => {
    const form = inputForm({ deviation: "0", magneticCourse: "0" });
    form.courseFieldSources.deviation = source;
    form.courseFieldSources.magneticCourse = source;
    const next = await updateLogLineFormForInput(form, { field: "compassCourse", value: "123" }, { boat });
    expect(next).toMatchObject({ deviation: "0", magneticCourse: "0" });
    expect(next.courseFieldSources.magneticCourse).toBe(source);
  });

  it("makes a calculated or scanned field manual when edited, then restores automatic calculation when cleared", async () => {
    let form = await updateLogLineFormForInput(defaultLineForm, { field: "compassCourse", value: "10" }, { boat });
    form = await updateLogLineFormForInput(form, { field: "magneticCourse", value: "50" }, { boat });
    form = await updateLogLineFormForInput(form, { field: "compassCourse", value: "20" }, { boat });
    expect(form.magneticCourse).toBe("50");
    form.courseFieldSources.magneticCourse = "scanned";
    form = await updateLogLineFormForInput(form, { field: "magneticCourse", value: "60" }, { boat });
    expect(form.courseFieldSources.magneticCourse).toBe("input");
    form = await updateLogLineFormForInput(form, { field: "magneticCourse", value: "" }, { boat });
    expect(form.magneticCourse).toBe("22");
    expect(form.courseFieldSources.magneticCourse).toBe("calculated");
  });

  it("clears orphan calculations instead of using their old values as inputs", async () => {
    let form = await updateLogLineFormForInput(defaultLineForm, { field: "compassCourse", value: "10" }, { boat });
    expect(form.magneticCourse).toBe("12");
    form = await updateLogLineFormForInput(form, { field: "compassCourse", value: "" }, { boat });
    expect(form.compassCourse).toBe("");
    expect(form.magneticCourse).toBe("");
  });

  it("calculates backwards from a fixed magnetic course without overwriting it", async () => {
    const next = await recalculateLogLineCourses(inputForm({ magneticCourse: "22", deviation: "2" }));
    expect(next.compassCourse).toBe("20");
    expect(next.magneticCourse).toBe("22");
  });

  it("preserves incomplete manual input", async () => {
    const next = await updateLogLineFormForInput(inputForm({ trueCourse: "100" }), { field: "windDrift", value: "-" });
    expect(next.windDrift).toBe("-");
    expect(next.courseThroughWater).toBe("");
  });

  it("uses fresh position/date for automatic variation and keeps manual variation", async () => {
    const form = inputForm({ time: "2026-05-14T07:35Z", latitude: "38", longitude: "20", magneticCourse: "15" });
    const next = await updateLogLineFormForInput(form, { field: "latitude", value: "39" }, { variationLookup: async request => {
      expect(request.latitude).toBe(39);
      return 3;
    } });
    expect(next).toMatchObject({ variation: "3", trueCourse: "18" });
    const moved = await updateLogLineFormForInput(next, { field: "longitude", value: "21" }, { variationLookup: async () => 4 });
    expect(moved).toMatchObject({ variation: "4", trueCourse: "19" });
    const fixed = inputForm({ ...form, variation: "0" });
    expect(await recalculateLogLineCourses(fixed, { variationLookup: async () => { throw new Error("Must not look up a fixed value"); } })).toMatchObject({ variation: "0", trueCourse: "15" });
  });

  it("updates local courses immediately and clears unavailable remote dependencies on failure", async () => {
    const form = inputForm({ compassCourse: "20", latitude: "39", longitude: "20" });
    form.variation = "99";
    form.trueCourse = "121";
    const immediate = recalculateLogLineCourses(form, { boat, lookupVariation: false });
    expect(immediate).toMatchObject({ magneticCourse: "22", variation: "", trueCourse: "" });
    const failed = await recalculateLogLineCourses(form, { boat, variationLookup: async () => { throw new Error("Offline"); } });
    expect(failed).toMatchObject({ compassCourse: "20", magneticCourse: "22", variation: "", trueCourse: "" });
  });

  it("looks up variation from coordinates before any course is entered", async () => {
    const lookup = async () => 4;
    expect(await recalculateLogLineCourses(inputForm({ latitude: "54.1", longitude: "10.2" }), { variationLookup: lookup })).toMatchObject({ variation: "4", compassCourse: "", magneticCourse: "" });
  });
  it("normalizes coordinates and ignores legacy empty wind tables", async () => {
    expect(await updateLogLineFormForInput(defaultLineForm, { field: "latitude", value: "91" })).toMatchObject({ latitude: "90" });
    expect(await updateLogLineFormForInput(defaultLineForm, { field: "compassCourse", value: "10" }, { boat: { ...boat, windDriftTable: [] } as unknown as Boat })).toMatchObject({ magneticCourse: "12" });
  });

  it("updates automatic wind drift from wind changes", async () => {
    const driftBoat = { deviationTable: [], windDriftTable: { windSpeedLimits: { fullSail: "0", secondReef: "15", stormSail: "30" }, rows: [
      { angle: "closeHauled", values: { fullSail: "4", secondReef: "8", stormSail: "16" } },
      { angle: "beamReach", values: { fullSail: "2", secondReef: "4", stormSail: "8" } },
    ] } } as Pick<Boat, "deviationTable" | "windDriftTable">;
    const form = inputForm({ trueCourse: "100", windDirection: "E", windStrength: "10", windUnit: "kn" });
    const first = await recalculateLogLineCourses(form, { boat: driftBoat });
    expect(first.windDrift).toBe("4");
    const second = await updateLogLineFormForInput(first, { field: "windStrength", value: "20" }, { boat: driftBoat });
    expect(second).toMatchObject({ windDrift: "8", courseThroughWater: "108" });
  });
});
