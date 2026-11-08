import { describe, expect, it } from "vitest";
import { complianceCatalog } from "../../../app/content/compliance/catalog";
import { translations } from "../../../app/lib/i18n";

const idsAreUnique = (ids: string[]) => new Set(ids).size === ids.length;

describe("compliance catalog authoring contract", () => {
  it("keeps persistent IDs unique and localized section IDs aligned", () => {
    expect(complianceCatalog.licenses.map(({ id }) => id)).toEqual([
      "ch-hochseeausweis-sail",
      "ch-hochseeausweis-motor",
      "ch-hochseeausweis-sail-addon",
      "ch-hochseeausweis-motor-addon",
      "de-sbf",
      "de-sks",
      "de-sss",
      "de-shs",
    ]);
    expect(idsAreUnique(complianceCatalog.licenses.map(({ id }) => id))).toBe(true);
    const requirementIds = complianceCatalog.licenses.flatMap(({ requirements }) => requirements.map(({ id }) => id));
    expect(idsAreUnique(requirementIds)).toBe(true);
    expect(requirementIds).toMatchSnapshot();

    for (const document of complianceCatalog.legalLogbookRequirements) {
      expect(document.translations[document.defaultLanguage]).toBeDefined();
      const sectionIds = Object.values(document.translations).map(({ sections }) => sections.map(({ id }) => id));
      expect(sectionIds.every((ids) => JSON.stringify(ids) === JSON.stringify(sectionIds[0]))).toBe(true);
      expect(idsAreUnique(sectionIds[0])).toBe(true);
    }
    for (const license of complianceCatalog.licenses) {
      expect(license.content[license.defaultLanguage]).toBeDefined();
      const sectionIds = Object.values(license.content).map(({ sections }) => sections.map(({ id }) => id));
      expect(sectionIds.every((ids) => JSON.stringify(ids) === JSON.stringify(sectionIds[0]))).toBe(true);
      expect(idsAreUnique(sectionIds[0])).toBe(true);
    }
  });

  it("provides a metric, numeric threshold, and unit for every tracked requirement", () => {
    for (const requirement of complianceCatalog.licenses.flatMap(({ requirements }) => requirements)) {
      expect(requirement.id).not.toBe("");
      expect(requirement.type).not.toBe("");
      expect(Number.isFinite(requirement.threshold)).toBe(true);
      if (requirement.type !== "manual") {
        expect(["days", "nautical-miles"]).toContain(requirement.unit);
      }
    }
  });

  it("uses explicit reference kinds and date windows for every Swiss temporal requirement", () => {
    for (const license of complianceCatalog.licenses.filter(license => license.countryCode === "CH")) {
      expect(license.referenceDateKind).toBe(license.id.endsWith("-addon") ? "extension-application" : "theory-exam");
      for (const requirement of license.requirements) {
        expect(requirement.filters?.withinYears).toBeUndefined();
        if (requirement.filters?.boatType) expect(requirement.filters.dateWindow).toBeDefined();
      }
    }
  });

  it("requires a handwritten logbook as a manual check on all four Swiss licenses", () => {
    const swiss = complianceCatalog.licenses.filter(license => license.countryCode === "CH");
    expect(swiss).toHaveLength(4);
    for (const license of swiss) {
      const checks = license.requirements.filter(requirement => requirement.translationKey === "compliance.requirement.handwrittenLogbook");
      expect(checks).toEqual([{ id: `${license.id}-handwritten-logbook`, type: "manual", threshold: 1, filters: null, translationKey: "compliance.requirement.handwrittenLogbook" }]);
      const source = license.content.de.sections.find(section => section.id === "annex-3-5-handwritten-logbook");
      expect(source?.citation).toContain("Artikel 7 und 8");
      expect(source?.citation).toContain("handschriftlich zu führen");
    }
    expect(complianceCatalog.licenses.filter(license => license.countryCode !== "CH").flatMap(license => license.requirements).some(requirement => requirement.translationKey === "compliance.requirement.handwrittenLogbook")).toBe(false);
  });

  it("resolves every requirement label in every application language", () => {
    for (const requirement of complianceCatalog.licenses.flatMap(({ requirements }) => requirements)) {
      for (const dictionary of Object.values(translations)) {
        expect(dictionary[requirement.translationKey]).toBeTruthy();
      }
    }
  });
});
