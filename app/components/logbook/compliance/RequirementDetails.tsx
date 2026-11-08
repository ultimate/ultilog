import { resolveRequirementWindow } from "../../../domain/compliance/date-window";
import { useDateTimeFormat } from "../../../lib/DateTimeFormatProvider";
import type { DateWindowBoundary, Requirement } from "../../../domain/compliance/catalog";
import { useI18n } from "../../../lib/i18n";

/** Counting conditions belong beside the requirement, including manual checks. */
export function RequirementDetails({ requirement, language, referenceDate }: { requirement: Requirement; language: string; referenceDate?: string | null }) {
  const { t } = useI18n();
  const { formatDateRange } = useDateTimeFormat();
  const window = resolveRequirementWindow(requirement.filters, referenceDate);
  const format = (value: number) => new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value);
  const { threshold, unit, filters } = requirement;
  const describe = ({ yearOffset, boundary }: DateWindowBoundary) => {
    const label = t(boundary === "date" ? "compliance.boundaryDate" : boundary === "year-start" ? "compliance.boundaryYearStart" : "compliance.boundaryYearEnd");
    if (yearOffset === 0) return boundary === "date" ? t("compliance.referenceDate") : `${label} · ${t("compliance.referenceYear")}`;
    const years = Math.abs(yearOffset);
    const duration = `${format(years)} ${t(years === 1 ? "compliance.year" : "compliance.years")}`;
    return `${label} · ${t(yearOffset < 0 ? "compliance.beforeReference" : "compliance.afterReference").replace("{duration}", duration)}`;
  };
  // A unitless target of one represents a boolean checkbox, not a distance.
  const showTarget = threshold !== undefined && (requirement.type !== "manual" || unit !== undefined || threshold > 1);
  if (!showTarget && !filters?.boatType && !filters?.propulsion && filters?.withinYears === undefined && !filters?.dateWindow) return null;

  return <dl className="requirement-details">
    {showTarget && threshold !== undefined ? <div><dt>{t("compliance.required")}</dt><dd>{format(threshold)}{unit ? ` ${t(unit === "days" ? "compliance.days" : "compliance.nauticalMiles")}` : ""}</dd></div> : null}
    {filters?.dateWindow ? <>
      <div><dt>{t("compliance.windowFrom")}</dt><dd>{describe(filters.dateWindow.from)}</dd></div>
      <div><dt>{t("compliance.windowThrough")}</dt><dd>{describe(filters.dateWindow.through)}</dd></div>
      {window ? <div><dt>{t("compliance.eligiblePeriod")}</dt><dd>{formatDateRange(window.from, window.through)}</dd></div> : null}
    </> : null}
    {filters?.withinYears !== undefined ? <div><dt>{t("compliance.timeLimit")}</dt><dd>{t(filters.withinYears === 1 ? "compliance.withinYear" : "compliance.withinYears").replace("{count}", format(filters.withinYears))}</dd></div> : null}
    {filters?.boatType ? <div><dt>{t("compliance.boatType")}</dt><dd>{t(filters.boatType === "sail" ? "boats.sail" : "boats.motor")}</dd></div> : null}
    {filters?.propulsion ? <div><dt>{t("compliance.propulsion")}</dt><dd>{t(filters.propulsion === "sail" ? "details.sail" : "details.motor")}</dd></div> : null}
  </dl>;
}
