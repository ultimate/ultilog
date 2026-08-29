import { useEffect, useMemo, useState } from "react";
import type { LogSheet } from "../../../models/logbook";
import { calculateLicenseProgress } from "../../../domain/compliance/license-progress";
import { complianceCatalog, findLicense, licenseLanguages, withLanguageFallback } from "../../../domain/compliance/catalog";
import { localeLabels, useI18n, type Locale } from "../../../lib/i18n";

type Props = { requestedLanguage: string; sheets: readonly LogSheet[] };
type ComplianceState = { selectedLicenseId: string | null; completedManualRequirementIds: string[] };

async function complianceRequest(body?: object): Promise<ComplianceState> {
  const response = await fetch("/api/compliance", body ? {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  } : undefined);
  const payload = await response.json().catch(() => ({})) as Partial<ComplianceState> & { error?: string };
  if (!response.ok) throw new Error(payload.error || "Unable to save compliance progress.");
  return {
    selectedLicenseId: typeof payload.selectedLicenseId === "string" ? payload.selectedLicenseId : null,
    completedManualRequirementIds: Array.isArray(payload.completedManualRequirementIds) ? payload.completedManualRequirementIds : [],
  };
}

const countryName = (countryCode: string, language: string) => {
  try { return new Intl.DisplayNames([language], { type: "region" }).of(countryCode) ?? countryCode; }
  catch { return countryCode; }
};

