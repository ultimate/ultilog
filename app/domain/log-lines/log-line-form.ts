import type { LineForm, LogLine, TemperatureUnit, WindUnit } from "../../models/logbook";
import { normalizeCoordinate, parseCoordinate } from "../nautical/coordinates";

const numberOrZero = (value: string) => Number.parseFloat(value) || 0;
const supportedWindUnits = new Set<WindUnit>(["bft", "kn", "km/h", "mp/h", "m/s"]);
const supportedTemperatureUnits = new Set<TemperatureUnit>(["c", "f", "°C", "°F"]);

function normalizeWindUnit(value: string): WindUnit {
  return supportedWindUnits.has(value as WindUnit) ? value as WindUnit : "bft";
}

function normalizeTemperatureUnit(value: string): TemperatureUnit {
  return supportedTemperatureUnits.has(value as TemperatureUnit) ? value as TemperatureUnit : "°C";
}

export function clampInt(value: string, min: number, max: number) {
  const parsed = Math.round(numberOrZero(value));
  return Math.min(Math.max(parsed, min), max);
}

export function bearing(value: string) {
  return clampInt(value, 0, 359);
}

export function signedCourse(value: string) {
  return clampInt(value, -180, 180);
}

export function lineFormToLogLine(lineForm: LineForm): LogLine {
  return {
    time: lineForm.time,
    position: lineForm.position,
    latitude: normalizeCoordinate(parseCoordinate(lineForm.latitude), "lat"),
    longitude: normalizeCoordinate(parseCoordinate(lineForm.longitude), "lon"),
    weather: lineForm.weather,
    weatherRemark: lineForm.weatherRemark,
    temperature: numberOrZero(lineForm.temperature),
    temperatureUnit: normalizeTemperatureUnit(lineForm.temperatureUnit),
    barometer: clampInt(lineForm.barometer, 800, 1200),
    windDirection: lineForm.windDirection,
    windStrength: numberOrZero(lineForm.windStrength),
    windUnit: normalizeWindUnit(lineForm.windUnit),
    waves: numberOrZero(lineForm.waves),
    seaUnit: lineForm.seaUnit === "ft" ? "ft" : "m",
    tide: numberOrZero(lineForm.tide),
    tideUnit: lineForm.tideUnit === "ft" ? "ft" : "m",
    moon: lineForm.moon,
    compassCourse: bearing(lineForm.compassCourse),
    deviation: signedCourse(lineForm.deviation),
    magneticCourse: bearing(lineForm.magneticCourse),
    variation: signedCourse(lineForm.variation),
    trueCourse: bearing(lineForm.trueCourse),
    windDrift: signedCourse(lineForm.windDrift),
    courseThroughWater: bearing(lineForm.courseThroughWater),
    currentDrift: signedCourse(lineForm.currentDrift),
    courseOverGround: bearing(lineForm.courseOverGround),
    speedKn: numberOrZero(lineForm.speedKn),
    logNm: numberOrZero(lineForm.logNm),
    sailMiles: numberOrZero(lineForm.sailMiles),
    sailNote: lineForm.sailNote,
    motorMiles: numberOrZero(lineForm.motorMiles),
    motorHours: numberOrZero(lineForm.motorHours),
    motorNote: lineForm.motorNote,
    remarks: lineForm.remarks,
  };
}
