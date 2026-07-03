import type { ScannerResult } from "../../models/logbook-scanner";

export type ScannerProviderInput = {
  files: {
    name: string;
    type: string;
    buffer: Buffer;
  }[];
};

export type ScannerProvider = {
  extractLogbookDraft(input: ScannerProviderInput): Promise<ScannerResult>;
};
