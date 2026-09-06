import type { ScannerResult } from "../../models/logbook-scanner";
import type { Locale } from "../i18n/translations";
import type { BoatEngine } from "../../models/boat";

export type ScannerTemplate = {
  /** Exact labels which should be matched against the technical-log section. */
  technicalChecks: string[];
  /** Stable engine identifiers and visible labels used to map hour-meter columns. */
  engines: Pick<BoatEngine, "id" | "name" | "label" | "role">[];
};

export type ScannerProviderInput = {
  /** A preference for interpreting ambiguous headings, never a language restriction. */
  languageHint?: Locale;
  template?: ScannerTemplate;
  files: {
    name: string;
    type: string;
    buffer: Buffer;
  }[];
};

export type ScannerProvider = {
  extractLogbookDraft(input: ScannerProviderInput): Promise<ScannerResult>;
};
