import type { LogLine } from "../../models/logbook";

export function sortLogLinesByTime(lines: LogLine[]) {
  return [...lines].sort((left, right) => lineTimeValue(left) - lineTimeValue(right));
}

function lineTimeValue(line: LogLine) {
  const timestamp = Date.parse(line.time);
  if (Number.isFinite(timestamp)) return timestamp;

  const time = line.time.match(/^(\d{1,2}):(\d{2})/);
  if (time) return Number(time[1]) * 60 + Number(time[2]);

  return Number.MAX_SAFE_INTEGER;
}
