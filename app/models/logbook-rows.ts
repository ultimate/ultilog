import type { Boat, CrewMember, LogLine, LogSheet, LogSheetSharePrivacy, SheetCrewMember } from "./logbook";

export type StoredLogSheet = Omit<LogSheet, "crew" | "lines">;

export type ImageRowFields = {
  image_data?: string | null;
  image_mime_type?: string | null;
  image_width?: number | null;
  image_height?: number | null;
};

export type BoatRow = Omit<Boat, "archived" | "flagState" | "homePort" | "yachtData" | "deviationTable" | "windDriftTable" | "image" | "logfactor" | "engines"> & ImageRowFields & {
  engines?: Boat["engines"];
  archived?: number | boolean | null;
  flag_state: string;
  home_port: string;
  logfactor?: number | null;
  yacht_data: unknown;
  deviation_table: unknown;
  wind_drift_table?: unknown;
};

export type LogSheetRow = ImageRowFields & {
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
  motor_miles?: number | null;
  sail_miles?: number | null;
  total_miles?: number | null;
  duration_minutes?: number | null;
  motor_hours?: number | null;
  overall_duration_minutes?: number | null;
  motion_duration_minutes?: number | null;
  share_privacy?: LogSheetSharePrivacy | null;
  share_master_data?: LogSheetSharePrivacy | number | boolean | null;
  share_picture?: LogSheetSharePrivacy | number | boolean | null;
  share_loglines?: LogSheetSharePrivacy | number | boolean | null;
  share_metrics?: LogSheetSharePrivacy | number | boolean | null;
  share_technical_log?: LogSheetSharePrivacy | number | boolean | null;
  share_skipper?: LogSheetSharePrivacy | number | boolean | null;
  share_crew?: LogSheetSharePrivacy | number | boolean | null;
  owner_id?: string;
};

export type CrewMemberRow = Omit<SheetCrewMember, "embarkationDateTime" | "embarkationPosition" | "disembarkationDateTime" | "disembarkationPosition" | "image"> & ImageRowFields & {
  date_of_birth?: string;
  place_of_birth?: string;
  gender?: string;
  identity_document_type?: string;
  identity_document_number?: string;
  identity_document_issuing_date?: string;
  identity_document_expiry_date?: string;
  embarkation_datetime: string;
  embarkation_position: string;
  disembarkation_datetime: string;
  disembarkation_position: string;
  sheet_id: string;
  crew_member_id: string;
  sort_order: number;
  is_primary?: number;
};

export type LogLineRow = Omit<LogLine, "position" | "weatherRemark" | "temperature" | "temperatureUnit" | "logNm" | "windDirection" | "windStrength" | "windUnit" | "waves" | "seaUnit" | "tideUnit" | "compassCourse" | "magneticCourse" | "trueCourse" | "windDrift" | "courseThroughWater" | "currentDrift" | "courseOverGround" | "speedKn" | "sailMiles" | "sailNote" | "motorMiles" | "motorHours" | "engineHours" | "motorNote"> & {
  engineHours?: Record<string, number>;
  sheet_id: string;
  sort_order: number;
  position_name: string;
  log_nm: number;
  weather_remark: string;
  temperature: number;
  temperature_unit: LogLine["temperatureUnit"];
  wind_direction: string;
  wind_strength: number;
  wind_unit: LogLine["windUnit"];
  waves: number;
  sea_unit: LogLine["seaUnit"];
  tide_unit: LogLine["tideUnit"];
  compass_course: number;
  magnetic_course: number;
  true_course: number;
  wind_drift: number;
  course_through_water: number;
  current_drift: number;
  course_over_ground: number;
  speed_kn: number;
  sail_miles: number;
  sail_note: string;
  motor_miles: number;
  motor_hours: number;
  motor_note: string;
};
