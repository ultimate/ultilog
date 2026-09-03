import { describe, expect, it } from "vitest";
import { indexScannerWarnings } from "../../../app/lib/logbook-scanner/warning-fields";

describe("scanner warning field indexing", () => {
  it("maps missing and course-chain warnings to every mentioned row field", () => {
    const missingWarning = { id: "missing", message: "Row 2 is missing or unclear: latitude, windStrength." };
    const courseWarning = { id: "course", message: "Row 2 has inconsistent course conversion: compassCourse + deviation does not match magneticCourse.", acknowledgedAt: "2026-01-01T00:00:00.000Z" };
    const indexed = indexScannerWarnings([missingWarning, courseWarning]);

    expect(indexed.lineFields.get(2)?.get("latitude")).toHaveLength(1);
    expect(indexed.lineFields.get(2)?.get("windStrength")).toHaveLength(1);
    expect(indexed.lineFields.get(2)?.get("compassCourse")).toHaveLength(1);
    expect(indexed.lineFields.get(2)?.get("deviation")).toHaveLength(1);
    expect(indexed.lineFields.get(2)?.get("magneticCourse")).toEqual([courseWarning]);
    expect(indexed.unmatched).toEqual([]);
  });

  it("preserves warning identity while filtering acknowledged records", () => {
    const active = { id: "active", message: "Row 1 is missing or unclear: latitude." };
    const acknowledged = { id: "done", message: "Row 1 is missing or unclear: longitude.", acknowledgedAt: "2026-01-01T00:00:00.000Z" };
    const indexed = indexScannerWarnings([active, acknowledged].filter((warning) => !("acknowledgedAt" in warning)));

    expect(indexed.lineFields.get(1)?.get("latitude")).toEqual([active]);
    expect(indexed.lineFields.get(1)?.has("longitude")).toBe(false);
    expect(indexed.lineFields.get(1)?.get("latitude")?.[0]).toBe(active);
  });

  it("keeps duplicate messages with distinct IDs as distinct warnings", () => {
    const warnings = [
      { id: "first", message: "Row 1 is missing or unclear: latitude." },
      { id: "second", message: "Row 1 is missing or unclear: latitude." },
    ];
    expect(indexScannerWarnings(warnings).lineFields.get(1)?.get("latitude")).toEqual(warnings);
  });

  it("keeps sheet-level and unassignable row warnings available for the notice", () => {
    const sheetWarning = { id: "sheet", message: "Missing or unclear sheet title." };
    const rowWarning = { id: "row", message: "Row 3 needs manual review." };
    const indexed = indexScannerWarnings([sheetWarning, rowWarning]);
    expect(indexed.unmatched).toEqual([sheetWarning]);
    expect(indexed.lineWarnings.get(3)).toEqual([rowWarning]);
  });
});
