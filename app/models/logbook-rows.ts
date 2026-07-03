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
  source?: LogSheet["source"] | null;
  verification_note?: string | null;
  scanner_warnings?: unknown;
  boat_id: string;
  skipper: unknown;
  route: unknown;
  weather_briefing: unknown;
  day_summary: unknown;
  remarks: unknown;
  watch_plan: unknown;
  technical_checks: unknown;
};

export type CrewMemberRow = Omit<SheetCrewMember, "embarkationDateTime" | "embarkationPosition" | "disembarkationDateTime" | "disembarkationPosition"> & {
  embarkation_datetime: string;
  embarkation_position: string;
  disembarkation_datetime: string;
  disembarkation_position: string;
  sheet_id: string;
  crew_member_id: string;
  sort_order: number;
  is_primary?: number;
};

export type LogLineRow = Omit<LogLine, "position" | "logNm" | "windDirection" | "windStrength" | "windUnit" | "seaState" | "seaUnit" | "tideUnit" | "magneticCourse" | "magneticCourseCorrected" | "trueCourse" | "driftAngle" | "courseThroughWater" | "currentDrift" | "courseOverGround" | "speedKn" | "sailSm" | "sailNote" | "motorSm" | "motorHours" | "motorNote"> & {
  sheet_id: string;
  sort_order: number;
  position_name: string;
  log_nm: number;
  wind_direction: string;
  wind_strength: number;
  wind_unit: LogLine["windUnit"];
  sea_state: number;
  sea_unit: LogLine["seaUnit"];
  tide_unit: LogLine["tideUnit"];
  magnetic_course: number;
  magnetic_course_corrected: number;
  true_course: number;
  drift_angle: number;
  course_through_water: number;
  current_drift: number;
  course_over_ground: number;
  speed_kn: number;
  sail_sm: number;
  sail_note: string;
  motor_sm: number;
  motor_hours: number;
  motor_note: string;
};