export function LicenseSection({ requestedLanguage, sheets }: Props) {
  const { t } = useI18n();
  const [state, setState] = useState<ComplianceState>({ selectedLicenseId: null, completedManualRequirementIds: [] });
  const [selectedLicenseId, setSelectedLicenseId] = useState("");
  const [language, setLanguage] = useState(requestedLanguage);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string>();
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    complianceRequest().then((next) => {
      if (!current) return;
      setState(next);
      setSelectedLicenseId(next.selectedLicenseId ?? "");
    }).catch((reason) => current && setError(reason instanceof Error ? reason.message : t("compliance.loadFailed")))
      .finally(() => current && setLoading(false));
    return () => { current = false; };
  }, [t]);

  const license = findLicense(selectedLicenseId);
  const languages = license ? licenseLanguages(license.id) : [];
  const resolvedLanguage = license && languages.includes(language) ? language : license?.defaultLanguage;
  const content = license && withLanguageFallback(license.content, resolvedLanguage, license.defaultLanguage);
  const progress = useMemo(() => license
    ? calculateLicenseProgress(license.requirements, sheets, state.completedManualRequirementIds)
    : [], [license, sheets, state.completedManualRequirementIds]);

  const grouped = useMemo(() => Array.from(complianceCatalog.licenses.reduce((groups, entry) => {
    groups.set(entry.countryCode, [...(groups.get(entry.countryCode) ?? []), entry]);
    return groups;
  }, new Map<string, typeof complianceCatalog.licenses>())), []);
  const format = (value: number) => new Intl.NumberFormat(requestedLanguage, { maximumFractionDigits: 1 }).format(value);
  const unitLabel = (unit: "days" | "nautical-miles" | undefined) => unit === "days" ? t("compliance.days") : t("compliance.nauticalMiles");

  async function selectLicense(licenseId: string) {
    const previous = selectedLicenseId;
    setSelectedLicenseId(licenseId);
    setError("");
    try {
      const next = await complianceRequest({ action: "select-license", licenseId: licenseId || null });
      setState(next);
      const nextLicense = findLicense(licenseId);
      setLanguage(nextLicense?.content[requestedLanguage] ? requestedLanguage : nextLicense?.defaultLanguage ?? requestedLanguage);
    } catch (reason) {
      setSelectedLicenseId(previous);
      setError(reason instanceof Error ? reason.message : t("compliance.saveFailed"));
    }
  }

  async function toggleManual(requirementId: string, completed: boolean) {
    if (!license) return;
    setSavingId(requirementId);
    setError("");
    try {
      setState(await complianceRequest({ action: "manual-requirement", licenseId: license.id, requirementId, completed }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("compliance.saveFailed"));
    } finally { setSavingId(undefined); }
  }

  return <section className="license-section" aria-labelledby="license-progress-title" aria-busy={loading}>
    <h2 id="license-progress-title">{t("compliance.licenseProgress")}</h2>
    <div className="compliance-selectors license-selectors">
      <label htmlFor="compliance-license">{t("compliance.targetLicense")}
        <select id="compliance-license" value={selectedLicenseId} onChange={(event) => void selectLicense(event.target.value)} disabled={loading}>
          <option value="">{t("compliance.selectLicense")}</option>
          {grouped.map(([countryCode, licenses]) => <optgroup key={countryCode} label={countryName(countryCode, requestedLanguage)}>
            {(licenses ?? []).map((entry) => {
              const label = withLanguageFallback(entry.content, requestedLanguage, entry.defaultLanguage)?.licenseName ?? entry.id;
              return <option key={entry.id} value={entry.id}>{label}</option>;
            })}
          </optgroup>)}
        </select>
      </label>
      {license ? <label htmlFor="license-language">{t("compliance.licenseLanguage")}
        <select id="license-language" value={resolvedLanguage} onChange={(event) => setLanguage(event.target.value)}>
          {languages.map((code) => <option key={code} value={code}>{localeLabels[code as Locale] ?? code.toUpperCase()}</option>)}
        </select>
      </label> : null}
    </div>
    {loading ? <p className="compliance-loading">{t("compliance.loading")}</p> : null}
    {error ? <p className="compliance-error" role="alert">{error}</p> : null}
    {!loading && !license ? <p className="compliance-unavailable">{t("compliance.chooseLicensePrompt")}</p> : null}
    {license && content ? <>
      <article className="license-document">
        <h3>{content.licenseName}</h3><p>{content.title}</p>
        <dl className="source-metadata">
          {content.authority ? <div><dt>{t("compliance.authority")}</dt><dd>{content.authority}</dd></div> : null}
          {content.checkedAt ? <div><dt>{t("compliance.checkedAt")}</dt><dd>{content.checkedAt}</dd></div> : null}
          {content.effectiveFrom ? <div><dt>{t("compliance.effectiveFrom")}</dt><dd>{content.effectiveFrom}</dd></div> : null}
        </dl>
        {content.sections.map((section) => <section key={section.id}><h4>{section.heading}</h4>{section.citation ? <div className="legal-text" dangerouslySetInnerHTML={{ __html: section.citation }} /> : null}</section>)}
        <a href={content.sourceUrl} target="_blank" rel="noopener noreferrer">{t("compliance.officialSource")}</a>
      </article>
      <section className="requirement-panel" aria-labelledby="requirement-title"><h3 id="requirement-title">{t("compliance.checklist")}</h3>
        {progress.map((item) => <article className={`requirement-row requirement-${item.verification}`} key={item.requirement.id}>
          {item.requirement.type === "manual" ? <input type="checkbox" aria-label={t(item.requirement.translationKey)} checked={item.completed} disabled={savingId === item.requirement.id} onChange={(event) => void toggleManual(item.requirement.id, event.target.checked)} /> : <span className="requirement-status" aria-hidden="true">{item.completed ? "✓" : "•"}</span>}
          <div className="requirement-copy"><strong>{t(item.requirement.translationKey)}</strong>
            <small>{item.verification === "manual" ? t("compliance.manualVerification") : item.verification === "not-automatically-verifiable" ? t("compliance.notAutomaticallyVerifiable") : t("compliance.automaticallyTracked")}</small>
          </div>
          {item.requirement.type !== "manual" ? <div className="requirement-progress">
            <dl><div><dt>{t("compliance.achieved")}</dt><dd>{format(item.achievedValue)}</dd></div><div><dt>{t("compliance.required")}</dt><dd>{format(item.targetValue)}</dd></div><div><dt>{t("compliance.remaining")}</dt><dd>{format(item.remainingValue)}</dd></div><div><dt>{t("compliance.unit")}</dt><dd>{unitLabel(item.requirement.unit)}</dd></div></dl>
            <progress value={item.percentage} max={100} aria-label={`${t(item.requirement.translationKey)}: ${format(item.percentage)}%`} /><span>{format(item.percentage)}%</span>
          </div> : null}
        </article>)}
      </section>
    </> : null}
  </section>;
}
