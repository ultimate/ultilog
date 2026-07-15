import type { SheetCrewMember } from "./crew-member";
import type { StoredImage } from "./stored-image";
import type { LogLine } from "./log-line";

export type LogSheetSharePrivacy = "private" | "registered" | "public";

export type LogSheetShareSettings = {
  privacy: LogSheetSharePrivacy;
  includeMasterData: boolean;
  includePicture: boolean;
  includeLogLines: boolean;
  includeTechnicalLog: boolean;
  includeSkipper: boolean;
  includeCrew: boolean;
};

export const defaultLogSheetShareSettings: LogSheetShareSettings = {
  privacy: "private",
  includeMasterData: true,
  includePicture: true,
  includeLogLines: true,
  includeTechnicalLog: true,
  includeSkipper: true,
  includeCrew: true,
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
