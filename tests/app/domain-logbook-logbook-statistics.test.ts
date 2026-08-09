import { describe, expect, it } from "vitest";
import { calculateLogbookDayStatistics } from "../../app/domain/logbook/logbook-statistics";
import type { LogLine, LogSheet } from "../../app/models/logbook";

describe("calculateLogbookDayStatistics", () => {
  it("counts a single-day sheet once", () => {
    expect(calculateLogbookDayStatistics([sheet("2026-06-01T08:00:00+02:00", "2026-06-01T18:00:00+02:00")])).toEqual({ sailingDays: 1, daysAtSea: 0 });
  });

  it("includes every day in a multi-day route, including rest days", () => {
    expect(calculateLogbookDayStatistics([sheet("2026-06-01T08:00:00+02:00", "2026-06-04T18:00:00+02:00")])).toEqual({ sailingDays: 4, daysAtSea: 0 });
  });

  it("counts only route days containing motion", () => {
    const voyage = sheet("2026-06-01T08:00:00Z", "2026-06-03T18:00:00Z", [
      line("2026-06-01T08:00:00Z", 0), line("2026-06-01T09:00:00Z", 2),
      line("2026-06-03T08:00:00Z", 2), line("2026-06-03T09:00:00Z", 4),
    ]);
    expect(calculateLogbookDayStatistics([voyage])).toEqual({ sailingDays: 3, daysAtSea: 2 });
  });

  it("deduplicates same-day and overlapping sheets", () => {
    const sheets = [
      sheet("2026-06-01T08:00:00Z", "2026-06-03T18:00:00Z"),
      sheet("2026-06-02T08:00:00Z", "2026-06-04T18:00:00Z"),
      sheet("2026-06-04T19:00:00Z", "2026-06-04T20:00:00Z"),
    ];
    expect(calculateLogbookDayStatistics(sheets).sailingDays).toBe(4);
  });

  it("counts both dates when a motion interval crosses midnight", () => {
    const voyage = sheet("2026-06-01T20:00:00Z", "2026-06-02T02:00:00Z", [line("2026-06-01T23:50:00Z", 0), line("2026-06-02T00:10:00Z", 2)]);
    expect(calculateLogbookDayStatistics([voyage]).daysAtSea).toBe(2);
  });

  it("uses encoded local dates instead of shifting near-midnight offsets to UTC", () => {
    const voyage = sheet("2026-06-02T00:10:00+02:00", "2026-06-02T01:10:00+02:00", [line("2026-06-02T00:10:00+02:00", 0), line("2026-06-02T01:10:00+02:00", 2)]);
    expect(calculateLogbookDayStatistics([voyage])).toEqual({ sailingDays: 1, daysAtSea: 1 });
  });

  it("sorts unsorted log lines before classifying motion", () => {
    const voyage = sheet("2026-06-01T08:00:00Z", "2026-06-01T10:00:00Z", [line("2026-06-01T10:00:00Z", 3), line("2026-06-01T08:00:00Z", 0)]);
    expect(calculateLogbookDayStatistics([voyage]).daysAtSea).toBe(1);
  });

  it("falls back to absolute line dates for incomplete routes and ignores undated lines", () => {
    const dated = sheet("", "", [line("09:00", 0), line("2026-06-03T10:00:00Z", 1)]);
    expect(calculateLogbookDayStatistics([dated])).toEqual({ sailingDays: 1, daysAtSea: 0 });
  });

  it("does not count stationary sheets as days at sea", () => {
    const voyage = sheet("2026-06-01T08:00:00Z", "2026-06-01T10:00:00Z", [line("2026-06-01T08:00:00Z", 0), line("2026-06-01T10:00:00Z", 0)]);
    expect(calculateLogbookDayStatistics([voyage], 0.1).daysAtSea).toBe(0);
  });
});

function sheet(departed: string, arrived: string, lines: LogLine[] = []): LogSheet {
  return { id: `${departed}-${arrived}`, title: "Test", status: "Draft", boatId: "boat", route: { from: "A", to: "B", departed, arrived }, crew: [], watchPlan: [], technicalChecks: [], lines };
}

function line(time: string, logNm: number): LogLine {
  return { time, logNm, latitude: 54, longitude: 10, position: "", weather: "", weatherRemark: "", temperature: 0, temperatureUnit: "°C", barometer: 0, windDirection: "", windStrength: 0, windUnit: "kn", waves: 0, seaUnit: "m", tide: 0, tideUnit: "m", moon: "", compassCourse: 0, deviation: 0, magneticCourse: 0, variation: 0, trueCourse: 0, windDrift: 0, courseThroughWater: 0, currentDrift: 0, courseOverGround: 0, speedKn: 0, sailMiles: 0, sailNote: "", motorMiles: 0, motorHours: 0, motorNote: "", remarks: "" };
}
