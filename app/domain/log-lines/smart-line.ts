import type { LineForm, LogLine, LogSheet } from "../../models/logbook";
import { calculateGlobeDistanceNm } from "../nautical/globe-distance";

type Coordinate = { latitude: number; longitude: number };
export type TimedCoordinate = Coordinate & { timestamp: number };

export function calculateSmartNavigationFields(lines: LogLine[], coordinate: Coordinate): Partial<LineForm> {
  const previous = [...lines].filter(hasCoordinates).sort((a, b) => Date.parse(a.time) - Date.parse(b.time)).at(-1);
  if (!previous) return {};

  const distance = calculateGlobeDistanceNm(previous, coordinate);
  const previousLog = Number.isFinite(previous.logNm) ? previous.logNm : 0;
  return { logNm: formatDecimal(previousLog + distance) };
}

export function calculateTrackedMotionFields(from: TimedCoordinate, to: TimedCoordinate, minimumSpeedKn = 1): Partial<LineForm> {
  const elapsedHours = (to.timestamp - from.timestamp) / 3_600_000;
  if (elapsedHours <= 0) return {};
  const speedKn = calculateGlobeDistanceNm(from, to) / elapsedHours;
  if (speedKn < minimumSpeedKn) return {};
  return {
    courseOverGround: String(Math.round(initialBearing(from, to)) % 360),
    speedKn: formatDecimal(speedKn),
  };
}

export function previousSheetLogMiles(sheets: LogSheet[], activeSheet: LogSheet): string {
  if (activeSheet.lines.length) return "";
  const activeStart = sheetStart(activeSheet);
  const previous = sheets
    .filter((sheet) => sheet.id !== activeSheet.id && sheet.boatId === activeSheet.boatId && sheet.lines.length && sheetStart(sheet) <= activeStart)
    .sort((a, b) => sheetStart(a) - sheetStart(b))
    .at(-1);
  const lastLine = previous ? [...previous.lines].sort((a, b) => Date.parse(a.time) - Date.parse(b.time)).at(-1) : undefined;
  if (!lastLine || !Number.isFinite(lastLine.logNm)) return "";
  return String(lastLine.logNm);
}

function hasCoordinates(line: LogLine) {
  return Number.isFinite(line.latitude) && Number.isFinite(line.longitude) && Math.abs(line.latitude) <= 90 && Math.abs(line.longitude) <= 180;
}

function initialBearing(from: Coordinate, to: Coordinate) {
  const phi1 = from.latitude * Math.PI / 180;
  const phi2 = to.latitude * Math.PI / 180;
  const deltaLambda = (to.longitude - from.longitude) * Math.PI / 180;
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function formatDecimal(value: number) {
  return String(Number(value.toFixed(1)));
}

function sheetStart(sheet: LogSheet) {
  const value = Date.parse(sheet.route.departed || sheet.lines[0]?.time || "");
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}
