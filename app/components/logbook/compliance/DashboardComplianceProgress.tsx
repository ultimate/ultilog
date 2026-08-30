import { useEffect, useState } from "react";
import type { LogSheet } from "../../../models/logbook";
import { calculateLicenseProgress, summarizeRequirementProgress, type RequirementStatusSummary } from "../../../domain/compliance/license-progress";
import { findLicense, withLanguageFallback } from "../../../domain/compliance/catalog";
import { useI18n } from "../../../lib/i18n";
import { LicenseStatusPie } from "./LicenseStatusPie";

type TrackedLicense = { licenseId: string; startDate: string | null; completedManualRequirementIds: string[] };
const empty = (): RequirementStatusSummary => ({ fulfilled: 0, inProgress: 0, open: 0, total: 0 });

export function DashboardComplianceProgress({ sheets, language, onOpenCompliance }: { sheets: readonly LogSheet[]; language: string; onOpenCompliance: () => void }) {
  const { t } = useI18n();
  const [tracked, setTracked] = useState<TrackedLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    fetch("/api/compliance").then(async (response) => {
      const payload = await response.json().catch(() => ({})) as { licenses?: TrackedLicense[]; error?: string };
      if (!response.ok) throw new Error(payload.error || t("compliance.loadFailed"));
      if (current) setTracked(Array.isArray(payload.licenses) ? payload.licenses : []);
    }).catch((reason) => current && setError(reason instanceof Error ? reason.message : t("compliance.loadFailed")))
      .finally(() => current && setLoading(false));
    return () => { current = false; };
  }, [t]);

  const items = tracked.flatMap((entry) => {
    const license = findLicense(entry.licenseId);
    if (!license) return [];
    const progress = calculateLicenseProgress(license.requirements, sheets, entry.completedManualRequirementIds, entry.startDate);
    return [{ entry, license, summary: summarizeRequirementProgress(progress) }];
  });
  const overall = items.reduce((total, item) => ({ fulfilled: total.fulfilled + item.summary.fulfilled, inProgress: total.inProgress + item.summary.inProgress, open: total.open + item.summary.open, total: total.total + item.summary.total }), empty());

  return <section className="dashboard-license-progress" aria-labelledby="dashboard-license-title" aria-busy={loading}>
    <div className="dashboard-license-heading"><div><h2 id="dashboard-license-title">{t("dashboard.complianceProgress")}</h2><p>{t("compliance.requirementOverview")}</p></div><button type="button" className="secondary-action" onClick={onOpenCompliance}>{t("dashboard.viewComplianceDetails")}</button></div>
    {loading ? <p className="compliance-loading">{t("compliance.loading")}</p> : null}
    {error ? <p className="compliance-error" role="alert">{error}</p> : null}
    {!loading && !error && items.length === 0 ? <p className="compliance-unavailable">{t("compliance.noTrackedLicenses")}</p> : null}
    {items.length ? <div className="dashboard-license-overall"><h3>{t("compliance.overallStatus")}</h3><LicenseStatusPie summary={overall} compact /></div> : null}
    <div className="dashboard-license-grid">{items.map(({ entry, license, summary }) => {
      const content = withLanguageFallback(license.content, language, license.defaultLanguage)!;
      return <article key={license.id}><div><small>{license.countryCode}</small><h3>{content.licenseName}</h3>{entry.startDate ? <p>{t("compliance.startDate")}: {entry.startDate}</p> : null}</div><LicenseStatusPie summary={summary} compact /></article>;
    })}</div>
  </section>;
}
