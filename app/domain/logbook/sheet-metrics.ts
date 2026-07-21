import type { LogLine } from "../../models/logbook";

export type LogSheetMetrics = {
  motorMiles: number;
  sailMiles: number;
  totalMiles: number;
  durationMinutes: number | null;
};

export function calculateLogSheetMetrics(lines: LogLine[]): LogSheetMetrics {
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
  const firstTime = parseLogTimeMinutes(chronologicalLines[0]?.time ?? "");
  const lastTime = parseLogTimeMinutes(chronologicalLines.at(-1)?.time ?? "");
  const durationMinutes = firstTime === undefined || lastTime === undefined ? null : lastTime >= firstTime ? lastTime - firstTime : lastTime + 24 * 60 - firstTime;
  return { motorMiles, sailMiles, totalMiles: Math.max(totalMiles, motorMiles + sailMiles), durationMinutes };
}

export function formatLogSheetDuration(durationMinutes: number | null | undefined) {
  if (durationMinutes == null) return "—";
  const safeMinutes = Math.max(0, Math.round(durationMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  return `${hours}h ${remainingMinutes.toString().padStart(2, "0")}m`;
}

function lineTimeValue(line: LogLine) {
  return parseLogTimeMinutes(line.time) ?? Number.MAX_SAFE_INTEGER;
}

function parseLogTimeMinutes(time: string) {
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return undefined;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return undefined;
  return hours * 60 + minutes;
}

function numeric(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
