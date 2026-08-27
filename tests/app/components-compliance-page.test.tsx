import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "../../app/lib/i18n";
import { CompliancePage } from "../../app/components/logbook/pages/CompliancePage";

const renderPage = (countryCode: string, language: string) => renderToStaticMarkup(
  <I18nProvider><CompliancePage countryCode={countryCode} language={language} /></I18nProvider>,
);

describe("CompliancePage", () => {
  it("introduces both page purposes and includes a legal-information disclaimer", () => {
    const markup = renderPage("CH", "en");
    expect(markup).toContain("legal logbook requirements");
    expect(markup).toContain("progress toward sailing licenses");
    expect(markup).toContain("provided without warranty");
    expect(markup).toContain("responsible for checking the complete, current legal requirements");
  });

  it("initializes its page-local country from the profile without a profile update control", () => {
    const swiss = renderPage("CH", "en");
    const german = renderPage("DE", "en");
    expect(swiss).toContain('<option value="CH" selected="">');
    expect(german).toContain('<option value="DE" selected="">');
    expect(swiss).not.toContain("/api/profile");
  });

  it("renders supported content in the profile language and falls back to the first available translation", () => {
    expect(renderPage("CH", "fr")).toContain("Dispositions générales concernant les yachts suisses");
    expect(renderPage("DE", "fr")).toContain("Schiffssicherheitsverordnung");
  });

  it("renders safe official links and language options derived from legal content", () => {
    const markup = renderPage("CH", "it");
    expect(markup).toContain('target="_blank" rel="noopener noreferrer"');
    expect(markup).toContain('<option value="de">Deutsch</option>');
    expect(markup).toContain('<option value="it" selected="">Italiano</option>');
  });

  it("prompts for an empty country and offers country-specific contact for unsupported ISO countries", () => {
    expect(renderPage("", "en")).toContain("Select a country to view its legal information.");
    const unsupported = renderPage("FR", "en");
    expect(unsupported).toContain("Legal information is not yet available");
    expect(unsupported).toContain("Legal%20information%20request%3A%20FR");
  });
});
