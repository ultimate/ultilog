import catalogJson from "../../content/compliance/catalog.json";
import type { TranslationKey } from "../../lib/i18n";

export type ComplianceSection = {
  id: string;
  heading: string;
  citation: string;
};

export type LocalizedLegalContent = {
  title: string;
  authority: string;
  sourceUrl: string;
  checkedAt: string;
  effectiveFrom: string;
  sections: ComplianceSection[];
};

export type LocalizedLicenseContent = LocalizedLegalContent & { licenseName: string };

export type RequirementFilters = { propulsion?: string; withinYears?: number };
export type ManualRequirement = {
  id: string;
  type: "manual";
  translationKey: TranslationKey;
  threshold?: number;
  filters?: RequirementFilters | null;
  unit?: "days" | "nautical-miles";
};
export type TrackedRequirement = {
  id: string;
  type: Exclude<ProgressType, "manual">;
  translationKey: TranslationKey;
  threshold: number;
  filters?: RequirementFilters | null;
  unit: "days" | "nautical-miles";
};
export type Requirement = ManualRequirement | TrackedRequirement;

export type LegalRequirement = {
  countryCode: string;
  defaultLanguage: string;
  translations: Record<string, LocalizedLegalContent>;
};
export type License = {
  id: string;
  countryCode: string;
  variant?: string;
  defaultLanguage: string;
  content: Record<string, LocalizedLicenseContent>;
  requirements: Requirement[];
};
export type ComplianceCatalog = {
  legalLogbookRequirements: LegalRequirement[];
  licenses: License[];
};

export type ProgressType =
  | "manual"
  | "sail-miles"
  | "motor-miles"
  | "total-miles"
  | "days-sailing"
  | "days-underway"
  | "days-at-sea";

const progressTypes = new Set<ProgressType>([
  "manual", "sail-miles", "motor-miles", "total-miles",
  "days-sailing", "days-underway", "days-at-sea",
]);
const units = new Set(["days", "nautical-miles"]);
const fail = (message: string): never => { throw new Error(`Invalid compliance catalog: ${message}`); };
const object = (value: unknown, at: string): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : fail(`${at} must be an object`);
const string = (value: unknown, at: string): string => typeof value === "string" ? value : fail(`${at} must be a string`);
const array = (value: unknown, at: string): unknown[] => Array.isArray(value) ? value : fail(`${at} must be an array`);
const unique = (values: string[], at: string) => {
  if (new Set(values).size !== values.length) fail(`${at} must be unique`);
};

function localized(value: unknown, at: string, license: boolean): LocalizedLegalContent | LocalizedLicenseContent {
  const raw = object(value, at);
  const sourceUrl = string(raw.sourceUrl, `${at}.sourceUrl`);
  if (!sourceUrl.startsWith("https://")) fail(`${at}.sourceUrl must use https`);
  const result = {
    ...(license ? { licenseName: string(raw.licenseName, `${at}.licenseName`) } : {}),
    title: string(raw.title, `${at}.title`),
    authority: string(raw.authority, `${at}.authority`),
    sourceUrl,
    checkedAt: string(raw.checkedAt, `${at}.checkedAt`),
    effectiveFrom: string(raw.effectiveFrom, `${at}.effectiveFrom`),
    sections: array(raw.sections, `${at}.sections`).map((item, index) => {
      const section = object(item, `${at}.sections[${index}]`);
      return { id: string(section.id, `${at}.sections[${index}].id`), heading: string(section.heading, `${at}.sections[${index}].heading`), citation: string(section.citation, `${at}.sections[${index}].citation`) };
    }),
  };
  return result as LocalizedLegalContent | LocalizedLicenseContent;
}

function localizations(value: unknown, at: string, license: boolean) {
  return Object.fromEntries(Object.entries(object(value, at)).map(([language, content]) => [language, localized(content, `${at}.${language}`, license)]));
}

