import { describe, expect, it } from "vitest";
import type { ScannerWarning } from "../../../app/models/logbook";
import { indexScannerWarnings } from "../../../app/lib/logbook-scanner/warning-fields";

describe("scanner warning field indexing", () => {
  it("maps missing and course-chain warnings to every mentioned row field", () => {
    const missingWarning: ScannerWarning = { id: "missing", code: "missingFields" as const, row: 2, fields: ["latitude", "windStrength"] };
    const courseWarning: ScannerWarning = { id: "course", code: "inconsistentCourseConversion" as const, row: 2, fields: ["compassCourse", "deviation", "magneticCourse"], acknowledgedAt: "2026-01-01T00:00:00.000Z" };
    const indexed = indexScannerWarnings([missingWarning, courseWarning]);

    expect(indexed.lineFields.get(2)?.get("latitude")).toHaveLength(1);
    expect(indexed.lineFields.get(2)?.get("windStrength")).toHaveLength(1);
    expect(indexed.lineFields.get(2)?.get("compassCourse")).toHaveLength(1);
    expect(indexed.lineFields.get(2)?.get("deviation")).toHaveLength(1);
    expect(indexed.lineFields.get(2)?.get("magneticCourse")).toEqual([courseWarning]);
    expect(indexed.unmatched).toEqual([]);
  });

  it("preserves warning identity while filtering acknowledged records", () => {
    const active: ScannerWarning = { id: "active", code: "missingFields" as const, row: 1, fields: ["latitude"] };
    const acknowledged: ScannerWarning = { id: "done", code: "missingFields" as const, row: 1, fields: ["longitude"] as const, acknowledgedAt: "2026-01-01T00:00:00.000Z" };
    const indexed = indexScannerWarnings([active, acknowledged].filter((warning) => !("acknowledgedAt" in warning)));

    expect(indexed.lineFields.get(1)?.get("latitude")).toEqual([active]);
    expect(indexed.lineFields.get(1)?.has("longitude")).toBe(false);
    expect(indexed.lineFields.get(1)?.get("latitude")?.[0]).toBe(active);
  });

  it("keeps duplicate messages with distinct IDs as distinct warnings", () => {
    const warnings: ScannerWarning[] = [
      { id: "first", code: "missingFields" as const, row: 1, fields: ["latitude"] },
      { id: "second", code: "missingFields" as const, row: 1, fields: ["latitude"] },
    ];
    expect(indexScannerWarnings(warnings).lineFields.get(1)?.get("latitude")).toEqual(warnings);
  });

  it("keeps sheet-level and unassignable row warnings available for the notice", () => {
    const sheetWarning: ScannerWarning = { id: "sheet", code: "missingSheetTitle" as const };
    const rowWarning: ScannerWarning = { id: "row", code: "scannerGenerated" as const, row: 3, fallbackMessage: "Needs manual review." };
    const indexed = indexScannerWarnings([sheetWarning, rowWarning]);
    expect(indexed.unmatched).toEqual([sheetWarning]);
    expect(indexed.lineWarnings.get(3)).toEqual([rowWarning]);
  });
});
