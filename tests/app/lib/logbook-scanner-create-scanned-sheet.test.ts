import { describe, expect, it } from "vitest";
import { createScannedSheet } from "../../../app/lib/logbook-scanner/create-scanned-sheet";
import type { ScannerResult } from "../../../app/models/logbook-scanner";

describe("scanned log-line dates", () => {
  it("combines time-only log lines with the extracted sheet date", () => {
    const sheet = createSheet(scannerResult({ dateText: "2026-07-01", times: ["7:30", "07:45:15"] }));

    expect(sheet.lines.map((line) => line.time)).toEqual(["2026-07-01T07:30", "2026-07-01T07:45:15"]);
  });

  it("normalizes a printed day-first sheet date", () => {
    const sheet = createSheet(scannerResult({ dateText: "01.07.26", times: ["09:15"] }));

    expect(sheet.route.departed).toBe("2026-07-01T00:00:00+00:00");
    expect(sheet.lines[0].time).toBe("2026-07-01T09:15");
  });

  it("falls back to dated route master data", () => {
    const result = scannerResult({ dateText: "", times: ["10:15"] });
    result.draft.route = { from: "A", to: "B", departed: "2026-07-02, 08:00", arrived: "2026-07-02, 18:00" };

    expect(createSheet(result).lines[0].time).toBe("2026-07-02T10:15");
  });

  it("advances the inferred date when sorted time-only rows cross midnight", () => {
    const sheet = createSheet(scannerResult({ dateText: "2026-07-01 - 2026-07-03", times: ["23:00", "01:00", "22:00", "00:30"] }));

    expect(sheet.lines.map((line) => line.time)).toEqual([
      "2026-07-01T23:00",
      "2026-07-02T01:00",
      "2026-07-02T22:00",
      "2026-07-03T00:30",
    ]);
  });

  it("uses an explicitly dated row as the anchor for following time-only rows", () => {
    const sheet = createSheet(scannerResult({ dateText: "2026-07-01 - 2026-07-03", times: ["2026-07-02T23:30", "00:15"] }));

    expect(sheet.lines.map((line) => line.time)).toEqual(["2026-07-02T23:30", "2026-07-03T00:15"]);
  });

  it("caps inferred rollovers at the sheet end date and adds a verification warning", () => {
    const sheet = createSheet(scannerResult({ dateText: "2026-07-01 - 2026-07-02", times: ["23:00", "01:00", "23:30", "00:30"] }));

    expect(sheet.lines.map((line) => line.time)).toEqual([
      "2026-07-01T23:00",
      "2026-07-02T01:00",
      "2026-07-02T23:30",
      "2026-07-02T00:30",
    ]);
    expect(sheet.scannerWarnings).toEqual([expect.objectContaining({
      id: expect.any(String),
      code: "rolloverExceededEndDate",
    })]);
  });

  it("preserves already dated values and time-only values without an extracted master date", () => {
    const dated = createSheet(scannerResult({ dateText: "2026-07-01", times: ["2026-07-02T00:15:00+02:00"] }));
    const undated = createSheet(scannerResult({ dateText: "", times: ["11:30"] }));

    expect(dated.lines[0].time).toBe("2026-07-02T00:15:00+02:00");
    expect(undated.lines[0].time).toBe("11:30");
  });
});

describe("scanned technical log", () => {
  it("keeps configured checks present while applying recognized statuses and extra rows", () => {
    const result = scannerResult({ dateText: "2026-07-01", times: [] });
    result.draft.technicalChecks = [
      { status: "✅", text: "Engine-oil" },
      { status: "⚠️", text: "Bilge alarm" },
    ];

    const sheet = createSheet(result, {
      technicalLogTemplate: [{ status: "⌛", text: "Engine oil" }, { status: "⌛", text: "Cooling water" }],
    });

    expect(sheet.technicalChecks).toEqual([
      { status: "✅", text: "Engine-oil" },
      { status: "⌛", text: "Cooling water" },
      { status: "⚠️", text: "Bilge alarm" },
    ]);
  });

  it("maps decimal counter readings only to configured engine ids", () => {
    const result = scannerResult({ dateText: "2026-07-01", times: [] });
    result.draft.engineHourCounters = [
      { engineId: "port", start: "123,4", end: "125.1" },
      { engineId: "invented", start: "1", end: "2" },
    ];

    const sheet = createSheet(result, { engineIds: ["port"] });

    expect(sheet.engineHourCounters).toEqual({ port: { start: 123.4, end: 125.1 } });
  });
});

function scannerResult({ dateText, times }: { dateText: string; times: string[] }): ScannerResult {
  return {
    draft: {
      title: "Scanned sheet",
      dateText,
      route: { from: "A", to: "B", departed: "", arrived: "" },
      lines: times.map((time) => ({ time })),
    },
    warnings: [],
  };
}

function createSheet(scannerResult: ScannerResult, options: Partial<Parameters<typeof createScannedSheet>[0]> = {}) {
  return createScannedSheet({
    scannerResult,
    boatId: "boat-1",
    logbook: { boats: [], crewMembers: [], sheets: [] },
    ...options,
  });
}