export function createComplianceCatalog(value: unknown): ComplianceCatalog {
  const raw = object(value, "catalog");
  const countries = array(raw.legalLogbookRequirements, "legalLogbookRequirements").map((item, index) => {
    const entry = object(item, `legalLogbookRequirements[${index}]`);
    const countryCode = string(entry.countryCode, `legalLogbookRequirements[${index}].countryCode`);
    if (!/^[A-Z]{2}$/.test(countryCode)) fail(`${countryCode} is not an uppercase ISO alpha-2 country code`);
    const defaultLanguage = string(entry.defaultLanguage, `${countryCode}.defaultLanguage`);
    const translations = localizations(entry.translations, `${countryCode}.translations`, false) as Record<string, LocalizedLegalContent>;
    if (!translations[defaultLanguage]) fail(`${countryCode} has no ${defaultLanguage} default translation`);
    return { countryCode, defaultLanguage, translations };
  });
  unique(countries.map(({ countryCode }) => countryCode), "country IDs");

  const licenses = array(raw.licenses, "licenses").map((item, index) => {
    const entry = object(item, `licenses[${index}]`);
    const id = string(entry.id, `licenses[${index}].id`);
    const countryCode = string(entry.countryCode, `${id}.countryCode`);
    if (!/^[A-Z]{2}$/.test(countryCode)) fail(`${countryCode} is not an uppercase ISO alpha-2 country code`);
    const defaultLanguage = string(entry.defaultLanguage, `${id}.defaultLanguage`);
    const content = localizations(entry.content, `${id}.content`, true) as Record<string, LocalizedLicenseContent>;
    if (!content[defaultLanguage]) fail(`${id} has no ${defaultLanguage} default translation`);
    const requirements = array(entry.requirements, `${id}.requirements`).map((item, requirementIndex) => {
      const requirement = object(item, `${id}.requirements[${requirementIndex}]`);
      const type = string(requirement.type, `${id}.requirements[${requirementIndex}].type`) as ProgressType;
      if (!progressTypes.has(type)) fail(`${id} has unrecognized progress type ${type}`);
      const base = { id: string(requirement.id, `${id}.requirements[${requirementIndex}].id`), type, translationKey: string(requirement.translationKey, `${id}.requirements[${requirementIndex}].translationKey`) as TranslationKey };
      let filters: RequirementFilters | null | undefined = requirement.filters == null ? requirement.filters : {};
      if (requirement.filters != null) {
        const rawFilters = object(requirement.filters, `${base.id}.filters`);
        filters = {
          ...(rawFilters.propulsion === undefined ? {} : { propulsion: string(rawFilters.propulsion, `${base.id}.filters.propulsion`) }),
          ...(rawFilters.withinYears === undefined ? {} : { withinYears: typeof rawFilters.withinYears === "number" ? rawFilters.withinYears : fail(`${base.id}.filters.withinYears must be a number`) }),
        };
      }
      if (type === "manual") return { ...base, ...(requirement.threshold === undefined ? {} : { threshold: requirement.threshold as number }), ...(filters === undefined ? {} : { filters }), ...(requirement.unit === undefined ? {} : { unit: requirement.unit as "days" | "nautical-miles" }) } as ManualRequirement;
      if (typeof requirement.threshold !== "number" || !Number.isFinite(requirement.threshold) || requirement.threshold <= 0) fail(`${base.id} must have a positive threshold`);
      if (typeof requirement.unit !== "string" || !units.has(requirement.unit)) fail(`${base.id} must have a recognized unit`);
      return { ...base, threshold: requirement.threshold, unit: requirement.unit, ...(filters === undefined ? {} : { filters }) } as TrackedRequirement;
    });
    unique(requirements.map(({ id: requirementId }) => requirementId), `requirement IDs in ${id}`);
    return { id, countryCode, ...(entry.variant === undefined ? {} : { variant: string(entry.variant, `${id}.variant`) }), defaultLanguage, content, requirements };
  });
  unique(licenses.map(({ id }) => id), "license IDs");
  return { legalLogbookRequirements: countries, licenses };
}

export const complianceCatalog = createComplianceCatalog(catalogJson);

export function findLegalRequirement(countryCode: string) {
  return complianceCatalog.legalLogbookRequirements.find((entry) => entry.countryCode === countryCode);
}
export function findLicense(licenseId: string) {
  return complianceCatalog.licenses.find((license) => license.id === licenseId);
}
export function legalLanguages(countryCode: string): string[] {
  return Object.keys(findLegalRequirement(countryCode)?.translations ?? {});
}
export function licenseLanguages(licenseId: string): string[] {
  return Object.keys(findLicense(licenseId)?.content ?? {});
}
export function withLanguageFallback<T>(content: Record<string, T>, preferredLanguage: string | undefined, defaultLanguage: string): T | undefined {
  return (preferredLanguage ? content[preferredLanguage] : undefined) ?? content[defaultLanguage];
}
