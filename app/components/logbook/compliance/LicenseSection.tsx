import { useEffect, useMemo, useState } from "react";
import type { LogSheet } from "../../../models/logbook";
import { calculateLicenseProgress, summarizeRequirementProgress } from "../../../domain/compliance/license-progress";
import { complianceCatalog, findLicense, licenseLanguages, withLanguageFallback } from "../../../domain/compliance/catalog";
import { localeLabels, useI18n, type Locale } from "../../../lib/i18n";
import { LicenseStatusPie } from "./LicenseStatusPie";

type Props = { requestedLanguage: string; sheets: readonly LogSheet[] };
type TrackedLicense = { licenseId: string; startDate: string | null; completedManualRequirementIds: string[] };
type ComplianceState = { licenses: TrackedLicense[] };

async function complianceRequest(body?: object): Promise<ComplianceState> {
  const response = await fetch("/api/compliance", body ? { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const payload = await response.json().catch(() => ({})) as Partial<ComplianceState> & { error?: string };
  if (!response.ok) throw new Error(payload.error || "Unable to save compliance progress.");
  return { licenses: Array.isArray(payload.licenses) ? payload.licenses : [] };
}

const countryName = (countryCode: string, language: string) => {
  try { return new Intl.DisplayNames([language], { type: "region" }).of(countryCode) ?? countryCode; }
  catch { return countryCode; }
};

export function LicenseSection({ requestedLanguage, sheets }: Props) {
  const { t } = useI18n();
  const [state, setState] = useState<ComplianceState>({ licenses: [] });
  const [languages, setLanguages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string>();
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    complianceRequest().then((next) => current && setState(next))
      .catch((reason) => current && setError(reason instanceof Error ? reason.message : t("compliance.loadFailed")))
      .finally(() => current && setLoading(false));
    return () => { current = false; };
  }, [t]);

  const trackedIds = new Set(state.licenses.map(({ licenseId }) => licenseId));
  const available = complianceCatalog.licenses.filter(({ id }) => !trackedIds.has(id));
  const grouped = useMemo(() => Array.from(complianceCatalog.licenses.reduce((groups, entry) => {
    groups.set(entry.countryCode, [...(groups.get(entry.countryCode) ?? []), entry]);
    return groups;
  }, new Map<string, typeof complianceCatalog.licenses>())), []);
  const format = (value: number) => new Intl.NumberFormat(requestedLanguage, { maximumFractionDigits: 1 }).format(value);
  const unitLabel = (unit: "days" | "nautical-miles" | undefined) => unit === "days" ? t("compliance.days") : t("compliance.nauticalMiles");

  async function update(body: object, id: string) {
    setSavingId(id); setError("");
    try { setState(await complianceRequest(body)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t("compliance.saveFailed")); }
    finally { setSavingId(undefined); }
  }

  return <section className="license-section" aria-labelledby="license-progress-title" aria-busy={loading}>
    <h2 id="license-progress-title">{t("compliance.licenseProgress")}</h2>
    <div className="compliance-selectors license-selectors">
      <label htmlFor="compliance-license">{t("compliance.addLicense")}
        <select id="compliance-license" value="" disabled={loading || available.length === 0} onChange={(event) => event.target.value && void update({ action: "select-license", licenseId: event.target.value, selected: true }, event.target.value)}>
          <option value="">{t("compliance.selectLicense")}</option>
          {grouped.map(([countryCode, entries]) => {
            const selectable = entries.filter(({ id }) => !trackedIds.has(id));
            return selectable.length ? <optgroup key={countryCode} label={countryName(countryCode, requestedLanguage)}>{selectable.map((entry) => <option key={entry.id} value={entry.id}>{withLanguageFallback(entry.content, requestedLanguage, entry.defaultLanguage)?.licenseName ?? entry.id}</option>)}</optgroup> : null;
          })}
        </select>
      </label>
    </div>
    {loading ? <p className="compliance-loading">{t("compliance.loading")}</p> : null}
    {error ? <p className="compliance-error" role="alert">{error}</p> : null}
    {!loading && state.licenses.length === 0 ? <p className="compliance-unavailable">{t("compliance.chooseLicensePrompt")}</p> : null}
    <div className="tracked-license-list">{state.licenses.map((tracked) => {
      const license = findLicense(tracked.licenseId);
      if (!license) return null;
      const options = licenseLanguages(license.id);
      const preferred = languages[license.id] ?? requestedLanguage;
      const resolvedLanguage = options.includes(preferred) ? preferred : license.defaultLanguage;
      const content = withLanguageFallback(license.content, resolvedLanguage, license.defaultLanguage)!;
      const progress = calculateLicenseProgress(license.requirements, sheets, tracked.completedManualRequirementIds, tracked.startDate);
      const summary = summarizeRequirementProgress(progress);
      return <article className="tracked-license" key={license.id}>
        <header className="tracked-license-heading"><div><small>{countryName(license.countryCode, requestedLanguage)}</small><h3>{content.licenseName}</h3></div>
          <button type="button" className="secondary-action" disabled={savingId === license.id} onClick={() => void update({ action: "select-license", licenseId: license.id, selected: false }, license.id)}>{t("compliance.removeLicense")}</button>
        </header>
        <LicenseStatusPie summary={summary} />
        <div className="compliance-selectors license-selectors">
          <label htmlFor={`license-language-${license.id}`}>{t("compliance.licenseLanguage")}<select id={`license-language-${license.id}`} value={resolvedLanguage} onChange={(event) => setLanguages((current) => ({ ...current, [license.id]: event.target.value }))}>{options.map((code) => <option key={code} value={code}>{localeLabels[code as Locale] ?? code.toUpperCase()}</option>)}</select></label>
          <label htmlFor={`license-start-${license.id}`}>{t("compliance.startDate")}<input id={`license-start-${license.id}`} type="date" value={tracked.startDate ?? ""} disabled={savingId === license.id} onChange={(event) => void update({ action: "license-start-date", licenseId: license.id, startDate: event.target.value || null }, license.id)} /></label>
        </div>
        <details className="license-document"><summary>{t("compliance.licenseLegalDetails")}</summary><div className="license-document-content"><p>{content.title}</p><dl className="source-metadata">{content.authority ? <div><dt>{t("compliance.authority")}</dt><dd>{content.authority}</dd></div> : null}{content.checkedAt ? <div><dt>{t("compliance.checkedAt")}</dt><dd>{content.checkedAt}</dd></div> : null}{content.effectiveFrom ? <div><dt>{t("compliance.effectiveFrom")}</dt><dd>{content.effectiveFrom}</dd></div> : null}</dl>{content.sections.map((section) => <section key={section.id}><h4>{section.heading}</h4>{section.citation ? <div className="legal-text" dangerouslySetInnerHTML={{ __html: section.citation }} /> : null}</section>)}<a href={content.sourceUrl} target="_blank" rel="noopener noreferrer">{t("compliance.officialSource")}</a></div></details>
        <section className="requirement-panel"><h4>{t("compliance.checklist")}</h4>{progress.map((item) => <article className={`requirement-row requirement-${item.verification} requirement-status-${item.completed ? "fulfilled" : item.requirement.type !== "manual" && item.achievedValue > 0 ? "in-progress" : "open"}`} key={item.requirement.id}>
          {item.requirement.type === "manual" ? <input type="checkbox" aria-label={t(item.requirement.translationKey)} checked={item.completed} disabled={savingId === item.requirement.id} onChange={(event) => void update({ action: "manual-requirement", licenseId: license.id, requirementId: item.requirement.id, completed: event.target.checked }, item.requirement.id)} /> : <span className="requirement-status" aria-hidden="true">{item.completed ? "✓" : "•"}</span>}
          <div className="requirement-copy"><strong>{t(item.requirement.translationKey)}</strong><small>{item.verification === "manual" ? t("compliance.manualVerification") : item.verification === "not-automatically-verifiable" ? t("compliance.notAutomaticallyVerifiable") : t("compliance.automaticallyTracked")}</small></div>
          {item.requirement.type !== "manual" ? <div className="requirement-progress"><dl><div><dt>{t("compliance.achieved")}</dt><dd>{format(item.achievedValue)}</dd></div><div><dt>{t("compliance.required")}</dt><dd>{format(item.targetValue)}</dd></div><div><dt>{t("compliance.remaining")}</dt><dd>{format(item.remainingValue)}</dd></div><div><dt>{t("compliance.unit")}</dt><dd>{unitLabel(item.requirement.unit)}</dd></div></dl><progress value={item.percentage} max={100} aria-label={`${t(item.requirement.translationKey)}: ${format(item.percentage)}%`} /><span>{format(item.percentage)}%</span></div> : null}
        </article>)}</section>
      </article>;
    })}</div>
  </section>;
}
