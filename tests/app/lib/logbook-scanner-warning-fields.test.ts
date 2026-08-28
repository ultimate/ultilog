import { describe, expect, it } from "vitest";
import { indexScannerWarnings } from "../../../app/lib/logbook-scanner/warning-fields";

describe("scanner warning field indexing", () => {
  it("maps missing and course-chain warnings to every mentioned row field", () => {
    const indexed = indexScannerWarnings([
      "Row 2 is missing or unclear: latitude, windStrength.",
      "Row 2 has inconsistent course conversion: compassCourse + deviation does not match magneticCourse.",
    ]);

    expect(indexed.lineFields.get(2)?.get("latitude")).toHaveLength(1);
    expect(indexed.lineFields.get(2)?.get("windStrength")).toHaveLength(1);
    expect(indexed.lineFields.get(2)?.get("compassCourse")).toHaveLength(1);
    expect(indexed.lineFields.get(2)?.get("deviation")).toHaveLength(1);
    expect(indexed.lineFields.get(2)?.get("magneticCourse")).toHaveLength(1);
    expect(indexed.unmatched).toEqual([]);
  });

  it("keeps sheet-level and unassignable row warnings available for the notice", () => {
    const indexed = indexScannerWarnings(["Missing or unclear sheet title.", "Row 3 needs manual review."]);
    expect(indexed.unmatched).toEqual(["Missing or unclear sheet title."]);
    expect(indexed.lineWarnings.get(3)).toEqual(["Row 3 needs manual review."]);
  });
});
