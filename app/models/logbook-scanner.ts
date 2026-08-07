import type { LineFormField } from "./logbook-forms";

export type ScannedLogLine = Partial<Record<LineFormField, string>>;

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
