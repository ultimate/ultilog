import type { LogSheet } from "../../models/logbook";
import type { Requirement } from "./catalog";
import { calculateLogbookDayStatistics } from "../logbook/logbook-statistics";
import { calculateLogSheetMetrics } from "../logbook/sheet-metrics";

export type RequirementProgress = {
  requirement: Requirement;
  achievedValue: number;
  targetValue: number;
  remainingValue: number;
  percentage: number;
  completed: boolean;
  automatic: boolean;
  verification: "automatic" | "manual" | "not-automatically-verifiable";
};

type AutomaticProgressType = "sail-miles" | "motor-miles" | "total-miles" | "days-sailing" | "days-underway" | "days-at-sea";

/**
 * The catalog vocabulary is intentionally translated here rather than making
 * authored compliance content conform to names used by the statistics domain.
 */
const statisticForProgressType: Record<AutomaticProgressType, keyof AutomaticStatistics> = {
  "sail-miles": "sailMiles",
  "motor-miles": "motorMiles",
  "total-miles": "totalMiles",
  "days-sailing": "sailingDays",
  "days-underway": "sailingDays",
  "days-at-sea": "daysAtSea",
};

type AutomaticStatistics = {
  sailMiles: number;
  motorMiles: number;
  totalMiles: number;
  sailingDays: number;
  daysAtSea: number;
};

/** Purely derives requirement progress; it never mutates catalog or logbook data. */
export function calculateLicenseProgress(
  requirements: readonly Requirement[],
  sheets: readonly LogSheet[],
  completedManualRequirementIds: readonly string[] = [],
): RequirementProgress[] {
  const statistics = collectStatistics(sheets);
  const manuallyCompleted = new Set(completedManualRequirementIds);

  return requirements.map((requirement) => {
    const targetValue = positiveTarget(requirement.threshold);
    if (requirement.type === "manual") {
      const completed = manuallyCompleted.has(requirement.id);
      return progress(requirement, completed ? targetValue : 0, targetValue, completed, false, "manual");
    }

    const statistic = statisticForProgressType[requirement.type as AutomaticProgressType];
    // A filter denotes a qualification beyond the raw counter. Current sheets
    // cannot prove propulsion for an entire day, recency eligibility, skipper
    // role, sea area, or voyage-length rules, so these must not be claimed.
    if (!statistic || hasQualifiers(requirement.filters)) {
      return progress(requirement, 0, targetValue, false, false, "not-automatically-verifiable");
    }

    const achievedValue = statistics[statistic];
    return progress(requirement, achievedValue, targetValue, achievedValue >= targetValue, true, "automatic");
  });
}

function collectStatistics(sheets: readonly LogSheet[]): AutomaticStatistics {
  const miles = sheets.reduce((totals, sheet) => {
    const metrics = calculateLogSheetMetrics(sheet.lines, sheet.route);
    totals.sailMiles += metrics.sailMiles;
    totals.motorMiles += metrics.motorMiles;
    totals.totalMiles += metrics.totalMiles;
    return totals;
  }, { sailMiles: 0, motorMiles: 0, totalMiles: 0 });
  const days = calculateLogbookDayStatistics([...sheets]);
  return { ...miles, ...days };
}

function positiveTarget(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 1;
}

function hasQualifiers(filters: Requirement["filters"]) {
  return filters != null && Object.keys(filters).length > 0;
}

function progress(
  requirement: Requirement,
  achievedValue: number,
  targetValue: number,
  completed: boolean,
  automatic: boolean,
  verification: RequirementProgress["verification"],
): RequirementProgress {
  return {
    requirement,
    achievedValue,
    targetValue,
    remainingValue: Math.max(0, targetValue - achievedValue),
    percentage: Math.max(0, Math.min(100, (achievedValue / targetValue) * 100)),
    completed,
    automatic,
    verification,
  };
}
