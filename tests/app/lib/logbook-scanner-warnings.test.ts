import { describe, expect, it } from "vitest";
import { findLocalWarnings } from "../../../app/lib/logbook-scanner/openai-provider";
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

    expect(courseWarnings(line)).toContain("Row 1 has an incomplete course chain: deviation, variation is missing or unclear.");
    expect(line).toEqual({ compassCourse: "100", magneticCourse: "102", trueCourse: "105" });
  });

  it("warns about inconsistent signed course conversions", () => {
    const warnings = courseWarnings({
      compassCourse: "100", deviation: "-2", magneticCourse: "110",
      variation: "+3", trueCourse: "113",
    });

    expect(warnings).toContain("Row 1 has inconsistent course conversion: compassCourse + deviation does not match magneticCourse.");
    expect(warnings).not.toContain("Row 1 has inconsistent course conversion: magneticCourse + variation does not match trueCourse.");
  });

  it("accepts decimal commas and small transcription rounding differences", () => {
    expect(courseWarnings({
      trueCourse: "359,5°", windDrift: "+1,2°", courseThroughWater: "1°",
    })).toEqual([]);
  });
});

function courseWarnings(line: ScannerResult["draft"]["lines"][number]) {
  const result: ScannerResult = {
    draft: {
      title: "Test",
      dateRange: "2026-08-04",
      route: { from: "A", to: "B", departed: "10:00", arrived: "11:00" },
      lines: [{ time: "10:30", position: "At sea", speedKn: "5", logNm: "10", ...line }],
    },
    warnings: [],
  };

  return findLocalWarnings(result).filter((warning) => warning.includes("course chain") || warning.includes("course conversion"));
}
