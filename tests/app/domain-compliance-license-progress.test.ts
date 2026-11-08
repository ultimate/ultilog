import { describe, expect, it } from "vitest";
import { calculateLicenseProgress, summarizeRequirementProgress } from "../../app/domain/compliance/license-progress";
import { complianceCatalog, type Requirement } from "../../app/domain/compliance/catalog";
import type { Boat, LogSheet } from "../../app/models/logbook";

const requirement = (id: string, type: Requirement["type"], threshold: number, filters: Requirement["filters"] = null) => ({
  id, type, threshold, filters, translationKey: "dashboard.totalMiles", unit: type.includes("miles") ? "nautical-miles" : "days",
}) as Requirement;

function sheet(day: string, sailMiles = 0, motorMiles = 0, moving = false): LogSheet {
  const first = `${day}T08:00:00Z`;
  const last = `${day}T10:00:00Z`;
  return {
    id: `${day}-${sailMiles}-${motorMiles}`, title: "Test", status: "Locked", boatId: "boat", crew: [], technicalChecks: [],
    route: { from: "A", to: "B", departed: first, arrived: last },
    lines: [
      { id: "a", time: first, logNm: 0, latitude: 1, longitude: 1 },
      { id: "b", time: last, logNm: sailMiles + motorMiles, sailMiles, motorMiles, latitude: moving ? 2 : 1, longitude: 1 },
    ],
  } as unknown as LogSheet;
}

