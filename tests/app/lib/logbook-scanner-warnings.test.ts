import { describe, expect, it } from "vitest";
import { findLocalWarnings, repairShiftedMissingMagneticCourse } from "../../../app/lib/logbook-scanner/openai-provider";
import type { ScannerResult } from "../../../app/models/logbook-scanner";

describe("logbook scanner course diagnostics", () => {
  it("does not warn for a complete and consistent course chain crossing north", () => {
    const warnings = courseWarnings({
      compassCourse: "358°", deviation: "+4°", magneticCourse: "2°",
      variation: "-3°", trueCourse: "359°", windDrift: "+3°",
      courseThroughWater: "2°", currentDrift: "-4°", courseOverGround: "358°",
    });

    expect(warnings).toEqual([]);
  });

  it("allows the legitimate compact template endpoint pair", () => {
    expect(courseWarnings({ compassCourse: "100", courseOverGround: "112" })).toEqual([]);
  });

  it("warns about missing interior course fields without filling them", () => {
    const line = { compassCourse: "100", magneticCourse: "102", trueCourse: "105" };

    expect(courseWarnings(line)).toContainEqual({ code: "incompleteCourseChain", row: 1, fields: ["deviation", "variation"] });
    expect(line).toEqual({ compassCourse: "100", magneticCourse: "102", trueCourse: "105" });
  });

  it("warns about inconsistent signed course conversions", () => {
    const warnings = courseWarnings({
      compassCourse: "100", deviation: "-2", magneticCourse: "110",
      variation: "+3", trueCourse: "113",
    });

    expect(warnings).toContainEqual({ code: "inconsistentCourseConversion", row: 1, fields: ["compassCourse", "deviation", "magneticCourse"] });
    expect(warnings).not.toContainEqual({ code: "inconsistentCourseConversion", row: 1, fields: ["magneticCourse", "variation", "trueCourse"] });
  });

  it("accepts decimal commas and small transcription rounding differences", () => {
    expect(courseWarnings({
      trueCourse: "359,5°", windDrift: "+1,2°", courseThroughWater: "1°",
    })).toEqual([]);
  });
});

describe("missing magnetic-course column repair", () => {
  it("moves consistently shifted variation and true-course values without inventing magnetic course", () => {
    const result = scannerResult([
      { compassCourse: "61", deviation: "6", magneticCourse: "1", variation: "68", trueCourse: "" },
      { compassCourse: "81", deviation: "8", magneticCourse: "1", variation: "90", trueCourse: "" },
      { compassCourse: "35", deviation: "4", magneticCourse: "1", variation: "40", trueCourse: "" },
    ]);

    expect(repairShiftedMissingMagneticCourse(result)).toBe(true);
    expect(result.draft.lines).toEqual([
      expect.objectContaining({ magneticCourse: "", variation: "1", trueCourse: "68" }),
      expect.objectContaining({ magneticCourse: "", variation: "1", trueCourse: "90" }),
      expect.objectContaining({ magneticCourse: "", variation: "1", trueCourse: "40" }),
    ]);
    expect(result.warnings).toContainEqual({ code: "shiftedMissingMagneticCourse" });
  });

  it("does not alter a complete course chain", () => {
    const result = scannerResult([
      { compassCourse: "61", deviation: "6", magneticCourse: "67", variation: "1", trueCourse: "68" },
      { compassCourse: "81", deviation: "8", magneticCourse: "89", variation: "1", trueCourse: "90" },
    ]);

    expect(repairShiftedMissingMagneticCourse(result)).toBe(false);
    expect(result.draft.lines[0]).toEqual(expect.objectContaining({ magneticCourse: "67", variation: "1", trueCourse: "68" }));
  });

  it("does not repair an isolated or arithmetically inconsistent row", () => {
    const result = scannerResult([
      { compassCourse: "61", deviation: "6", magneticCourse: "1", variation: "68", trueCourse: "" },
    ]);

    expect(repairShiftedMissingMagneticCourse(result)).toBe(false);
    expect(result.draft.lines[0]).toEqual(expect.objectContaining({ magneticCourse: "1", variation: "68", trueCourse: "" }));
  });
});

function courseWarnings(line: ScannerResult["draft"]["lines"][number]) {
  const result = scannerResult([line]);

  return findLocalWarnings(result).filter((warning) => warning.code === "incompleteCourseChain" || warning.code === "inconsistentCourseConversion");
}

function scannerResult(lines: ScannerResult["draft"]["lines"]): ScannerResult {
  return {
    draft: {
      title: "Test",
      dateText: "2026-08-04",
      route: { from: "A", to: "B", departed: "10:00", arrived: "11:00" },
      lines: lines.map((line) => ({ time: "10:30", position: "At sea", speedKn: "5", logNm: "10", ...line })),
    },
    warnings: [],
  };
}
