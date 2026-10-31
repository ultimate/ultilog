import { describe, expect, it } from "vitest";
import { normalizeScannerRows } from "../../../app/lib/logbook-scanner/normalize-result";
import { createScannedSheet } from "../../../app/lib/logbook-scanner/create-scanned-sheet";
import { defaultLineForm, lineToForm } from "../../../app/components/logbook/forms";
import { lineFormToLogLine } from "../../../app/domain/log-lines/log-line-form";
import { updateScannerWarnings } from "../../../app/lib/logbook-scanner/update-warnings";
import type { ScannerResult, ScannerWarning } from "../../../app/models/logbook";

const line = lineFormToLogLine({ ...defaultLineForm, id: "first", time: "2026-07-12T10:00:00Z" });

describe("scanner row normalization", () => {
  it("removes unused rows, remaps warnings and keeps partial rows and written zeros", () => {
    const result: ScannerResult = { draft: { lines: [{ time: "08:00" }, { temperatureUnit: "°C", windUnit: "kn" }, { barometer: "0" }, { remarks: "Anchored" }, {}] }, warnings: [
      { code: "missingSheetTitle" }, { code: "missingFields", row: 2 },
      { code: "missingFields", row: 3, fields: ["time"] },
      { code: "missingFields", row: 0 }, { code: "missingFields", row: 6 }, { code: "missingFields", row: 1.5 },
    ] };
    const normalized = normalizeScannerRows(result);
    expect(normalized.draft.lines).toEqual([{ time: "08:00" }, { barometer: "0" }, { remarks: "Anchored" }]);
    expect(normalized.warnings).toEqual([{ code: "missingSheetTitle" }, { code: "missingFields", row: 2, fields: ["time"] }]);
    expect(result.draft.lines).toHaveLength(5);
    expect(normalizeScannerRows(normalized)).toEqual(normalized);
  });

  it("preserves blank and explicit zero measurements through scanner conversion and editing", () => {
    const fields = ["latitude", "longitude", "temperature", "barometer", "windStrength", "waves", "tide", "compassCourse", "deviation", "magneticCourse", "variation", "trueCourse", "windDrift", "courseThroughWater", "currentDrift", "courseOverGround", "speedKn", "logNm", "sailMiles", "motorMiles"] as const;
    const blank = Object.fromEntries(fields.map(field => [field, ""]));
    const zero = Object.fromEntries(fields.map(field => [field, "0"]));
    const sheet = createScannedSheet({ scannerResult: { draft: { lines: [{ ...zero, time: "08:00" }, { ...blank, time: "09:00" }] }, warnings: [] }, boatId: "boat", logbook: { boats: [], crewMembers: [], sheets: [] } });
    for (const field of fields) {
      expect(sheet.lines[0][field], field).toBe(0);
      expect(sheet.lines[1][field], field).toBeNull();
      expect(lineToForm(sheet.lines[1])[field], field).toBe("");
      expect(lineFormToLogLine(lineToForm(sheet.lines[1]))[field], field).toBeNull();
    }
    expect(sheet.lines[1].engineHours).toEqual({});
    expect(sheet.lines[1].weather).toBe("");
    expect(sheet.lines[1]).not.toHaveProperty("position");
  });
});

describe("scanner warning updates", () => {
  const warnings: ScannerWarning[] = [
    { id: "multi", code: "missingFields", row: 1, fields: ["latitude", "longitude"] },
    { id: "other", code: "missingFields", row: 1, fields: ["barometer"] },
    { id: "row", code: "scannerGenerated", row: 1, fallbackMessage: "Review row" },
    { id: "sheet", code: "missingSheetDate" },
  ];
  it("acknowledges any changed referenced field only when committing and preserves other warnings", () => {
    const changed = { ...line, latitude: 1 };
    expect(updateScannerWarnings(warnings, [line], [changed])[0].acknowledgedAt).toBeUndefined();
    const updated = updateScannerWarnings(warnings, [line], [changed], "2026-10-26T12:00:00Z");
    expect(updated[0]).toMatchObject({ id: "multi", acknowledgedAt: "2026-10-26T12:00:00Z" });
    expect(updated.slice(1)).toEqual(warnings.slice(1));
    expect(updateScannerWarnings(warnings, [line], [line], "now")).toEqual(warnings);
  });
  it("uses stable line IDs across insertion, reorder and deletion", () => {
    const second = { ...line, id: "second" };
    expect(updateScannerWarnings(warnings, [line], [second, line])[0].row).toBe(2);
    expect(updateScannerWarnings(warnings, [line, second], [second, line])[0].row).toBe(2);
    expect(updateScannerWarnings(warnings, [line, second], [second])).toEqual([warnings[3]]);
  });
  it("does not acknowledge equivalent timestamps or overwrite acknowledged history", () => {
    expect(updateScannerWarnings([{ id: "time", code: "missingFields", row: 1, fields: ["time"] }], [line], [{ ...line, time: "2026-07-12T12:00:00+02:00" }], "now")[0].acknowledgedAt).toBeUndefined();
    const acknowledged = [{ ...warnings[0], acknowledgedAt: "earlier" }];
    expect(updateScannerWarnings(acknowledged, [line], [{ ...line, latitude: 1 }], "later")[0].acknowledgedAt).toBe("earlier");
  });

  it("compares normalized units and engine-hour values rather than object key order", () => {
    const unitWarning: ScannerWarning = { id: "unit", code: "missingFields", row: 1, fields: ["temperatureUnit"] };
    expect(updateScannerWarnings([unitWarning], [{ ...line, temperatureUnit: "c" }], [{ ...line, temperatureUnit: "°C" }], "now")[0].acknowledgedAt).toBeUndefined();
    const engineWarning: ScannerWarning = { id: "engine", code: "missingFields", row: 1, fields: ["motorHours"] };
    const before = [{ ...line, engineHours: { port: 1, starboard: 2 } }];
    expect(updateScannerWarnings([engineWarning], before, [{ ...line, engineHours: { starboard: 2, port: 1 } }], "now")[0].acknowledgedAt).toBeUndefined();
    expect(updateScannerWarnings([engineWarning], before, [{ ...line, engineHours: { port: 0, starboard: 2 } }], "now")[0].acknowledgedAt).toBe("now");
  });
});
