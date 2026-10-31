import type { LineForm, LogLine, TemperatureUnit, WindUnit } from "../../models/logbook";
import { normalizeCoordinate, parseCoordinate } from "../nautical/coordinates";
import { createLogLineId } from "./log-line-id";

import { parseDecimalInput, parseHourInput } from "../../lib/log-input";
const numberOrZero = (value: string) => parseDecimalInput(value) ?? 0;
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

export function lineFormToLogLine(lineForm: LineForm, options: { scannerDraft?: boolean } = {}): LogLine {
  const coordinate = (value: string, axis: "lat" | "lon") => {
    if (!value.trim()) return null;
    const parsed = parseCoordinate(value);
    if (!Number.isFinite(parsed) || Math.abs(parsed) > (axis === "lat" ? 90 : 180)) {
      if (options.scannerDraft) return null;
      throw new Error("Invalid coordinate");
    }
    return normalizeCoordinate(parsed, axis);
  };
  const engineHours = Object.fromEntries((Object.keys(lineForm.engineHours ?? {}).length ? Object.entries(lineForm.engineHours ?? {}) : [["main-engine", lineForm.motorHours ?? ""]]).map(([engineId, value]) => [engineId, parseHourInput(value)]).filter((entry) => entry[1] !== null));
  return {
    id: lineForm.id || createLogLineId(),
    time: lineForm.time,
    latitude: coordinate(lineForm.latitude, "lat"),
    longitude: coordinate(lineForm.longitude, "lon"),
    weather: lineForm.weather,
    weatherRemark: lineForm.weatherRemark,
    temperature: parseDecimalInput(lineForm.temperature),
    temperatureUnit: normalizeTemperatureUnit(lineForm.temperatureUnit),
    barometer: lineForm.barometer.trim() ? Math.round(parseDecimalInput(lineForm.barometer)!) : null,
    windDirection: lineForm.windDirection,
    windStrength: parseDecimalInput(lineForm.windStrength),
    windUnit: normalizeWindUnit(lineForm.windUnit),
    waves: parseDecimalInput(lineForm.waves),
    seaUnit: lineForm.seaUnit === "ft" ? "ft" : "m",
    tide: parseDecimalInput(lineForm.tide),
    tideUnit: lineForm.tideUnit === "ft" ? "ft" : "m",
    moon: lineForm.moon,
    compassCourse: lineForm.compassCourse.trim() ? bearing(lineForm.compassCourse) : null,
    deviation: lineForm.deviation.trim() ? signedCourse(lineForm.deviation) : null,
    magneticCourse: lineForm.magneticCourse.trim() ? bearing(lineForm.magneticCourse) : null,
    variation: lineForm.variation.trim() ? signedCourse(lineForm.variation) : null,
    trueCourse: lineForm.trueCourse.trim() ? bearing(lineForm.trueCourse) : null,
    windDrift: lineForm.windDrift.trim() ? signedCourse(lineForm.windDrift) : null,
    courseThroughWater: lineForm.courseThroughWater.trim() ? bearing(lineForm.courseThroughWater) : null,
    currentDrift: lineForm.currentDrift.trim() ? signedCourse(lineForm.currentDrift) : null,
    courseOverGround: lineForm.courseOverGround.trim() ? bearing(lineForm.courseOverGround) : null,
    speedKn: parseDecimalInput(lineForm.speedKn),
    logNm: parseDecimalInput(lineForm.logNm),
    sailMiles: parseDecimalInput(lineForm.sailMiles),
    sailNote: lineForm.sailNote,
    motorMiles: parseDecimalInput(lineForm.motorMiles),
    engineHours,
    motorNote: lineForm.motorNote,
    remarks: lineForm.remarks,
  };
}
