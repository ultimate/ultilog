import { useI18n } from "../../../lib/i18n";
import { LegalInformationSection } from "../compliance/LegalInformationSection";
import { LicenseSection } from "../compliance/LicenseSection";
import type { LogSheet } from "../../../models/logbook";

export type CompliancePageProps = {
  countryCode: string;
  language: string;
  sheets?: readonly LogSheet[];
};

/** Compliance is intentionally page-local: changing its jurisdiction never edits the profile. */
export function CompliancePage({ countryCode, language, sheets = [] }: CompliancePageProps) {
  const { t } = useI18n();
  return (
    <section className="sheet-detail module-panel">
      <div className="page-heading">
        <div>
          <h1>{t("nav.compliance")}</h1>
          <p>{t("compliance.introduction")}</p>
        </div>
      </div>
      <aside className="compliance-disclaimer" role="note">
        <strong>{t("compliance.disclaimerTitle")}</strong>
        <p>{t("compliance.disclaimer")}</p>
      </aside>
      <LegalInformationSection key={`${countryCode}:${language}`} profileCountryCode={countryCode} requestedLanguage={language} />
      <LicenseSection requestedLanguage={language} sheets={sheets} />
    </section>
  );
}
