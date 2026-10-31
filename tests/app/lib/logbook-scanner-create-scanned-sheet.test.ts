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
      "2026-07-02T00:30",
      "2026-07-02T01:00",
      "2026-07-02T23:30",
    ]);
    expect(sheet.scannerWarnings).toEqual([expect.objectContaining({
      id: expect.any(String),
      code: "rolloverExceededEndDate",
    })]);
  });

  it("sorts model rows by time without turning a small backward jump into another day", () => {
    const result = scannerResult({ dateText: "2026-07-01", times: ["12:00", "08:00", "10:00"] });
    result.draft.lines[1].speedKn = "unreadable";
    result.warnings = [{ code: "missingFields", row: 3, fields: ["logNm"] }];
    const sheet = createSheet(result);
    expect(sheet.lines.map(line => line.time)).toEqual(["2026-07-01T08:00", "2026-07-01T10:00", "2026-07-01T12:00"]);
    expect(sheet.scannerWarnings).toEqual([
      expect.objectContaining({ row: 2, fields: ["logNm"] }),
      expect.objectContaining({ row: 1, fields: ["speedKn"] }),
    ]);
    expect(sheet.scannerWarnings?.some(warning => warning.acknowledgedAt)).toBe(false);
  });

  it("sorts a small backward jump after a real midnight rollover on the same inferred day", () => {
    const sheet = createSheet(scannerResult({ dateText: "2026-07-01 - 2026-07-02", times: ["23:00", "01:00", "00:30"] }));
    expect(sheet.lines.map(line => line.time)).toEqual(["2026-07-01T23:00", "2026-07-02T00:30", "2026-07-02T01:00"]);
    expect(sheet.scannerWarnings).toEqual([]);
  });

  it("sorts dated observations by actual time and keeps undated rows at the end", () => {
    const result = scannerResult({ dateText: "", times: ["2026-07-02T10:00:00+00:00", "2026-07-02T11:00:00+02:00", ""] });
    result.draft.lines[2].remarks = "Time illegible";
    const sheet = createSheet(result);
    expect(sheet.lines.map(line => line.time)).toEqual(["2026-07-02T11:00:00+02:00", "2026-07-02T10:00:00+00:00", ""]);
  });

  it("preserves already dated values and time-only values without an extracted master date", () => {
    const dated = createSheet(scannerResult({ dateText: "2026-07-01", times: ["2026-07-02T00:15:00+02:00"] }));
    const undated = createSheet(scannerResult({ dateText: "", times: ["11:30"] }));

    expect(dated.lines[0].time).toBe("2026-07-02T00:15:00+02:00");
    expect(undated.lines[0].time).toBe("11:30");
  });
});