describe("calculateLicenseProgress", () => {
  it("combines vessel eligibility and propulsion independently, including archived boats", () => {
    const sailBoat = { id: "sail", type: "sail", archived: true } as Boat;
    const motorBoat = { id: "motor", type: "motor" } as Boat;
    const sheets = [
      { ...sheet("2026-01-01", 6, 4), boatId: "sail" },
      { ...sheet("2026-01-02", 0, 20), boatId: "motor" },
      { ...sheet("2026-01-03", 3, 7), boatId: "missing" },
    ];
    const results = calculateLicenseProgress([
      requirement("sail-boat", "miles", 100, { boatType: "sail" }),
      requirement("motor-boat", "miles", 100, { boatType: "motor" }),
      requirement("sail-propulsion", "miles", 100, { propulsion: "sail" }),
      requirement("motor-on-sail", "miles", 100, { boatType: "sail", propulsion: "motor" }),
      requirement("all", "miles", 100),
      requirement("sail-days", "days-underway", 100, { boatType: "sail" }),
    ], sheets, [], null, new Date("2026-02-01"), [sailBoat, motorBoat]);
    expect(results.map(item => item.achievedValue)).toEqual([10, 20, 9, 4, 40, 1]);
  });

  it("counts Swiss mileage by vessel rather than propulsion for every license", () => {
    const sheets = [{ ...sheet("2026-01-01", 6, 4), boatId: "sail" }];
    const boats = [{ id: "sail", type: "sail" }] as Boat[];
    for (const license of complianceCatalog.licenses.filter(license => license.countryCode === "CH")) {
      for (const req of license.requirements) expect(req.filters?.propulsion).toBeUndefined();
      const miles = license.requirements.filter(req => req.type === "miles");
      expect(miles.length).toBeGreaterThan(0);
      const results = calculateLicenseProgress(miles, sheets, [], null, new Date("2026-02-01"), boats);
      expect(results.map(item => item.achievedValue)).toEqual(miles.map(req => req.filters?.boatType === "sail" ? 10 : 0));
    }
  });

  it("returns zero progress for an empty logbook", () => {
    expect(calculateLicenseProgress([requirement("miles", "miles", 10)], [])[0]).toMatchObject({
      achievedValue: 0, targetValue: 10, remainingValue: 10, percentage: 0, completed: false, automatic: true,
    });
  });

  it("sums mixed sail, motor, and total mileage", () => {
    const results = calculateLicenseProgress([
      requirement("sail", "miles", 10, { propulsion: "sail" }), requirement("motor", "miles", 10, { propulsion: "motor" }), requirement("total", "miles", 10),
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
    expect(calculateLicenseProgress([requirement("miles", "miles", 10)], [sheet("2026-01-01", 10)])[0]).toMatchObject({
      achievedValue: 10, remainingValue: 0, percentage: 100, completed: true,
    });
  });

  it("retains overachievement while bounding only the percentage", () => {
    expect(calculateLicenseProgress([requirement("miles", "miles", 10)], [sheet("2026-01-01", 15)])[0]).toMatchObject({
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
    const qualified = requirement("recent", "miles", 3, { withinYears: 4 });
    const [unsupportedResult, qualifiedResult] = calculateLicenseProgress([unsupported, qualified], [sheet("2026-01-01", 10)]);
    expect(unsupportedResult).toMatchObject({ achievedValue: 0, completed: false, automatic: false, verification: "not-automatically-verifiable" });
    expect(qualifiedResult).toMatchObject({ achievedValue: 10, completed: true, automatic: true, verification: "automatic" });
  });

  it("counts only sheets on or after the selected license start date", () => {
    const result = calculateLicenseProgress([requirement("miles", "miles", 20)], [
      sheet("2026-01-31", 8), sheet("2026-02-01", 6), sheet("2026-02-02", 4),
    ], [], "2026-02-01")[0];
    expect(result).toMatchObject({ achievedValue: 10, remainingValue: 10, percentage: 50 });
  });

  it("tracks compatible propulsion and recency filters instead of hiding existing statistics", () => {
    const filtered = requirement("recent-sail", "miles", 10, { propulsion: "sail", withinYears: 4 });
    const result = calculateLicenseProgress([filtered], [sheet("2025-01-01", 7)], [], null, new Date("2026-08-29T00:00:00Z"))[0];
    expect(result).toMatchObject({ achievedValue: 7, verification: "automatic" });
  });

  it.each(["miles", "days-sailing", "days-underway", "days-at-sea"] as const)("excludes 2026 %s from a four-year window starting in 2021", type => {
    const result = calculateLicenseProgress([requirement("window", type, 10, { withinYears: 4 })],
      [sheet("2026-01-01", 6, 4, true)], [], "2021-01-01", new Date("2026-11-08"))[0];
    expect(result).toMatchObject({ achievedValue: 0, remainingValue: 10, percentage: 0, completed: false });
  });

  it("anchors an inclusive window to the selected date rather than today", () => {
    const result = calculateLicenseProgress([requirement("window", "miles", 100, { withinYears: 4 })], [
      sheet("2020-05-31", 1), sheet("2020-06-01", 2), sheet("2021-01-01", 3),
      sheet("2024-06-01", 4), sheet("2024-06-02", 8),
    ], [], "2020-06-01", new Date("2026-11-08"))[0];
    expect(result.achievedValue).toBe(9);
  });

  it("retains the rolling lookback when no start date is selected", () => {
    const result = calculateLicenseProgress([requirement("window", "miles", 100, { withinYears: 4 })], [
      sheet("2022-11-07", 1), sheet("2022-11-08", 2), sheet("2026-01-01", 3),
    ], [], null, new Date("2026-11-08"))[0];
    expect(result.achievedValue).toBe(5);
  });

  it("clamps leap-day anniversaries and excludes sheets crossing the end date", () => {
    const crossing = sheet("2025-02-28", 8);
    crossing.route.arrived = "2025-03-01T10:00:00Z";
    const result = calculateLicenseProgress([requirement("window", "miles", 100, { withinYears: 1 })], [
      sheet("2025-02-28", 2), sheet("2025-03-01", 4), crossing,
    ], [], "2024-02-29")[0];
    expect(result.achievedValue).toBe(2);
  });

  it("summarizes requirements as fulfilled, in progress, or open", () => {
    const progress = calculateLicenseProgress([
      requirement("fulfilled", "miles", 5),
      requirement("partial", "miles", 20),
      requirement("open", "miles", 10),
      requirement("manual", "manual", 1),
    ], [sheet("2026-01-01", 8)], ["manual"]);
    // Give the open counter no data independently of the shared test sheet.
    progress[2] = calculateLicenseProgress([requirement("open", "miles", 10)], [])[0];
    expect(summarizeRequirementProgress(progress)).toEqual({ fulfilled: 2, inProgress: 1, open: 1, total: 4 });
  });
});
