import { describe, expect, it } from "vitest";
import { locales } from "../../../app/lib/i18n/translations";
import {
  criticalCourseScannerFields,
  scannerFieldAliases,
} from "../../../app/lib/logbook-scanner/field-aliases";
import type { LineForm } from "../../../app/models/logbook-forms";

const lineFormFields = [
  "time", "position", "latitude", "longitude", "weather", "weatherRemark",
  "temperature", "temperatureUnit", "barometer", "windDirection", "windStrength",
  "windUnit", "waves", "seaUnit", "tide", "tideUnit", "moon", "compassCourse",
  "deviation", "magneticCourse", "variation", "trueCourse", "windDrift",
  "courseThroughWater", "currentDrift", "courseOverGround", "speedKn", "logNm",
  "sailMiles", "sailNote", "motorMiles", "motorHours", "motorNote", "remarks",
] as const satisfies readonly (keyof LineForm)[];

describe("scanner field aliases", () => {
  it("covers every canonical log-line field", () => {
    expect(Object.keys(scannerFieldAliases).sort()).toEqual([...lineFormFields].sort());
  });

  it.each(criticalCourseScannerFields)("has %s terminology in every supported locale", (field) => {
    for (const locale of locales) {
      expect(scannerFieldAliases[field][locale], `${field}.${locale}`).not.toHaveLength(0);
      expect(scannerFieldAliases[field][locale].every((alias) => alias.trim().length > 0)).toBe(true);
    }
  });

  it("maps established German course abbreviations to canonical fields", () => {
    expect(scannerFieldAliases.compassCourse.de).toContain("MgK");
    expect(scannerFieldAliases.deviation.de).toContain("Abl");
    expect(scannerFieldAliases.magneticCourse.de).toContain("mwK");
    expect(scannerFieldAliases.variation.de).toContain("Mw");
    expect(scannerFieldAliases.trueCourse.de).toContain("rwK");
    expect(scannerFieldAliases.windDrift.de).toContain("BW");
    expect(scannerFieldAliases.courseThroughWater.de).toContain("KdW");
    expect(scannerFieldAliases.currentDrift.de).toContain("BS");
    expect(scannerFieldAliases.courseOverGround.de).toContain("KüG");
  });

  it("maps bilingual compound course headings without relying on column position", () => {
    expect(scannerFieldAliases.compassCourse.de).toContain("MgK / Cc");
    expect(scannerFieldAliases.deviation.de).toContain("Abl / d");
    expect(scannerFieldAliases.magneticCourse.de).toContain("mwK / Cm");
    expect(scannerFieldAliases.variation.de).toContain("Mw / D");
    expect(scannerFieldAliases.trueCourse.de).toContain("rwK / Cv");
  });

  it("maps the German Fahrt-in-knots speed heading", () => {
    expect(scannerFieldAliases.speedKn.de).toContain("F [kn]");
    expect(scannerFieldAliases.speedKn.de).toContain("Fahrt [kn]");
  });

  it("maps German wind and current drift abbreviations", () => {
    expect(scannerFieldAliases.windDrift.de).toContain("Windabdrift");
    expect(scannerFieldAliases.windDrift.de).toContain("WA");
    expect(scannerFieldAliases.currentDrift.de).toContain("Stromabdrift");
    expect(scannerFieldAliases.currentDrift.de).toContain("SA");
  });
});
