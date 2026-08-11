import type { SheetCrewMember } from "./crew-member";
import type { StoredImage } from "./stored-image";
import type { LogLine } from "./log-line";
import type { LogSheetMetrics } from "../domain/logbook/sheet-metrics";

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

export type LogSheet = {
  revision?: number;
  createdAt?: string;
  updatedAt?: string;
  id: string;
  title: string;
  status: "Draft" | "Locked";
  source?: "manual" | "scanner";
  verificationNote?: string;
  scannerWarnings?: string[];
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
  image?: StoredImage;
  imageId?: string;
  lines: LogLine[];
  metrics?: LogSheetMetrics;
  share?: LogSheetShareSettings;
};
