import { describe, expect, it } from "vitest";
import {
  getPrintLogColumns,
  formatLogSheetPrintTemplateMarker,
  LOG_SHEET_PRINT_TEMPLATE_ID,
  LOG_SHEET_PRINT_TEMPLATE_REVISION,
  logSheetPrintTemplate,
} from "../../../app/domain/logbook/print-template";
import { locales, t } from "../../../app/lib/i18n/translations";

describe("log sheet print template", () => {
  it("has a stable, versioned identity", () => {
    expect(logSheetPrintTemplate.id).toBe(LOG_SHEET_PRINT_TEMPLATE_ID);
    expect(logSheetPrintTemplate.revision).toBe(LOG_SHEET_PRINT_TEMPLATE_REVISION);
    expect(LOG_SHEET_PRINT_TEMPLATE_ID).toBe("ultilog-logsheet");
    expect(LOG_SHEET_PRINT_TEMPLATE_REVISION).toBe(2);
  });

  it("formats a stable privacy-safe marker for each template variant and locale", () => {
    expect(formatLogSheetPrintTemplateMarker("full", "de")).toBe("ULTILOG:ultilog-logsheet:v2:full:de");
    expect(formatLogSheetPrintTemplateMarker("compact", "it")).toBe("ULTILOG:ultilog-logsheet:v2:compact:it");
    expect(formatLogSheetPrintTemplateMarker("full", "en")).not.toMatch(/user|boat|route/i);
  });

  it("defines the complete course-conversion sequence for the full template", () => {
    const courseColumns = getPrintLogColumns("full")
      .filter((column) => column.className === "print-col-course")
      .map((column) => column.id);

    expect(courseColumns).toEqual([
      "compassCourse",
      "deviation",
      "magneticCourse",
      "variation",
      "trueCourse",
      "windDrift",
      "courseThroughWater",
      "currentDrift",
      "courseOverGround",
    ]);
  });

  it("keeps only compass course and course over ground in the compact template", () => {
    const compact = getPrintLogColumns("compact");
    const courseColumns = compact
      .filter((column) => column.className === "print-col-course")
      .map((column) => column.id);

    expect(courseColumns).toEqual(["compassCourse", "courseOverGround"]);
    expect(compact.every((column) => column.width.compact > 0)).toBe(true);
  });

  it("associates every column with at least one canonical source field", () => {
    for (const column of logSheetPrintTemplate.columns) {
      expect(column.sourceFields, column.id).not.toHaveLength(0);
    }
  });

  it("localizes every column heading in each supported locale", () => {
    for (const locale of locales) {
      for (const column of logSheetPrintTemplate.columns) {
        expect(t(locale, column.headingKey), `${locale}.${column.id}`).not.toHaveLength(0);
      }
    }

    const germanCourseHeadings = getPrintLogColumns("full")
      .filter((column) => column.className === "print-col-course")
      .map((column) => t("de", column.headingKey));
    expect(germanCourseHeadings).toEqual(["MgK", "Abl", "mwK", "Mw", "rwK", "BW", "KdW", "BS", "KüG"]);
  });
});
