import type { LogLine, LogSheet } from "../../models/logbook";
import { calculateLogSheetMetrics, defaultMotionStationaryThresholdNm, isLogLineMotionInterval } from "./sheet-metrics";

export type LogbookDayStatistics = {
  sailingDays: number;
  daysAtSea: number;
};

export type LogbookStatistics = LogbookDayStatistics & {
  sailMiles: number;
  motorMiles: number;
  totalMiles: number;
};

/** Aggregates the mileage and day counters displayed by the dashboard. */
export function calculateLogbookStatistics(
  sheets: readonly LogSheet[],
  stationaryDistanceThresholdNm = defaultMotionStationaryThresholdNm,
): LogbookStatistics {
  const miles = sheets.reduce((totals, sheet) => {
    const metrics = calculateLogSheetMetrics(sheet.lines, sheet.route, { stationaryDistanceThresholdNm });
    totals.sailMiles += metrics.sailMiles;
    totals.motorMiles += metrics.motorMiles;
    totals.totalMiles += metrics.totalMiles;
    return totals;
  }, { sailMiles: 0, motorMiles: 0, totalMiles: 0 });
  return { ...miles, ...calculateLogbookDayStatistics([...sheets], stationaryDistanceThresholdNm) };
}

/**
 * Counts distinct local calendar days across a logbook. A complete route defines
 * its sailing-day range; incomplete routes fall back to dated log lines. Values
 * without a reliable calendar date are deliberately ignored.
 */
export function calculateLogbookDayStatistics(
  sheets: LogSheet[],
  stationaryDistanceThresholdNm = defaultMotionStationaryThresholdNm,
): LogbookDayStatistics {
  const sailingDates = new Set<string>();
  const atSeaDates = new Set<string>();

  for (const sheet of sheets) {
    const departedDate = absoluteLocalDate(sheet.route.departed);
    const arrivedDate = absoluteLocalDate(sheet.route.arrived);
    if (departedDate && arrivedDate && Date.parse(sheet.route.arrived) >= Date.parse(sheet.route.departed)) {
      addDateRange(sailingDates, departedDate, arrivedDate);
    } else {
      for (const line of sheet.lines) {
        const date = absoluteLocalDate(line.time);
        if (date) sailingDates.add(date);
      }
    }

    const datedLines = sheet.lines
      .filter((line): line is LogLine & { time: string } => absoluteLocalDate(line.time) !== undefined)
      .slice()
      .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
    for (let index = 1; index < datedLines.length; index += 1) {
      const previous = datedLines[index - 1];
      const current = datedLines[index];
      if (!isLogLineMotionInterval(previous, current, stationaryDistanceThresholdNm)) continue;
      addDateRange(atSeaDates, absoluteLocalDate(previous.time)!, absoluteLocalDate(current.time)!);
    }
  }

  return { sailingDays: sailingDates.size, daysAtSea: atSeaDates.size };
}

function absoluteLocalDate(value: string) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})(?:[T, ]|$)/);
  if (!match || !Number.isFinite(Date.parse(value.replace(",", "")))) return undefined;
  return match[1];
}

function addDateRange(target: Set<string>, start: string, end: string) {
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    target.add(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}
