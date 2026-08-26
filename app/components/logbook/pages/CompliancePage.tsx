import { useI18n } from "../../../lib/i18n";
import { LegalInformationSection } from "../compliance/LegalInformationSection";
import { LicenseSection } from "../compliance/LicenseSection";

export type CompliancePageProps = {
  countryCode: string;
  language: string;
};

/** Compliance is intentionally page-local: changing its jurisdiction never edits the profile. */
export function CompliancePage({ countryCode, language }: CompliancePageProps) {
  const { t } = useI18n();
  return (
    <section className="sheet-detail module-panel">
      <div className="page-heading">
        <div>
          <h1>{t("nav.compliance")}</h1>
          <p>{t("compliance.subtitle")}</p>
        </div>
      </div>
      <LegalInformationSection key={`${countryCode}:${language}`} profileCountryCode={countryCode} requestedLanguage={language} />
      <LicenseSection />
    </section>
  );
}
