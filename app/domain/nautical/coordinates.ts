export type CoordinateFormat = "decimal" | "dms";
export type CoordinateAxis = "lat" | "lon";
export type DmsParts = { degrees: string; minutes: string; seconds: string };

const dmsPattern = /^\s*([+-])?(\d+(?:\.\d+)?)\s*(?:°|deg|d)?\s*(?:(\d+(?:\.\d+)?)\s*(?:'|′|m|min)?)?\s*(?:(\d+(?:\.\d+)?)\s*(?:"|″|s|sec)?)?\s*([NSEW])?\s*$/i;

export function decimalToDms(value: number, axis: CoordinateAxis) {
  const direction = value < 0 ? (axis === "lat" ? "S" : "W") : axis === "lat" ? "N" : "E";
  const { degrees, minutes, seconds } = decimalToDmsParts(value);
  return `${Math.abs(Number(degrees))}° ${minutes}' ${Number(seconds).toFixed(2)}\" ${direction}`;
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
  const parsedDegrees = Number.parseFloat(degrees) || 0;
  const sign = parsedDegrees < 0 ? -1 : 1;
  const absoluteDegrees = Math.abs(parsedDegrees);
  return sign * (absoluteDegrees + (Number.parseFloat(minutes) || 0) / 60 + (Number.parseFloat(seconds) || 0) / 3600);
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

export function coordinateToInput(value: number, axis: CoordinateAxis, format: CoordinateFormat) {
  const normalized = normalizeCoordinate(value, axis);
  return format === "dms" ? decimalToDms(normalized, axis) : normalized.toFixed(5);
}

export function parseCoordinate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const decimal = Number.parseFloat(trimmed);
  if (Number.isFinite(decimal) && /^\s*[+-]?\d+(?:\.\d+)?\s*$/.test(trimmed)) return decimal;
  const match = trimmed.match(dmsPattern);
  if (!match) return 0;
  const [, sign, deg, min = "0", sec = "0", hemisphere] = match;
  const absolute = Number(deg) + Number(min) / 60 + Number(sec) / 3600;
  const negative = sign === "-" || /[SW]/i.test(hemisphere ?? "");
  return negative ? -absolute : absolute;
}
