import { describe, expect, it } from "vitest";
import { lineFormToLogLine } from "../../../../app/domain/log-lines/log-line-form";
import type { LineForm } from "../../../../app/models/logbook";

const baseLineForm: LineForm = {
  time: "2026-07-03T10:15",
  position: "Off Point",
  latitude: "47° 30.000' N",
  longitude: "122° 20.000' W",
  weather: "☀️",
  weatherRemark: "Clear horizon",
  temperature: "18.5",
  temperatureUnit: "°F",
  barometer: "1013.6",
  windDirection: "NW",
  windStrength: "12.5",
  windUnit: "kn",
  waves: "1.2",
  seaUnit: "ft",
  tide: "-0.4",
  tideUnit: "ft",
  moon: "🌗",
  compassCourse: "361",
  deviation: "-181",
  magneticCourse: "44.6",
  variation: "181",
  trueCourse: "bad",
  windDrift: "7.4",
  courseThroughWater: "183.5",
  currentDrift: "-2.6",
  courseOverGround: "270.2",
  speedKn: "6.7",
  logNm: "12.3",
  sailMiles: "8.1",
  sailNote: "Reefed main",
  motorMiles: "4.2",
  motorHours: "1.5",
  motorNote: "Charging",
  remarks: "Scanned row",
};

describe("lineFormToLogLine", () => {
  it("normalizes scanned and manual line form values into persisted log lines", () => {
    expect(lineFormToLogLine(baseLineForm)).toEqual({
      time: "2026-07-03T10:15",
      position: "Off Point",
      latitude: 47.5,
      longitude: -122.33333333333333,
      weather: "☀️",
      weatherRemark: "Clear horizon",
      temperature: 18.5,
      temperatureUnit: "°F",
      barometer: 1014,
      windDirection: "NW",
      windStrength: 12.5,
      windUnit: "kn",
      waves: 1.2,
      seaUnit: "ft",
      tide: -0.4,
      tideUnit: "ft",
      moon: "🌗",
      compassCourse: 359,
      deviation: -180,
      magneticCourse: 45,
      variation: 180,
      trueCourse: 0,
      windDrift: 7,
      courseThroughWater: 184,
      currentDrift: -3,
      courseOverGround: 270,
      speedKn: 6.7,
      logNm: 12.3,
      sailMiles: 8.1,
      sailNote: "Reefed main",
      motorMiles: 4.2,
      motorHours: 1.5,
      motorNote: "Charging",
      remarks: "Scanned row",
    });
  });

  it("falls back to default units and zeroed numeric values for invalid optional values", () => {
    expect(lineFormToLogLine({ ...baseLineForm, windUnit: "mph" as LineForm["windUnit"], temperatureUnit: "kelvin" as LineForm["temperatureUnit"], seaUnit: "yd" as LineForm["seaUnit"], tideUnit: "yd" as LineForm["tideUnit"], speedKn: "", barometer: "" })).toMatchObject({
      barometer: 800,
      windUnit: "bft",
      temperatureUnit: "°C",
      seaUnit: "m",
      tideUnit: "m",
      speedKn: 0,
    });
  });
});
