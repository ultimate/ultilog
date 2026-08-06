import { describe, expect, it } from "vitest";
import { createScannedSheet } from "../../../app/lib/logbook-scanner/create-scanned-sheet";
import type { ScannerResult } from "../../../app/models/logbook-scanner";

describe("scanned log-line dates", () => {
  it("combines time-only log lines with the extracted sheet date", () => {
    const sheet = createSheet(scannerResult({ dateRange: "2026-07-01", times: ["7:30", "07:45:15"] }));

    expect(sheet.lines.map((line) => line.time)).toEqual(["2026-07-01T07:30", "2026-07-01T07:45:15"]);
  });

  it("normalizes a printed day-first sheet date", () => {
    const sheet = createSheet(scannerResult({ dateRange: "01.07.26", times: ["09:15"] }));

    expect(sheet.lines[0].time).toBe("2026-07-01T09:15");
  });

  it("falls back to dated route master data", () => {
    const result = scannerResult({ dateRange: "", times: ["10:15"] });
    result.draft.route = { from: "A", to: "B", departed: "2026-07-02, 08:00", arrived: "2026-07-02, 18:00" };

    expect(createSheet(result).lines[0].time).toBe("2026-07-02T10:15");
  });

  it("preserves already dated values and time-only values without an extracted master date", () => {
    const dated = createSheet(scannerResult({ dateRange: "2026-07-01", times: ["2026-07-02T00:15:00+02:00"] }));
    const undated = createSheet(scannerResult({ dateRange: "", times: ["11:30"] }));

    expect(dated.lines[0].time).toBe("2026-07-02T00:15:00+02:00");
    expect(undated.lines[0].time).toBe("11:30");
  });
});

function scannerResult({ dateRange, times }: { dateRange: string; times: string[] }): ScannerResult {
  return {
    draft: {
      title: "Scanned sheet",
      dateRange,
      route: { from: "A", to: "B", departed: "", arrived: "" },
      lines: times.map((time) => ({ time })),
    },
    warnings: [],
  };
}

function createSheet(scannerResult: ScannerResult) {
  return createScannedSheet({
    scannerResult,
    boatId: "boat-1",
    logbook: { boats: [], crewMembers: [], sheets: [] },
  });
}
