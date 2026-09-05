import type { LineFormField } from "./logbook-forms";

export type ScannedLogLine = Partial<Record<LineFormField, string>>;

export type ScannedLogSheetDraft = {
  title?: string;
  dateText?: string;
  route?: {
    from?: string;
    to?: string;
    departed?: string;
    arrived?: string;
  };
  technicalChecks?: { status: string; text: string }[];
  engineHourCounters?: { engineId: string; start: string; end: string }[];
  lines: ScannedLogLine[];
};

export type ScannerResult = {
  draft: ScannedLogSheetDraft;
  warnings: string[];
};
