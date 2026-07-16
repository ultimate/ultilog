import type { SheetCrewMember } from "./crew-member";
import type { StoredImage } from "./stored-image";
import type { LogLine } from "./log-line";

export type LogSheetSharePrivacy = "private" | "registered" | "public";

export type LogSheetShareSettings = {
  masterData: LogSheetSharePrivacy;
  picture: LogSheetSharePrivacy;
  logLines: LogSheetSharePrivacy;
  technicalLog: LogSheetSharePrivacy;
  skipper: LogSheetSharePrivacy;
  crew: LogSheetSharePrivacy;
};

export const defaultLogSheetShareSettings: LogSheetShareSettings = {
  masterData: "private",
  picture: "private",
  logLines: "private",
  technicalLog: "private",
  skipper: "private",
  crew: "private",
};

export type LogSheet = {
  id: string;
  title: string;
  dateRange: string;
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
  technicalChecks: string[];
  image?: StoredImage;
  lines: LogLine[];
  share?: LogSheetShareSettings;
};
