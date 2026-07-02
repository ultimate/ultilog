export type CoordinateFormat = "decimal" | "dms";
export type DmsParts = { degrees: string; minutes: string; seconds: string };

const dmsPattern = /^\s*([+-])?(\d+(?:\.\d+)?)\s*(?:°|deg|d)?\s*(?:(\d+(?:\.\d+)?)\s*(?:'|′|m|min)?)?\s*(?:(\d+(?:\.\d+)?)\s*(?:"|″|s|sec)?)?\s*([NSEW])?\s*$/i;

export function decimalToDms(value: number, axis: "lat" | "lon") {
  const direction = value < 0 ? (axis === "lat" ? "S" : "W") : axis === "lat" ? "N" : "E";
  const { degrees, minutes, seconds } = decimalToDmsParts(value);
  return `${Math.abs(Number(degrees))}° ${minutes}' ${Number(seconds).toFixed(2)}\" ${direction}`;
}

export function decimalToDmsParts(value: number): DmsParts {
  if (!Number.isFinite(value)) return { degrees: "", minutes: "", seconds: "" };
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = (minutesFloat - minutes) * 60;
  return { degrees: `${sign}${degrees}`, minutes: String(minutes), seconds: seconds.toFixed(2) };
}

export function dmsPartsToDecimal({ degrees, minutes, seconds }: DmsParts) {
  const parsedDegrees = Number.parseFloat(degrees) || 0;
  const sign = parsedDegrees < 0 ? -1 : 1;
  const absoluteDegrees = Math.abs(parsedDegrees);
  return sign * (absoluteDegrees + (Number.parseFloat(minutes) || 0) / 60 + (Number.parseFloat(seconds) || 0) / 3600);
}

export function coordinateToInput(value: number, axis: "lat" | "lon", format: CoordinateFormat) {
  return format === "dms" ? decimalToDms(value, axis) : String(value);
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
