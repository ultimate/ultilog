import type { Boat, CrewMember, LogLine, LogSheet, SheetCrewMember } from "./logbook";

export type StoredLogSheet = Omit<LogSheet, "crew" | "lines">;

export type BoatRow = Omit<Boat, "flagState" | "homePort" | "yachtData" | "deviationTable"> & {
  flag_state: string;
  home_port: string;
  yacht_data: unknown;
  deviation_table: unknown;
};

export type LogSheetRow = {
  id: string;
  title: string;
  date_range: string;
  status: LogSheet["status"];
  boat_id: string;
  skipper: unknown;
  route: unknown;
  weather_briefing: unknown;
  day_summary: unknown;
  remarks: unknown;
  watch_plan: unknown;
  technical_checks: unknown;
};

export type CrewMemberRow = SheetCrewMember & {
  sheet_id: string;
  crew_member_id: string;
  sort_order: number;
  is_primary?: number;
};

export type LogLineRow = Omit<LogLine, "logNm" | "magneticCourse" | "seaState"> & {
  sheet_id: string;
  sort_order: number;
  log_nm: number;
  magnetic_course: string;
  sea_state: string;
};
