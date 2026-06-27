import type { SheetCrewMember } from "./crew-member";
import type { LogLine } from "./log-line";

export type LogSheet = {
  id: string;
  title: string;
  dateRange: string;
  status: "Draft" | "Ready for review" | "Signed digitally";
  boatId: string;
  skipper: {
    name: string;
    address: string;
    nationality: string;
    certificate: string;
  };
  route: {
    dayGoal: string;
    morningPosition: string;
    eveningPosition: string;
    from: string;
    to: string;
    departed: string;
    arrived: string;
  };
  weatherBriefing: {
    station: string;
    time: string;
    area: string;
    forecast: string;
    warnings: string;
  };
  daySummary: {
    area: string;
    nightHours: number;
    daysOnBoard: number;
    sailingMiles: number;
    motorMiles: number;
    outsideFb2Miles: number;
    engineHoursStart: number;
    engineHoursEnd: number;
  };
  remarks: string[];
  crew: SheetCrewMember[];
  watchPlan: string[];
  technicalChecks: string[];
  lines: LogLine[];
};
