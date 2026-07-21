import type { LogLine } from "../../models/logbook";

export type LogSheetMetrics = {
  motorMiles: number;
  sailMiles: number;
  totalMiles: number;
  durationMinutes: number | null;
};

export function calculateLogSheetMetrics(lines: LogLine[]): LogSheetMetrics {
  const deltas = lines.map((line, index) => Math.max(0, line.logNm - (lines[index - 1]?.logNm ?? 0)));
  const motorMiles = deltas.reduce((sum, delta, index) => sum + ((lines[index]?.motorHours ?? 0) > 0 || (lines[index]?.motorMiles ?? 0) > 0 ? delta : 0), 0);
  const totalMiles = deltas.reduce((sum, delta) => sum + delta, 0);
  const sailMiles = Math.max(0, totalMiles - motorMiles);
  const firstTime = parseLogTimeMinutes(lines[0]?.time ?? "");
  const lastTime = parseLogTimeMinutes(lines.at(-1)?.time ?? "");
  const durationMinutes = firstTime === undefined || lastTime === undefined ? null : lastTime >= firstTime ? lastTime - firstTime : lastTime + 24 * 60 - firstTime;
  return { motorMiles, sailMiles, totalMiles, durationMinutes };
}

export function formatLogSheetDuration(durationMinutes: number | null | undefined) {
  if (durationMinutes == null) return "—";
  const safeMinutes = Math.max(0, Math.round(durationMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  return `${hours}h ${remainingMinutes.toString().padStart(2, "0")}m`;
}

function parseLogTimeMinutes(time: string) {
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return undefined;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return undefined;
  return hours * 60 + minutes;
}
