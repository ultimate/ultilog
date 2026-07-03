import type { LineForm } from "./logbook-forms";

export type ScannedLogLine = Partial<Record<keyof LineForm, string>>;

export type ScannedLogSheetDraft = {
  title?: string;
  dateRange?: string;
  route?: {
    from?: string;
    to?: string;
    departed?: string;
    arrived?: string;
  };
  lines: ScannedLogLine[];
};

export type ScannerResult = {
  draft: ScannedLogSheetDraft;
  warnings: string[];
};