describe("scanned numeric values", () => {
  const fields = ["temperature", "barometer", "windStrength", "waves", "tide", "compassCourse", "deviation", "magneticCourse", "variation", "trueCourse", "windDrift", "courseThroughWater", "currentDrift", "courseOverGround", "speedKn", "logNm", "sailMiles", "motorMiles", "motorHours"] as const;

  it.each(fields)("keeps the draft and warns when %s contains unreadable OCR text", field => {
    const result = scannerResult({ dateText: "2026-07-01", times: ["09:00", "10:00"] });
    result.draft.lines[0] = { time: "09:00", [field]: "unreadable?", remarks: "Keep this row" };
    result.draft.lines[1] = { time: "10:00", speedKn: "5,2", barometer: "1013", temperature: "0" };
    const sheet = createSheet(result);
    expect(sheet.lines).toHaveLength(2);
    expect(field === "motorHours" ? sheet.lines[0].engineHours : sheet.lines[0][field]).toEqual(field === "motorHours" ? {} : null);
    expect(sheet.lines[0].remarks).toBe("Keep this row");
    expect(sheet.lines[1]).toMatchObject({ speedKn: 5.2, barometer: 1013, temperature: 0 });
    expect(sheet.scannerWarnings).toEqual([expect.objectContaining({ code: "scannerGenerated", row: 1, fields: expect.arrayContaining([field]), fallbackMessage: expect.stringContaining('"unreadable?"') })]);
    expect(result.draft.lines[0][field]).toBe("unreadable?");
    expect(result.warnings).toEqual([]);
  });

  it("does not guess numbers from unknown units, ranges, partial numbers, or overflow", () => {
    const result = scannerResult({ dateText: "2026-07-01", times: ["09:00"] });
    result.draft.lines[0] = { time: "09:00", trueCourse: "270 radians", windStrength: "5 unknown", waves: "1-2", barometer: "1013?", logNm: "9".repeat(400), motorHours: "1:75" };
    const sheet = createSheet(result);
    expect(sheet.lines[0]).toMatchObject({ trueCourse: null, windStrength: null, waves: null, barometer: null, logNm: null, engineHours: {} });
    expect(sheet.scannerWarnings).toHaveLength(6);
  });

  it("splits recognized measurement units and removes degree suffixes without warnings", () => {
    const result = scannerResult({ dateText: "2026-07-01", times: ["09:00"] });
    result.draft.lines[0] = { time: "09:00", trueCourse: "270°", deviation: "−2 deg", variation: "+1,5 degrees", windStrength: "5 knots", temperature: "18 °F", waves: "0.5 feet", tide: "-0,4 m", barometer: "1013 hPa", speedKn: "6 kts", logNm: "12 nm", sailMiles: "8 sm", motorMiles: "4 nmi", motorHours: "1:30 h" };
    const sheet = createSheet(result);
    expect(sheet.lines[0]).toMatchObject({ trueCourse: 270, deviation: -2, variation: 2, windStrength: 5, windUnit: "kn", temperature: 18, temperatureUnit: "°F", waves: 0.5, seaUnit: "ft", tide: -0.4, tideUnit: "m", barometer: 1013, speedKn: 6, logNm: 12, sailMiles: 8, motorMiles: 4, engineHours: { "main-engine": 1.5 } });
    expect(sheet.scannerWarnings).toEqual([]);
  });

  it.each(["compassCourse", "deviation", "magneticCourse", "variation", "trueCourse", "windDrift", "courseThroughWater", "currentDrift", "courseOverGround"] as const)("accepts degrees in %s", field => {
    const result = scannerResult({ dateText: "2026-07-01", times: ["09:00"] });
    result.draft.lines[0][field] = "2°";
    const sheet = createSheet(result);
    expect(sheet.lines[0][field]).toBe(2);
    expect(sheet.scannerWarnings).toEqual([]);
  });

  it.each(["25'397", "25’397", "25 397", "25\u202f397"])("preserves a grouped log counter %s and its paired speed", counter => {
    const result = scannerResult({ dateText: "2026-07-01", times: ["09:00", "10:00"] });
    result.draft.lines[0] = { time: "09:00", logNm: counter + " sm", speedKn: "5,8 kn.", courseOverGround: "" };
    result.draft.lines[1] = { time: "10:00", logNm: ".21", speedKn: "0", sailMiles: "", motorMiles: "" };
    const sheet = createSheet(result);
    expect(sheet.lines[0]).toMatchObject({ logNm: 25397, speedKn: 5.8, courseOverGround: null });
    expect(sheet.lines[1]).toMatchObject({ logNm: 0.21, speedKn: 0, sailMiles: null, motorMiles: null });
    expect(sheet.scannerWarnings).toEqual([]);
  });

  it("does not join separate speed/log readings or ranges into a number", () => {
    const result = scannerResult({ dateText: "2026-07-01", times: ["09:00"] });
    result.draft.lines[0] = { time: "09:00", speedKn: "5 8", logNm: "25 39", sailMiles: "1-2" };
    const sheet = createSheet(result);
    expect(sheet.lines[0]).toMatchObject({ speedKn: null, logNm: null, sailMiles: null });
    expect(sheet.scannerWarnings).toHaveLength(3);
  });

  it("canonicalizes separate units and flags conflicts instead of changing their meaning", () => {
    const result = scannerResult({ dateText: "2026-07-01", times: ["09:00", "10:00"] });
    result.draft.lines[0] = { time: "09:00", windStrength: "5 kt", windUnit: "knots", temperature: "18 °F", temperatureUnit: "f" };
    result.draft.lines[1] = { time: "10:00", windStrength: "5 kn", windUnit: "bft", speedKn: "6 km/h" };
    const sheet = createSheet(result);
    expect(sheet.lines[0]).toMatchObject({ windStrength: 5, windUnit: "kn", temperature: 18, temperatureUnit: "°F" });
    expect(sheet.lines[1]).toMatchObject({ windStrength: null, speedKn: null });
    expect(sheet.scannerWarnings).toEqual([
      expect.objectContaining({ row: 2, fields: ["windStrength", "windUnit"], fallbackMessage: expect.stringContaining("5 kn") }),
      expect.objectContaining({ row: 2, fields: ["speedKn"], fallbackMessage: expect.stringContaining("6 km/h") }),
    ]);
  });

  it("preserves blanks, zero, decimal commas, signed corrections and engine durations", () => {
    const result = scannerResult({ dateText: "2026-07-01", times: ["09:00", "10:00"] });
    result.draft.lines[0] = { time: "09:00", temperature: " ", barometer: "", speedKn: "0", tide: "-0,5", deviation: "-2", motorHours: "1:30" };
    result.draft.lines[1] = { time: "10:00", motorHours: "-1" };
    const sheet = createSheet(result);
    expect(sheet.lines[0]).toMatchObject({ temperature: null, barometer: null, speedKn: 0, tide: -0.5, deviation: -2, engineHours: { "main-engine": 1.5 } });
    expect(sheet.lines[1].engineHours).toEqual({});
    expect(sheet.scannerWarnings).toEqual([expect.objectContaining({ row: 2, fields: ["motorHours"] })]);
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
