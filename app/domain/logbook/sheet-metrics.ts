import type { LogLine, LogSheet } from "../../models/logbook";
import { calculateGlobeDistanceNm } from "../nautical/globe-distance";

export type LogSheetMetrics = {
  motorMiles: number;
  sailMiles: number;
  totalMiles: number;
  motorHours: number;
  durationMinutes: number | null;
  overallDurationMinutes: number | null;
  motionDurationMinutes: number;
};

export function calculateLogSheetMetrics(lines: LogLine[], route?: LogSheet["route"]): LogSheetMetrics {
  const chronologicalLines = [...lines].sort((a, b) => lineTimeValue(a) - lineTimeValue(b));
  const deltas = chronologicalLines.map((line, index) => Math.max(0, numeric(line.logNm) - numeric(chronologicalLines[index - 1]?.logNm)));
  const explicitMotorMiles = chronologicalLines.some((line) => numeric(line.motorMiles) > 0);
  const motorMiles = explicitMotorMiles
    ? chronologicalLines.reduce((sum, line) => sum + numeric(line.motorMiles), 0)
    : deltas.reduce((sum, delta, index) => sum + (numeric(chronologicalLines[index]?.motorHours) > 0 ? delta : 0), 0);
  const explicitSailMiles = chronologicalLines.some((line) => numeric(line.sailMiles) > 0);
  const totalMiles = deltas.reduce((sum, delta) => sum + delta, 0);
  const sailMiles = explicitSailMiles
    ? chronologicalLines.reduce((sum, line) => sum + numeric(line.sailMiles), 0)
    : Math.max(0, totalMiles - motorMiles);
  const motorHours = chronologicalLines.reduce((sum, line) => sum + numeric(line.motorHours), 0);
  const motionDurationMinutes = calculateMotionDurationMinutes(chronologicalLines);
  const overallDurationMinutes = calculateOverallDurationMinutes(route);
  return { motorMiles, sailMiles, totalMiles: Math.max(totalMiles, motorMiles + sailMiles), motorHours, durationMinutes: overallDurationMinutes, overallDurationMinutes, motionDurationMinutes };
}

export function formatLogSheetDuration(durationMinutes: number | null | undefined) {
  if (durationMinutes == null) return "—";
  const safeMinutes = Math.max(0, Math.round(durationMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  return `${hours}h ${remainingMinutes.toString().padStart(2, "0")}m`;
}

function calculateMotionDurationMinutes(lines: LogLine[]) {
  return lines.reduce((sum, line, index) => {
    const previous = lines[index - 1];
    if (!previous || isStationary(previous, line)) return sum;
    return sum + timeDeltaMinutes(previous.time, line.time);
  }, 0);
}

function isStationary(previous: LogLine, current: LogLine) {
  if (numeric(previous.logNm) !== numeric(current.logNm)) return false;
  if (!hasPosition(previous) || !hasPosition(current)) return false;
  return calculateGlobeDistanceNm(previous, current) < 0.1;
}

function calculateOverallDurationMinutes(route: LogSheet["route"] | undefined) {
  const departed = parseRouteStamp(route?.departed ?? "");
  const arrived = parseRouteStamp(route?.arrived ?? "");
  if (departed === undefined || arrived === undefined) return null;
  return Math.max(0, Math.round((arrived - departed) / 60000));
}

function parseRouteStamp(value: string) {
  const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2}), (\d{2}:\d{2})/);
  const timestamp = isoMatch
    ? Date.parse(`${isoMatch[1]}T${isoMatch[2]}:00Z`)
    : Date.parse(value.replace(",", ""));
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function lineTimeValue(line: LogLine) {
  return parseLogTimeMinutes(line.time) ?? Number.MAX_SAFE_INTEGER;
}

function timeDeltaMinutes(previousTime: string, currentTime: string) {
  const previous = parseLogTimeMinutes(previousTime);
  const current = parseLogTimeMinutes(currentTime);
  if (previous === undefined || current === undefined) return 0;
  return current >= previous ? current - previous : current + 24 * 60 - previous;
}

function parseLogTimeMinutes(time: string) {
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return undefined;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return undefined;
  return hours * 60 + minutes;
}

function hasPosition(line: LogLine) {
  return Number.isFinite(line.latitude) && Number.isFinite(line.longitude);
}

function numeric(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
