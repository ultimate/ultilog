import type { Boat, LogSheet } from "../../models/logbook";
import type { Requirement } from "./catalog";
import { calculateLogbookStatistics } from "../logbook/logbook-statistics";

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

export type RequirementStatusSummary = { fulfilled: number; inProgress: number; open: number; total: number };

export function summarizeRequirementProgress(progressItems: readonly RequirementProgress[]): RequirementStatusSummary {
  return progressItems.reduce((summary, item) => {
    if (item.completed) summary.fulfilled += 1;
    else if (item.requirement.type !== "manual" && item.achievedValue > 0 && item.achievedValue < item.targetValue) summary.inProgress += 1;
    else summary.open += 1;
    summary.total += 1;
    return summary;
  }, { fulfilled: 0, inProgress: 0, open: 0, total: 0 });
}

type AutomaticProgressType = "miles" | "days-sailing" | "days-underway" | "days-at-sea";

/**
 * The catalog vocabulary is intentionally translated here rather than making
 * authored compliance content conform to names used by the statistics domain.
 */
const statisticForProgressType: Record<AutomaticProgressType, keyof AutomaticStatistics> = {
  "miles": "totalMiles",
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
  startDate?: string | null,
  asOf = new Date(),
  boats: readonly Boat[] = [],
): RequirementProgress[] {
  const boatsById = new Map(boats.map(boat => [boat.id, boat]));
  const manuallyCompleted = new Set(completedManualRequirementIds);

  return requirements.map((requirement) => {
    const targetValue = positiveTarget(requirement.threshold);
    if (requirement.type === "manual") {
      const completed = manuallyCompleted.has(requirement.id);
      return progress(requirement, completed ? targetValue : 0, targetValue, completed, false, "manual");
    }

    const statistic = statisticForProgressType[requirement.type as AutomaticProgressType];
    if (!statistic || hasUnsupportedQualifiers(requirement)) {
      return progress(requirement, 0, targetValue, false, false, "not-automatically-verifiable");
    }

    const window = effectiveWindow(startDate, requirement.filters?.withinYears, asOf);
    const eligible = sheetsWithin(sheets, window).filter(sheet => !requirement.filters?.boatType || boatsById.get(sheet.boatId)?.type === requirement.filters.boatType);
    const statistics = collectStatistics(eligible);
    const propulsion = requirement.filters?.propulsion;
    const counter = requirement.type === "miles" && propulsion ? (propulsion === "sail" ? "sailMiles" : "motorMiles") : statistic;
    const achievedValue = statistics[counter];
    return progress(requirement, achievedValue, targetValue, achievedValue >= targetValue, true, "automatic");
  });
}

function collectStatistics(sheets: readonly LogSheet[]): AutomaticStatistics {
  return calculateLogbookStatistics(sheets);
}

function positiveTarget(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 1;
}

function hasUnsupportedQualifiers(requirement: Requirement) {
  const propulsion = requirement.filters?.propulsion;
  if (!propulsion) return false;
  // Day counters do not yet distinguish time spent under each propulsion.
  return requirement.type !== "miles" || (propulsion !== "sail" && propulsion !== "motor");
}

type ProgressWindow = { from?: string; through?: string };

function effectiveWindow(startDate: string | null | undefined, withinYears: number | undefined, asOf: Date): ProgressWindow {
  if (startDate) {
    return { from: startDate, ...(withinYears ? { through: shiftYears(startDate, withinYears) } : {}) };
  }
  return withinYears ? { from: shiftYears(asOf.toISOString().slice(0, 10), -withinYears) } : {};
}

/** Clamp leap-day anniversaries to the last day of February. */
function shiftYears(isoDate: string, years: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const month = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear() + years);
  if (date.getUTCMonth() !== month) date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}

function sheetsWithin(sheets: readonly LogSheet[], { from, through }: ProgressWindow) {
  if (!from && !through) return sheets;
  return sheets.filter((sheet) => {
    const dates = [sheet.route.departed, sheet.route.arrived, ...sheet.lines.map(({ time }) => time)]
      .filter(Boolean).map(date => date.slice(0, 10)).sort();
    if (!dates.length) return false;
    return (!from || dates[0] >= from) && (!through || dates[dates.length - 1] <= through);
  });
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
