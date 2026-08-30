import { describe, expect, it } from "vitest";
import { calculateLicenseProgress } from "../../app/domain/compliance/license-progress";
import type { Requirement } from "../../app/domain/compliance/catalog";
import type { LogSheet } from "../../app/models/logbook";

const requirement = (id: string, type: Requirement["type"], threshold: number, filters: Requirement["filters"] = null) => ({
  id, type, threshold, filters, translationKey: "dashboard.totalMiles", unit: type.includes("miles") ? "nautical-miles" : "days",
}) as Requirement;

function sheet(day: string, sailMiles = 0, motorMiles = 0, moving = false): LogSheet {
  const first = `${day}T08:00:00Z`;
  const last = `${day}T10:00:00Z`;
  return {
    id: `${day}-${sailMiles}-${motorMiles}`, title: "Test", status: "Locked", boatId: "boat", crew: [], watchPlan: [], technicalChecks: [],
    route: { from: "A", to: "B", departed: first, arrived: last },
    lines: [
      { id: "a", time: first, logNm: 0, latitude: 1, longitude: 1 },
      { id: "b", time: last, logNm: sailMiles + motorMiles, sailMiles, motorMiles, latitude: moving ? 2 : 1, longitude: 1 },
    ],
  } as unknown as LogSheet;
}

describe("calculateLicenseProgress", () => {
  it("returns zero progress for an empty logbook", () => {
    expect(calculateLicenseProgress([requirement("miles", "total-miles", 10)], [])[0]).toMatchObject({
      achievedValue: 0, targetValue: 10, remainingValue: 10, percentage: 0, completed: false, automatic: true,
    });
  });

  it("sums mixed sail, motor, and total mileage", () => {
    const results = calculateLicenseProgress([
      requirement("sail", "sail-miles", 10), requirement("motor", "motor-miles", 10), requirement("total", "total-miles", 10),
    ], [sheet("2026-01-01", 6, 4), sheet("2026-01-02", 3, 2)]);
    expect(results.map(({ achievedValue }) => achievedValue)).toEqual([9, 6, 15]);
  });

  it("deduplicates calendar days across sheets", () => {
    const result = calculateLicenseProgress([requirement("days", "days-sailing", 2)], [sheet("2026-01-01"), sheet("2026-01-01")])[0];
    expect(result.achievedValue).toBe(1);
  });

  it("keeps sailing days distinct from days with motion at sea", () => {
    const results = calculateLicenseProgress([
      requirement("sailing", "days-underway", 2), requirement("sea", "days-at-sea", 2),
    ], [sheet("2026-01-01"), sheet("2026-01-02", 1, 0, true)]);
    expect(results.map(({ achievedValue }) => achievedValue)).toEqual([2, 1]);
  });

  it("completes at the exact threshold", () => {
    expect(calculateLicenseProgress([requirement("miles", "total-miles", 10)], [sheet("2026-01-01", 10)])[0]).toMatchObject({
      achievedValue: 10, remainingValue: 0, percentage: 100, completed: true,
    });
  });

  it("retains overachievement while bounding only the percentage", () => {
    expect(calculateLicenseProgress([requirement("miles", "total-miles", 10)], [sheet("2026-01-01", 15)])[0]).toMatchObject({
      achievedValue: 15, remainingValue: 0, percentage: 100, completed: true,
    });
  });

  it("uses persisted completion only for manual requirements", () => {
    expect(calculateLicenseProgress([requirement("exam", "manual", 1)], [], ["exam"])[0]).toMatchObject({
      achievedValue: 1, completed: true, automatic: false, verification: "manual",
    });
  });

  it("does not claim unsupported types or qualified counters", () => {
    const unsupported = requirement("unknown", "voyages" as Requirement["type"], 3);
    const qualified = requirement("recent", "total-miles", 3, { withinYears: 4 });
    const [unsupportedResult, qualifiedResult] = calculateLicenseProgress([unsupported, qualified], [sheet("2026-01-01", 10)]);
    expect(unsupportedResult).toMatchObject({ achievedValue: 0, completed: false, automatic: false, verification: "not-automatically-verifiable" });
    expect(qualifiedResult).toMatchObject({ achievedValue: 10, completed: true, automatic: true, verification: "automatic" });
  });

  it("counts only sheets on or after the selected license start date", () => {
    const result = calculateLicenseProgress([requirement("miles", "total-miles", 20)], [
      sheet("2026-01-31", 8), sheet("2026-02-01", 6), sheet("2026-02-02", 4),
    ], [], "2026-02-01")[0];
    expect(result).toMatchObject({ achievedValue: 10, remainingValue: 10, percentage: 50 });
  });

  it("tracks compatible propulsion and recency filters instead of hiding existing statistics", () => {
    const filtered = requirement("recent-sail", "sail-miles", 10, { propulsion: "sail", withinYears: 4 });
    const result = calculateLicenseProgress([filtered], [sheet("2025-01-01", 7)], [], null, new Date("2026-08-29T00:00:00Z"))[0];
    expect(result).toMatchObject({ achievedValue: 7, verification: "automatic" });
  });
});
