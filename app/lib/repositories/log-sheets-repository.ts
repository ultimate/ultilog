import { normalizeDeviationTable, type Boat, type BoatRow, type CrewMemberRow, type LogLineRow, type LogSheet, type LogSheetRow, type PersistedLogbook, type StoredLogSheet } from "../../models/logbook";
import type { QueryableDatabase } from "../db/logbook-database";
import { imageFromRow, imageValues, scopedId, unscopedId } from "./boats-repository";

export class LogSheetsRepository {
  constructor(private db: QueryableDatabase) {}

  async findAll(ownerId = "legacy-user") {
    return (await this.db.query<LogSheetRow>(`select * from log_sheets where owner_id = ${this.db.placeholder(1)} order by date_range desc, title`, [ownerId])).rows;
  }

  async deleteAll(ownerId = "legacy-user") {
    await this.db.query(`delete from log_sheets where owner_id = ${this.db.placeholder(1)}`, [ownerId]);
  }

  async insert(sheet: LogSheet, ownerId = "legacy-user") {
    await this.db.query(
      `insert into log_sheets (id, title, date_range, status, source, verification_note, scanner_warnings, boat_id, skipper, route, weather_briefing, day_summary, remarks, watch_plan, technical_checks, image_data, image_mime_type, image_width, image_height, owner_id) values (${this.values(20)})`,
      [scopedId(ownerId, sheet.id), sheet.title, sheet.dateRange, sheet.status, sheet.source ?? null, sheet.verificationNote ?? null, sheet.scannerWarnings ? JSON.stringify(sheet.scannerWarnings) : null, scopedId(ownerId, sheet.boatId), JSON.stringify({}), JSON.stringify(sheet.route), JSON.stringify({}), JSON.stringify({}), JSON.stringify([]), JSON.stringify(sheet.watchPlan), JSON.stringify(sheet.technicalChecks), ...imageValues(sheet.image), ownerId],
    );
  }

  static toLogbook(boatRows: BoatRow[], sheetRows: LogSheetRow[], crewRows: CrewMemberRow[], lineRows: LogLineRow[], crewProfileRows: CrewMemberRow[] = []): PersistedLogbook {
    const crewBySheet = groupBy(crewRows, (crew) => crew.sheet_id);
    const linesBySheet = groupBy(lineRows, (line) => line.sheet_id);
    const boats: Boat[] = boatRows.map((boat) => ({
      id: unscopedId(boat.id),
      name: boat.name,
      type: boat.type,
      registration: boat.registration,
      flagState: boat.flag_state,
      homePort: boat.home_port,
      owner: boat.owner,
      dimensions: boat.dimensions,
      logfactor: Number(boat.logfactor) > 0 ? Number(boat.logfactor) : 1,
      yachtData: parseJson<Record<string, string>>(boat.yacht_data),
      deviationTable: normalizeDeviationTable(parseJson<Boat["deviationTable"]>(boat.deviation_table ?? [])),
      ...(imageFromRow(boat) ? { image: imageFromRow(boat) } : {}),
    }));
    const crewMembers = crewProfileRows.map((crew) => ({ id: unscopedId(crew.crew_member_id ?? crew.id), name: crew.name, nationality: crew.nationality, role: crew.role, address: crew.address ?? "", certificate: crew.certificate ?? "", isPrimary: Boolean(crew.is_primary), ...(imageFromRow(crew) ? { image: imageFromRow(crew) } : {}) }));
    const sheets: LogSheet[] = sheetRows.map((sheet) => ({
      ...mapStoredSheet(sheet),
      crew: (crewBySheet.get(sheet.id) ?? []).map(({ sheet_id, crew_member_id, sort_order, is_primary, embarkation_datetime, embarkation_position, disembarkation_datetime, disembarkation_position, image_data, image_mime_type, image_width, image_height, ...crew }) => ({ ...crew, id: unscopedId(crew_member_id), isPrimary: Boolean(is_primary), embarkationDateTime: embarkation_datetime, embarkationPosition: embarkation_position, disembarkationDateTime: disembarkation_datetime, disembarkationPosition: disembarkation_position, ...(imageFromRow({ image_data, image_mime_type, image_width, image_height }) ? { image: imageFromRow({ image_data, image_mime_type, image_width, image_height }) } : {}) })),
      lines: (linesBySheet.get(sheet.id) ?? []).map(({ sheet_id, sort_order, position_name, weather_remark, log_nm, wind_direction, wind_strength, wind_unit, temperature_unit, waves, sea_unit, tide_unit, compass_course, magnetic_course, true_course, wind_drift, course_through_water, current_drift, course_over_ground, speed_kn, sail_miles, sail_note, motor_miles, motor_hours, motor_note, ...line }) => ({
        ...line,
        barometer: Number(line.barometer) || 0,
        weatherRemark: weather_remark ?? "",
        temperature: Number(line.temperature) || 0,
        temperatureUnit: temperature_unit ?? "°C",
        position: position_name,
        logNm: Number(log_nm) || 0,
        windDirection: wind_direction,
        windStrength: Number(wind_strength) || 0,
        windUnit: wind_unit,
        waves: Number(waves) || 0,
        seaUnit: sea_unit,
        tideUnit: tide_unit,
        compassCourse: Number(compass_course) || 0,
        magneticCourse: Number(magnetic_course) || 0,
        trueCourse: Number(true_course) || 0,
        windDrift: Number(wind_drift) || 0,
        courseThroughWater: Number(course_through_water) || 0,
        currentDrift: Number(current_drift) || 0,
        courseOverGround: Number(course_over_ground) || 0,
        speedKn: Number(speed_kn) || 0,
        sailMiles: Number(sail_miles) || 0,
        sailNote: sail_note,
        motorMiles: Number(motor_miles) || 0,
        motorHours: Number(motor_hours) || 0,
        motorNote: motor_note,
      })),
    }));
    return { boats, crewMembers, sheets };
  }

  private values(count: number) {
    return Array.from({ length: count }, (_, index) => this.db.placeholder(index + 1)).join(", ");
  }
}

function parseJson<T>(value: unknown): T {
  return typeof value === "string" ? JSON.parse(value) as T : value as T;
}

function groupBy<T>(items: T[], keyFor: (item: T) => string) {
  return items.reduce((groups, item) => {
    const key = keyFor(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
    return groups;
  }, new Map<string, T[]>());
}

function mapStoredSheet(sheet: LogSheetRow): StoredLogSheet {
  return {
    id: unscopedId(sheet.id),
    title: sheet.title,
    dateRange: sheet.date_range,
    status: sheet.status,
    ...(sheet.source ? { source: sheet.source } : {}),
    ...(sheet.verification_note ? { verificationNote: sheet.verification_note } : {}),
    ...(sheet.scanner_warnings ? { scannerWarnings: parseJson<string[]>(sheet.scanner_warnings) } : {}),
    boatId: unscopedId(sheet.boat_id),
    route: parseJson<LogSheet["route"]>(sheet.route),
    watchPlan: parseJson<string[]>(sheet.watch_plan),
    technicalChecks: parseJson<string[]>(sheet.technical_checks),
    ...(imageFromRow(sheet) ? { image: imageFromRow(sheet) } : {}),
  };
}
