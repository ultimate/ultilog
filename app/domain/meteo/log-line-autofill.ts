import type { LineForm, LineFormField, TemperatureUnit, WindUnit } from "../../models/logbook";
import type { MeteoSnapshot } from "./types";
import { createMeteoSourceRemarkParts, type MeteoSourceRemarkPart } from "./remarks";

export type MeteoLogLineAutofillOptions = {
  windUnit?: WindUnit;
  seaUnit?: "m" | "ft";
  tideUnit?: "m" | "ft";
  temperatureUnit?: TemperatureUnit;
};

export type MeteoLogLineAutofill = {
  fields: Partial<LineForm>;
  remarkParts: MeteoSourceRemarkPart[];
};

export function meteoSnapshotToLogLineAutofill(
  snapshot: MeteoSnapshot,
  options: MeteoLogLineAutofillOptions = {},
): MeteoLogLineAutofill {
  const windUnit = options.windUnit ?? "bft";
  const seaUnit = options.seaUnit ?? "m";
  const tideUnit = options.tideUnit ?? "m";
  const temperatureUnit = options.temperatureUnit ?? "°C";
  const fields: Partial<LineForm> = {};

  setField(fields, "weather", weatherSymbol(snapshot.weather?.condition?.value, snapshot.weather?.cloudCoverPercent?.value));
  setField(fields, "temperature", convertTemperature(snapshot.weather?.temperatureC?.value, temperatureUnit));
  setField(fields, "temperatureUnit", temperatureUnit);
  setField(fields, "barometer", rounded(snapshot.weather?.pressureHpa?.value));
  setField(fields, "windDirection", compassDirection(snapshot.wind?.directionDeg?.value));
  setField(fields, "windStrength", convertWind(snapshot.wind?.speedKnots?.value, windUnit));
  setField(fields, "windUnit", windUnit);
  setField(fields, "waves", convertDistance(snapshot.sea?.waveHeightM?.value, seaUnit));
  setField(fields, "seaUnit", seaUnit);
  setField(fields, "tide", convertDistance(snapshot.tide?.heightM?.value, tideUnit));
  setField(fields, "tideUnit", tideUnit);
  setField(fields, "moon", moonSymbol(snapshot.astronomy?.moonPhase?.value));

  return { fields, remarkParts: createMeteoSourceRemarkParts(snapshot) };
}

function setField<TField extends LineFormField>(fields: Partial<LineForm>, field: TField, value: string | number | undefined) {
  if (value !== undefined && value !== "") fields[field] = String(value);
}

function rounded(value: number | undefined) {
  return value === undefined ? undefined : Math.round(value);
}

function convertTemperature(valueC: number | undefined, unit: TemperatureUnit) {
  if (valueC === undefined) return undefined;
  const value = unit === "f" || unit === "°F" ? (valueC * 9) / 5 + 32 : valueC;
  return Math.round(value);
}

function convertWind(valueKnots: number | undefined, unit: WindUnit) {
  if (valueKnots === undefined) return undefined;
  switch (unit) {
    case "bft":
      return knotsToBeaufort(valueKnots);
    case "km/h":
      return roundOne(valueKnots * 1.852);
    case "mp/h":
      return roundOne(valueKnots * 1.150779448);
    case "m/s":
      return roundOne(valueKnots * 0.514444444);
    case "kn":
      return roundOne(valueKnots);
  }
}

function convertDistance(valueM: number | undefined, unit: "m" | "ft") {
  if (valueM === undefined) return undefined;
  return roundOne(unit === "ft" ? valueM * 3.280839895 : valueM);
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function compassDirection(degrees: number | undefined) {
  if (degrees === undefined) return undefined;
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round((((degrees % 360) + 360) % 360) / 45) % directions.length];
}

function knotsToBeaufort(knots: number) {
  const thresholds = [1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64];
  const force = thresholds.findIndex((threshold) => knots < threshold);
  return force === -1 ? 12 : force;
}

function weatherSymbol(condition: string | undefined, cloudCoverPercent: number | undefined) {
  const normalized = condition?.toLowerCase() ?? "";
  if (normalized.includes("thunder")) return "⛈️";
  if (normalized.includes("snow")) return "🌨️";
  if (normalized.includes("rain") || normalized.includes("drizzle") || normalized.includes("shower")) return "🌦️";
  if (normalized.includes("fog") || normalized.includes("mist")) return "🌫️";
  if (cloudCoverPercent !== undefined) {
    if (cloudCoverPercent < 15) return "☀️";
    if (cloudCoverPercent < 50) return "🌤️";
    if (cloudCoverPercent < 85) return "⛅";
    return "☁️";
  }
  return condition ? "⛅" : undefined;
}

function moonSymbol(phase: string | undefined) {
  switch (phase) {
    case "new moon":
      return "🌑";
    case "waxing crescent":
      return "🌒";
    case "first quarter":
      return "🌓";
    case "waxing gibbous":
      return "🌔";
    case "full moon":
      return "🌕";
    case "waning gibbous":
      return "🌖";
    case "last quarter":
      return "🌗";
    case "waning crescent":
      return "🌘";
    default:
      return undefined;
  }
}
