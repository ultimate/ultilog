import { describe, expect, it } from "vitest";
import { isActionableScannerWarning } from "../../../app/lib/logbook-scanner/actionable-warning";
import { normalizeScannerRows } from "../../../app/lib/logbook-scanner/normalize-result";
import type { ScannerWarningDiagnostic } from "../../../app/lib/logbook-scanner/warning-codes";

describe("actionable scanner warnings", () => {
  it.each(["missingFields", "incompleteCourseChain", "inconsistentCourseConversion"] as const)("requires a row and fields for %s", code => {
    for (const row of [undefined, 0, -1, 1.5]) expect(isActionableScannerWarning({ code, row, fields: ["latitude"] })).toBe(false);
    for (const fields of [undefined, []]) expect(isActionableScannerWarning({ code, row: 1, fields })).toBe(false);
    expect(isActionableScannerWarning({ code, row: 1, fields: ["latitude"] })).toBe(true);
  });

  it("preserves sheet-level and meaningful free-text diagnostics without requiring row metadata", () => {
    for (const code of ["missingSheetTitle", "missingSheetDate", "missingRouteOrigin", "noRows", "rolloverExceededEndDate", "shiftedMissingMagneticCourse"] as const) expect(isActionableScannerWarning({ code })).toBe(true);
    expect(isActionableScannerWarning({ code: "scannerGenerated", fallbackMessage: "Check the cropped page edge." })).toBe(true);
    expect(isActionableScannerWarning({ code: "scannerGenerated", fallbackMessage: "  " })).toBe(false);
  });

  it("drops incomplete model diagnostics while preserving valid warnings and their row mapping", () => {
    const warnings: ScannerWarningDiagnostic[] = [{ code: "missingFields" }, { code: "incompleteCourseChain", row: 2, fields: [] }, { code: "missingFields", row: 2, fields: ["time"] }, { code: "missingSheetDate" }];
    const result = normalizeScannerRows({ draft: { lines: [{}, { speedKn: "5" }] }, warnings });
    expect(result.warnings).toEqual([{ code: "missingFields", row: 1, fields: ["time"] }, { code: "missingSheetDate" }]);
    expect(warnings).toHaveLength(4);
  });
});
