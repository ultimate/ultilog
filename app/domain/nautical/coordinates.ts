import { decimalSeparator, parseDecimalInput } from "../../lib/log-input";
export type CoordinateFormat = "decimal" | "ddm" | "dms";
export type CoordinateAxis = "lat" | "lon";
export type DmsParts = { degrees: string; minutes: string; seconds: string };
export type DdmParts = Omit<DmsParts, "seconds">;

export function nextCoordinateFormat(format: CoordinateFormat): CoordinateFormat {
  if (format === "decimal") return "ddm";
  return format === "ddm" ? "dms" : "decimal";
}

const dmsPattern = /^\s*([NSEW])?\s*([+-])?(\d+(?:\.\d+)?)\s*(?:°|deg|d)?\s*(?:(\d+(?:\.\d+)?)\s*(?:'|′|m|min)?)?\s*(?:(\d+(?:\.\d+)?)\s*(?:"|″|s|sec)?)?\s*([NSEW])?\s*$/i;

export function decimalToDms(value: number, axis: CoordinateAxis) {
  const direction = value < 0 ? (axis === "lat" ? "S" : "W") : axis === "lat" ? "N" : "E";
  const { degrees, minutes, seconds } = decimalToDmsParts(value);
  return `${Math.abs(Number(degrees))}° ${minutes}' ${Number(seconds).toFixed(2)}\" ${direction}`;
}

export function decimalToDdm(value: number, axis: CoordinateAxis) {
  const direction = value < 0 ? (axis === "lat" ? "S" : "W") : axis === "lat" ? "N" : "E";
  const { degrees, minutes } = decimalToDdmParts(value);
  return `${Math.abs(Number(degrees))}° ${minutes}' ${direction}`;
}

export function decimalToDdmParts(value: number): DdmParts {
  if (!Number.isFinite(value)) return { degrees: "", minutes: "" };
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  let degrees = Math.floor(absolute);
  let minutes = (absolute - degrees) * 60;

  if (Number(minutes.toFixed(4)) >= 60) {
    minutes = 0;
    degrees += 1;
  }

  return { degrees: `${sign}${degrees}`, minutes: minutes.toFixed(4) };
}

export function decimalToDmsParts(value: number): DmsParts {
  if (!Number.isFinite(value)) return { degrees: "", minutes: "", seconds: "" };
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  let degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  let minutes = Math.floor(minutesFloat);
  let seconds = (minutesFloat - minutes) * 60;

  if (Number(seconds.toFixed(2)) >= 60) {
    seconds = 0;
    minutes += 1;
  }
  if (minutes >= 60) {
    minutes = 0;
    degrees += 1;
  }

  return { degrees: `${sign}${degrees}`, minutes: String(minutes), seconds: seconds.toFixed(2) };
}

export function dmsPartsToDecimal({ degrees, minutes, seconds }: DmsParts) {
  const parsedDegrees = parseDecimalInput(degrees) ?? 0;
  const sign = degrees.trim().startsWith("-") ? -1 : 1;
  const absoluteDegrees = Math.abs(parsedDegrees);
  return sign * (absoluteDegrees + (parseDecimalInput(minutes) ?? 0) / 60 + (parseDecimalInput(seconds) ?? 0) / 3600);
}

export function ddmPartsToDecimal({ degrees, minutes }: DdmParts) {
  return dmsPartsToDecimal({ degrees, minutes, seconds: "0" });
}

export function normalizeCoordinate(value: number, axis: CoordinateAxis) {
  return axis === "lat" ? normalizeLatitude(value) : normalizeLongitude(value);
}

export function normalizeLatitude(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, -90), 90);
}

export function normalizeLongitude(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value >= -180 && value <= 180) return value;
  return ((((value + 180) % 360) + 360) % 360) - 180;
}

export function coordinateToInput(value: number | null, axis: CoordinateAxis, format: CoordinateFormat, locale?: Intl.LocalesArgument) {
  if (value === null) return "";
  const normalized = normalizeCoordinate(value, axis);
  const formatted = format === "ddm" ? decimalToDdm(normalized, axis) : format === "dms" ? decimalToDms(normalized, axis) : normalized.toFixed(5);
  return locale ? formatted.replace(/\./g, decimalSeparator(locale)) : formatted;
}

export function parseCoordinate(value: string) {
  const trimmed = value.trim().replace(/,/g, ".");
  if (!trimmed) return 0;
  try {
    const decimal = parseDecimalInput(trimmed);
    if (decimal !== null) return decimal;
  } catch { /* Try a coordinate with degree/minute/second notation below. */ }
  const match = trimmed.match(dmsPattern);
  if (!match) return Number.NaN;
  const [, leadingHemisphere, sign, deg, min = "0", sec = "0", trailingHemisphere] = match;
  const hemisphere = leadingHemisphere || trailingHemisphere;
  if (Number(min) >= 60 || Number(sec) >= 60) return Number.NaN;
  const absolute = Number(deg) + Number(min) / 60 + Number(sec) / 3600;
  const negative = sign === "-" || /[SW]/i.test(hemisphere ?? "");
  return negative ? -absolute : absolute;
}
