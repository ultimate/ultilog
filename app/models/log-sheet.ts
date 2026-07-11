import type { SheetCrewMember } from "./crew-member";
import type { StoredImage } from "./stored-image";
import type { LogLine } from "./log-line";

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
};
