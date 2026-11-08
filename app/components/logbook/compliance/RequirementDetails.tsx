import type { Requirement } from "../../../domain/compliance/catalog";
import { useI18n } from "../../../lib/i18n";

/** Counting conditions belong beside the requirement, including manual checks. */
export function RequirementDetails({ requirement, language }: { requirement: Requirement; language: string }) {
  const { t } = useI18n();
  const format = (value: number) => new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value);
  const { threshold, unit, filters } = requirement;
  // A unitless target of one represents a boolean checkbox, not a distance.
  const showTarget = threshold !== undefined && (requirement.type !== "manual" || unit !== undefined || threshold > 1);
  if (!showTarget && !filters?.boatType && !filters?.propulsion && filters?.withinYears === undefined) return null;

  return <dl className="requirement-details">
    {showTarget && threshold !== undefined ? <div><dt>{t("compliance.required")}</dt><dd>{format(threshold)}{unit ? ` ${t(unit === "days" ? "compliance.days" : "compliance.nauticalMiles")}` : ""}</dd></div> : null}
    {filters?.withinYears !== undefined ? <div><dt>{t("compliance.timeLimit")}</dt><dd>{t(filters.withinYears === 1 ? "compliance.withinYear" : "compliance.withinYears").replace("{count}", format(filters.withinYears))}</dd></div> : null}
    {filters?.boatType ? <div><dt>{t("compliance.boatType")}</dt><dd>{t(filters.boatType === "sail" ? "boats.sail" : "boats.motor")}</dd></div> : null}
    {filters?.propulsion ? <div><dt>{t("compliance.propulsion")}</dt><dd>{t(filters.propulsion === "sail" ? "details.sail" : "details.motor")}</dd></div> : null}
  </dl>;
}
