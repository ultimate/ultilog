import { describe, expect, it } from "vitest";
import { calculateLogSheetMetrics } from "../../app/domain/logbook/sheet-metrics";
import type { LogLine } from "../../app/models/logbook";

const baseLine: LogLine = {
  time: "00:00",
  position: "",
  latitude: 0,
  longitude: 0,
  weather: "",
  weatherRemark: "",
  temperature: 0,
  temperatureUnit: "°C",
  barometer: 0,
  windDirection: "",
  windStrength: 0,
  windUnit: "bft",
  waves: 0,
  seaUnit: "m",
  tide: 0,
  tideUnit: "m",
  moon: "",
  compassCourse: 0,
  deviation: 0,
  magneticCourse: 0,
  variation: 0,
  trueCourse: 0,
  windDrift: 0,
  courseThroughWater: 0,
  currentDrift: 0,
  courseOverGround: 0,
  speedKn: 0,
  logNm: 0,
  sailMiles: 0,
  sailNote: "",
  motorMiles: 0,
  motorHours: 0,
  motorNote: "",
  remarks: "",
};

describe("calculateLogSheetMetrics", () => {
  it("calculates route, motion, and motor durations independently", () => {
    const metrics = calculateLogSheetMetrics([
      { ...baseLine, time: "10:00", latitude: 47, longitude: 8, logNm: 5, motorHours: 1.25 },
      { ...baseLine, time: "09:00", latitude: 47, longitude: 8, logNm: 0 },
      { ...baseLine, time: "09:30", latitude: 47.0001, longitude: 8.0001, logNm: 0, motorHours: 0.5 },
      { ...baseLine, time: "11:00", latitude: 47.2, longitude: 8.2, logNm: 11 },
    ], { from: "A", to: "B", departed: "2026-07-22, 08:30", arrived: "2026-07-22, 12:00" });

    expect(metrics.motorHours).toBe(1.75);
    expect(metrics.overallDurationMinutes).toBe(210);
    expect(metrics.durationMinutes).toBe(210);
    expect(metrics.motionDurationMinutes).toBe(90);
    expect(metrics.totalMiles).toBe(11);
  });

  it("calculates motion deltas from full ISO timestamps", () => {
    const metrics = calculateLogSheetMetrics([
      { ...baseLine, time: "2026-07-22T12:31", latitude: 0, longitude: 0, logNm: 0 },
      { ...baseLine, time: "2026-07-22T13:31", latitude: 0, longitude: 1 / 60, logNm: 1 },
      { ...baseLine, time: "2026-07-22T14:02", latitude: 0, longitude: 1.5 / 60, logNm: 1.5 },
      { ...baseLine, time: "2026-07-22T16:22", latitude: 0, longitude: 6.5 / 60, logNm: 6.5 },
      { ...baseLine, time: "2026-07-22T16:40", latitude: 0, longitude: 6.58 / 60, logNm: 6.5 },
      { ...baseLine, time: "2026-07-22T16:50", latitude: 0, longitude: 6.67 / 60, logNm: 7 },
      { ...baseLine, time: "2026-07-22T17:45", latitude: 0, longitude: 8 / 60, logNm: 7 },
    ]);

    expect(metrics.motionDurationMinutes).toBe(296);
  });

  it("uses a configurable stationary distance threshold for motion time", () => {
    const lines = [
      { ...baseLine, time: "09:00", latitude: 47, longitude: 8, logNm: 0 },
      { ...baseLine, time: "10:00", latitude: 47.002, longitude: 8, logNm: 0 },
    ];

    expect(calculateLogSheetMetrics(lines, undefined, { stationaryDistanceThresholdNm: 0.1 }).motionDurationMinutes).toBe(60);
    expect(calculateLogSheetMetrics(lines, undefined, { stationaryDistanceThresholdNm: 1 }).motionDurationMinutes).toBe(0);
  });

  it("sums engine-hours without double-counting simultaneous propulsion duration", () => {
    const metrics = calculateLogSheetMetrics([
      { ...baseLine, engineHours: { port: 1, starboard: 1 }, motorHours: 2 },
      { ...baseLine, time: "01:00", engineHours: { port: 0.5 }, motorHours: 0.5 },
    ]);

    expect(metrics.engineHours).toEqual({ port: 1.5, starboard: 1 });
    expect(metrics.motorHours).toBe(2.5);
    expect(metrics.propulsionDurationMinutes).toBe(90);
  });
});
