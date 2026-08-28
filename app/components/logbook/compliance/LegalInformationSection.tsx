import { useMemo, useState } from "react";
import { CountryFlagSelector } from "../../CountryFlagSelector";
import { complianceCatalog, findLegalRequirement } from "../../../domain/compliance/catalog";
import { localeLabels, useI18n, type Locale } from "../../../lib/i18n";

type Props = { profileCountryCode: string; requestedLanguage: string };
const legalCountryCodes = complianceCatalog.legalLogbookRequirements.map(({ countryCode }) => countryCode);

export function LegalInformationSection({ profileCountryCode, requestedLanguage }: Props) {
  const { t } = useI18n();
  const [countryCode, setCountryCode] = useState(profileCountryCode);
  const [language, setLanguage] = useState(requestedLanguage);

  const entry = useMemo(() => findLegalRequirement(countryCode), [countryCode]);
  const languages = Object.keys(entry?.translations ?? {});
  const resolvedLanguage = entry && languages.includes(language) ? language : languages[0];
  const content = entry && resolvedLanguage ? entry.translations[resolvedLanguage] : undefined;
  const contactHref = `mailto:support@ultilog.app?subject=${encodeURIComponent(`Legal information request: ${countryCode}`)}`;

  return (
    <section className="compliance-board legal-information" aria-labelledby="legal-information-title">
      <h2 id="legal-information-title">{t("compliance.legalInformation")}</h2>
      <div className="compliance-selectors">
        <CountryFlagSelector
          id="legal-country"
          label={t("compliance.legalCountry")}
          emptyLabel={t("compliance.selectCountry")}
          searchLabel={t("common.searchCountries")}
          noResultsLabel={t("common.noCountriesFound")}
          availableCountryCodes={legalCountryCodes}
          availableOnlyLabel={t("compliance.countryAvailableOnly")}
          availableMarkerLabel={t("compliance.countryAvailable")}
          unavailableMarkerLabel={t("compliance.countryUnavailable")}
          value={countryCode}
          onChange={setCountryCode}
        />
        {entry && languages.length > 1 ? (
          <label htmlFor="legal-language">
            {t("compliance.legalLanguage")}
            <select id="legal-language" value={resolvedLanguage} onChange={(event) => setLanguage(event.target.value)}>
              {languages.map((code) => <option key={code} value={code}>{localeLabels[code as Locale] ?? code.toUpperCase()}</option>)}
            </select>
          </label>
        ) : null}
      </div>

      {!countryCode ? <p>{t("compliance.chooseCountryPrompt")}</p> : null}
      {countryCode && !entry ? (
        <div className="compliance-unavailable">
          <p>{t("compliance.unsupportedCountry")}</p>
          <a href={contactHref}>{t("compliance.contactUs")}</a>
        </div>
      ) : null}
      {content ? (
        <article className="legal-document">
          <h3>{content.title}</h3>
          <dl>
            {content.authority ? <div><dt>{t("compliance.authority")}</dt><dd>{content.authority}</dd></div> : null}
            {content.checkedAt ? <div><dt>{t("compliance.checkedAt")}</dt><dd>{content.checkedAt}</dd></div> : null}
            {content.effectiveFrom ? <div><dt>{t("compliance.effectiveFrom")}</dt><dd>{content.effectiveFrom}</dd></div> : null}
          </dl>
          {content.sections.map((section) => (
            <section key={section.id}>
              <h4>{section.heading}</h4>
              {section.citation ? <div className="legal-text" dangerouslySetInnerHTML={{ __html: section.citation }} /> : null}
            </section>
          ))}
          <a href={content.sourceUrl} target="_blank" rel="noopener noreferrer">{t("compliance.officialSource")}</a>
        </article>
      ) : null}
    </section>
  );
}
