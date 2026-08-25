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

  it("resolves every requirement label in every application language", () => {
    for (const requirement of complianceCatalog.licenses.flatMap(({ requirements }) => requirements)) {
      for (const dictionary of Object.values(translations)) {
        expect(dictionary[requirement.translationKey]).toBeTruthy();
      }
    }
  });
});
