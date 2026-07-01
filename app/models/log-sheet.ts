import type { SheetCrewMember } from "./crew-member";
import type { LogLine } from "./log-line";

export type LogSheet = {
  id: string;
  title: string;
  dateRange: string;
  status: "Draft" | "Locked";
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
  lines: LogLine[];
};
