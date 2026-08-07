import type { LogLine, LogSheet } from "../../models/logbook";
import { calculateGlobeDistanceNm } from "../nautical/globe-distance";

export const defaultMotionStationaryThresholdNm = 0.1;

export type LogSheetMetrics = {
  motorMiles: number;
  sailMiles: number;
  totalMiles: number;
  motorHours: number;
  engineHours?: Record<string, number>;
  propulsionDurationMinutes?: number;
  durationMinutes: number | null;
  overallDurationMinutes: number | null;
  motionDurationMinutes: number;
};

export function calculateLogSheetMetrics(lines: LogLine[], route?: LogSheet["route"], options: { stationaryDistanceThresholdNm?: number } = {}): LogSheetMetrics {
  const chronologicalLines = [...lines].sort((a, b) => lineTimeValue(a) - lineTimeValue(b));
  const deltas = chronologicalLines.map((line, index) => Math.max(0, numeric(line.logNm) - numeric(chronologicalLines[index - 1]?.logNm)));
  const explicitMotorMiles = chronologicalLines.some((line) => numeric(line.motorMiles) > 0);
  const motorMiles = explicitMotorMiles
    ? chronologicalLines.reduce((sum, line) => sum + numeric(line.motorMiles), 0)
    : deltas.reduce((sum, delta, index) => sum + (lineEngineHours(chronologicalLines[index]) > 0 ? delta : 0), 0);
  const explicitSailMiles = chronologicalLines.some((line) => numeric(line.sailMiles) > 0);
  const totalMiles = deltas.reduce((sum, delta) => sum + delta, 0);
  const sailMiles = explicitSailMiles
    ? chronologicalLines.reduce((sum, line) => sum + numeric(line.sailMiles), 0)
    : Math.max(0, totalMiles - motorMiles);
  const engineHours = chronologicalLines.reduce<Record<string, number>>((totals, line) => {
    for (const [engineId, hours] of Object.entries(normalizedEngineHours(line))) totals[engineId] = (totals[engineId] ?? 0) + hours;
    return totals;
  }, {});
  const motorHours = Object.values(engineHours).reduce((sum, hours) => sum + hours, 0);
  const propulsionDurationMinutes = chronologicalLines.reduce((sum, line) => sum + Math.max(0, ...Object.values(normalizedEngineHours(line))) * 60, 0);
  const motionDurationMinutes = calculateMotionDurationMinutes(chronologicalLines, options.stationaryDistanceThresholdNm ?? defaultMotionStationaryThresholdNm);
  const overallDurationMinutes = calculateOverallDurationMinutes(route);
  return { motorMiles, sailMiles, totalMiles: Math.max(totalMiles, motorMiles + sailMiles), motorHours, engineHours, propulsionDurationMinutes, durationMinutes: overallDurationMinutes, overallDurationMinutes, motionDurationMinutes };
}

function normalizedEngineHours(line: LogLine) {
  const entries = Object.entries(line.engineHours ?? {}).map(([id, value]) => [id, Math.max(0, numeric(value))] as const).filter(([, value]) => value > 0);
  if (entries.length) return Object.fromEntries(entries) as Record<string, number>;
  const legacy = Math.max(0, numeric(line.motorHours));
  return legacy > 0 ? { "main-engine": legacy } : {};
}

function lineEngineHours(line: LogLine | undefined) {
  return line ? Object.values(normalizedEngineHours(line)).reduce((sum, hours) => sum + hours, 0) : 0;
}

export function formatLogSheetDuration(durationMinutes: number | null | undefined) {
  if (durationMinutes == null) return "—";
  const safeMinutes = Math.max(0, Math.round(durationMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  return `${hours}h ${remainingMinutes.toString().padStart(2, "0")}m`;
}

function calculateMotionDurationMinutes(lines: LogLine[], stationaryDistanceThresholdNm: number) {
  return lines.reduce((sum, line, index) => {
    const previous = lines[index - 1];
    if (!previous || isStationary(previous, line, stationaryDistanceThresholdNm)) return sum;
    return sum + timeDeltaMinutes(previous.time, line.time);
  }, 0);
}

function isStationary(previous: LogLine, current: LogLine, stationaryDistanceThresholdNm: number) {
  if (numeric(previous.logNm) !== numeric(current.logNm)) return false;
  if (!hasPosition(previous) || !hasPosition(current)) return false;
  return calculateGlobeDistanceNm(previous, current) < stationaryDistanceThresholdNm;
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
  return parseLogTimeValue(line.time)?.value ?? Number.MAX_SAFE_INTEGER;
}

function timeDeltaMinutes(previousTime: string, currentTime: string) {
  const previous = parseLogTimeValue(previousTime);
  const current = parseLogTimeValue(currentTime);
  if (!previous || !current) return 0;
  if (previous.kind === "absolute" && current.kind === "absolute") return Math.max(0, current.value - previous.value);
  return current.value >= previous.value ? current.value - previous.value : current.value + 24 * 60 - previous.value;
}

function parseLogTimeValue(time: string): { kind: "absolute" | "dayTime"; value: number } | undefined {
  const timestamp = Date.parse(time);
  if (Number.isFinite(timestamp) && /\d{4}-\d{2}-\d{2}/.test(time)) return { kind: "absolute", value: Math.round(timestamp / 60000) };
  const match = time.match(/(?:^|T)(\d{1,2}):(\d{2})/);
  if (!match) return undefined;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return undefined;
  return { kind: "dayTime", value: hours * 60 + minutes };
}

function hasPosition(line: LogLine) {
  return Number.isFinite(line.latitude) && Number.isFinite(line.longitude);
}

function numeric(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
