import type { ScannerResult } from "../../models/logbook-scanner";
import type { Locale } from "../i18n/translations";

export type ScannerProviderInput = {
  /** A preference for interpreting ambiguous headings, never a language restriction. */
  languageHint?: Locale;
  files: {
    name: string;
    type: string;
    buffer: Buffer;
  }[];
};

export type ScannerProvider = {
  extractLogbookDraft(input: ScannerProviderInput): Promise<ScannerResult>;
};
