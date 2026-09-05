import type { SheetCrewAssignment, SheetCrewMember } from "./crew-member";
import type { StoredImage } from "./stored-image";
import type { LogLine } from "./log-line";
import type { LogSheetMetrics } from "../domain/logbook/sheet-metrics";
import type { ScannerWarningDiagnostic } from "../lib/logbook-scanner/warning-codes";

export type LogSheetSharePrivacy = "private" | "registered" | "public";

export type LogSheetShareSettings = {
  masterData: LogSheetSharePrivacy;
  picture: LogSheetSharePrivacy;
  logLines: LogSheetSharePrivacy;
  metrics: LogSheetSharePrivacy;
  technicalLog: LogSheetSharePrivacy;
  skipper: LogSheetSharePrivacy;
  crew: LogSheetSharePrivacy;
};

export const defaultLogSheetShareSettings: LogSheetShareSettings = {
  masterData: "private",
  picture: "private",
  logLines: "private",
  metrics: "private",
  technicalLog: "private",
  skipper: "private",
  crew: "private",
};

export type TechnicalCheck = { status: string; text: string };
export type EngineHourCounter = { start?: number; end?: number };
export type ScannerWarning = ScannerWarningDiagnostic & { id: string; acknowledgedAt?: string };

export type LogSheet = {
  revision?: number;
  createdAt?: string;
  updatedAt?: string;
  id: string;
  title: string;
  status: "Draft" | "Locked";
  source?: "manual" | "scanner";
  verificationNote?: string;
  scannerWarnings?: ScannerWarning[];
  boatId: string;
  route: {
    from: string;
    to: string;
    departed: string;
    arrived: string;
  };
  crew: SheetCrewMember[];
  watchPlan: string[];
  technicalChecks: TechnicalCheck[];
  /** Cumulative hour-meter readings for each engine at the sheet boundaries. */
  engineHourCounters?: Record<string, EngineHourCounter>;
  image?: StoredImage;
  imageId?: string;
  lines: LogLine[];
  metrics?: LogSheetMetrics;
  share?: LogSheetShareSettings;
};

/** Write model for the focused sheet endpoints. */
export type FocusedLogSheet = Omit<LogSheet, "crew" | "lines"> & {
  crew: SheetCrewAssignment[];
};
