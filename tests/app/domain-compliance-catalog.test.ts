import { describe, expect, it } from "vitest";
import {
  complianceCatalog,
  createComplianceCatalog,
  findLegalRequirement,
  findLicense,
  legalLanguages,
  licenseLanguages,
  withLanguageFallback,
} from "../../app/domain/compliance/catalog";

const content = {
  title: "Law",
  authority: "Authority",
  sourceUrl: "https://example.test/law",
  checkedAt: "2026-01-01",
  effectiveFrom: "",
  sections: [],
};

const fixture = () => ({
  _instructions: { authorOnly: true },
  legalLogbookRequirements: [{ countryCode: "GB", defaultLanguage: "en", translations: { en: content } }],
  licenses: [{
    id: "gb-example",
    countryCode: "GB",
    defaultLanguage: "en",
    content: { en: { ...content, licenseName: "Example" } },
    requirements: [{ id: "check", type: "manual", translationKey: "example.key" }] as Array<Record<string, unknown>>,
  }],
});

describe("compliance catalog domain", () => {
  it("loads the real catalog and supports its lookups", () => {
    expect(complianceCatalog.licenses.length).toBeGreaterThan(0);
    expect(findLegalRequirement("CH")?.defaultLanguage).toBe("de");
    expect(findLicense("de-sks")?.countryCode).toBe("DE");
    expect(legalLanguages("CH")).toEqual(["de", "fr", "it", "en"]);
    expect(licenseLanguages("de-sks")).toEqual(["de"]);
  });

  it("rejects duplicate country, license, and per-license requirement IDs", () => {
    const duplicateCountry = fixture();
    duplicateCountry.legalLogbookRequirements.push(duplicateCountry.legalLogbookRequirements[0]);
    expect(() => createComplianceCatalog(duplicateCountry)).toThrow(/country IDs must be unique/);

    const duplicateLicense = fixture();
    duplicateLicense.licenses.push(duplicateLicense.licenses[0]);
    expect(() => createComplianceCatalog(duplicateLicense)).toThrow(/license IDs must be unique/);

    const duplicateRequirement = fixture();
    duplicateRequirement.licenses[0].requirements.push(duplicateRequirement.licenses[0].requirements[0]);
    expect(() => createComplianceCatalog(duplicateRequirement)).toThrow(/requirement IDs.*must be unique/);
  });

  it("rejects invalid tracked requirements", () => {
    const missingUnit = fixture();
    missingUnit.licenses[0].requirements = [{ id: "miles", type: "total-miles", threshold: 10, translationKey: "example.key" }];
    expect(() => createComplianceCatalog(missingUnit)).toThrow(/recognized unit/);

    const invalidThreshold = fixture();
    invalidThreshold.licenses[0].requirements = [{ id: "miles", type: "total-miles", threshold: 0, unit: "nautical-miles", translationKey: "example.key" }];
    expect(() => createComplianceCatalog(invalidThreshold)).toThrow(/positive threshold/);
  });

  it("allows manual progress metadata to be absent and strips author metadata", () => {
    const catalog = createComplianceCatalog(fixture());
    expect(catalog.licenses[0].requirements[0]).toEqual({ id: "check", type: "manual", translationKey: "example.key" });
    expect(catalog).not.toHaveProperty("_instructions");
  });

  it("falls back when the preferred translation is missing", () => {
    expect(withLanguageFallback({ en: "English" }, "fr", "en")).toBe("English");
    expect(withLanguageFallback({ en: "English", fr: "Français" }, "fr", "en")).toBe("Français");
  });

  it("returns empty results for unsupported countries and licenses", () => {
    expect(findLegalRequirement("XX")).toBeUndefined();
    expect(findLicense("missing")).toBeUndefined();
    expect(legalLanguages("XX")).toEqual([]);
    expect(licenseLanguages("missing")).toEqual([]);
  });
});
