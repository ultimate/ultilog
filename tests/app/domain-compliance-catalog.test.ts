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
    missingUnit.licenses[0].requirements = [{ id: "miles", type: "miles", threshold: 10, translationKey: "example.key" }];
    expect(() => createComplianceCatalog(missingUnit)).toThrow(/recognized unit/);

    const invalidThreshold = fixture();
    invalidThreshold.licenses[0].requirements = [{ id: "miles", type: "miles", threshold: 0, unit: "nautical-miles", translationKey: "example.key" }];
    expect(() => createComplianceCatalog(invalidThreshold)).toThrow(/positive threshold/);
  });

  it.each(["boatType", "propulsion"])("validates lowercase %s independently", key => {
    const input = fixture();
    input.licenses[0].requirements = [{ id: "miles", type: "miles", threshold: 10, unit: "nautical-miles", translationKey: "example.key", filters: { boatType: "sail", propulsion: "motor" } }];
    expect(createComplianceCatalog(input).licenses[0].requirements[0].filters).toEqual({ boatType: "sail", propulsion: "motor" });
    input.licenses[0].requirements[0].filters = { [key]: "Sail" };
    expect(() => createComplianceCatalog(input)).toThrow(/must be sail or motor/);
  });

  it("preserves explicit units on quantitative manual requirements and rejects unknown units", () => {
    const input = fixture();
    input.licenses[0].requirements = [{ id: "after-exam", type: "manual", threshold: 700, unit: "nautical-miles", translationKey: "example.key" }];
    expect(createComplianceCatalog(input).licenses[0].requirements[0]).toMatchObject({ threshold: 700, unit: "nautical-miles" });
    input.licenses[0].requirements[0].unit = "kilometers";
    expect(() => createComplianceCatalog(input)).toThrow(/recognized unit/);
  });

  it("validates date window boundaries, reference kinds, and conflicting legacy filters", () => {
    const input = fixture();
    Object.assign(input.licenses[0], { referenceDateKind: "theory-exam" });
    const dateWindow = { from: { yearOffset: -4, boundary: "year-start" }, through: { yearOffset: 4, boundary: "year-end" } };
    input.licenses[0].requirements[0].filters = { dateWindow };
    expect(createComplianceCatalog(input).licenses[0]).toMatchObject({ referenceDateKind: "theory-exam", requirements: [{ filters: { dateWindow } }] });
    for (const filters of [
      { dateWindow, withinYears: 4 },
      { dateWindow: { ...dateWindow, from: { yearOffset: -1.5, boundary: "date" } } },
      { dateWindow: { from: dateWindow.from } },
      { dateWindow: { ...dateWindow, through: { yearOffset: 4, boundary: "unknown" } } },
      { dateWindow: { from: dateWindow.through, through: dateWindow.from } },
    ]) {
      input.licenses[0].requirements[0].filters = filters;
      expect(() => createComplianceCatalog(input)).toThrow(/Invalid compliance catalog/);
    }
    input.licenses[0].requirements[0].filters = { dateWindow };
    Object.assign(input.licenses[0], { referenceDateKind: "unknown" });
    expect(() => createComplianceCatalog(input)).toThrow(/referenceDateKind/);
  });

  it("allows manual progress metadata to be absent and strips author metadata", () => {
    const catalog = createComplianceCatalog(fixture());
    expect(catalog.licenses[0].requirements[0]).toEqual({ id: "check", type: "manual", translationKey: "example.key" });
    expect(catalog).not.toHaveProperty("_instructions");
  });

  it("allows optional legal metadata to be absent", () => {
    const input = fixture();
    const translation = input.legalLogbookRequirements[0].translations.en as Partial<typeof content>;
    delete translation.authority;
    delete translation.checkedAt;
    delete translation.effectiveFrom;
    expect(createComplianceCatalog(input).legalLogbookRequirements[0].translations.en).not.toHaveProperty("authority");
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
