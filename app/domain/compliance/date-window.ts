import type { DateWindowBoundary, RequirementFilters } from "./catalog";

export type ProgressWindow = { from?: string; through?: string };

/** Resolve once for both progress calculations and the displayed eligible period. */
export function resolveRequirementWindow(
  filters: RequirementFilters | null | undefined,
  referenceDate: string | null | undefined,
  asOf = new Date(),
): ProgressWindow | undefined {
  if (filters?.dateWindow) {
    const effectiveDate = referenceDate || (filters.dateWindow.referenceDateFallback === "today" ? asOf.toISOString().slice(0, 10) : undefined);
    if (!effectiveDate) return undefined;
    return {
      from: resolveBoundary(effectiveDate, filters.dateWindow.from),
      through: resolveBoundary(effectiveDate, filters.dateWindow.through),
    };
  }
  // Preserve the existing non-Swiss counting contract.
  if (referenceDate) return { from: referenceDate, ...(filters?.withinYears ? { through: shiftYears(referenceDate, filters.withinYears) } : {}) };
  return filters?.withinYears ? { from: shiftYears(asOf.toISOString().slice(0, 10), -filters.withinYears) } : {};
}

function resolveBoundary(referenceDate: string, endpoint: DateWindowBoundary) {
  const shifted = shiftYears(referenceDate, endpoint.yearOffset);
  if (endpoint.boundary === "year-start") return `${shifted.slice(0, 4)}-01-01`;
  if (endpoint.boundary === "year-end") return `${shifted.slice(0, 4)}-12-31`;
  return shifted;
}

/** Clamp exact leap-day anniversaries to February 28 in non-leap years. */
function shiftYears(isoDate: string, years: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const month = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear() + years);
  if (date.getUTCMonth() !== month) date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}
