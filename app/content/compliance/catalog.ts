import catalogData from "./catalog.json";
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

export type LocalizedLicenseContent = LocalizedLegalContent & {
  licenseName: string;
};

export type Requirement = {
  id: string;
  type: string;
  threshold: number;
  translationKey: TranslationKey;
  filters: { propulsion?: string; withinYears?: number } | null;
  unit?: "days" | "nautical-miles";
};

export type ComplianceCatalog = {
  legalLogbookRequirements: Array<{
    countryCode: string;
    defaultLanguage: string;
    translations: Record<string, LocalizedLegalContent>;
  }>;
  licenses: Array<{
    id: string;
    countryCode: string;
    variant: string;
    defaultLanguage: string;
    content: Record<string, LocalizedLicenseContent>;
    requirements: Requirement[];
  }>;
};

// JSON imports infer a closed union of the language keys present on each entry.
// Expose the deliberately open localized-content contract to consumers instead.
export const complianceCatalog = catalogData as unknown as ComplianceCatalog;
