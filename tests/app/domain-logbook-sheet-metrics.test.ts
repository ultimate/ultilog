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
});
