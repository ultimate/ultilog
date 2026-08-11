import { normalizeTechnicalCheck } from "../../domain/logbook/technical-log";
import { calculateLogSheetMetrics } from "../../domain/logbook/sheet-metrics";
import { defaultLogSheetShareSettings, normalizeDeviationTable, normalizeWindDriftTable, type Boat, type BoatRow, type CrewMemberRow, type LogLine, type LogLineRow, type LogSheet, type LogSheetRow, type PersistedLogbook, type StoredLogSheet } from "../../models/logbook";
import type { QueryableDatabase } from "../db/logbook-database";
import { imageFromRow, imageValues, scopedId, unscopedId } from "./boats-repository";

export class LogSheetsRepository {
  constructor(private db: QueryableDatabase) {}

  async findAll(ownerId: string) {
    const rows = (await this.db.query<LogSheetRow>(`select log_sheets.*, stored_images.data as image_data, stored_images.mime_type as image_mime_type, stored_images.width as image_width, stored_images.height as image_height from log_sheets left join stored_images on stored_images.id = log_sheets.image_id and stored_images.owner_id = log_sheets.owner_id where log_sheets.owner_id = ${this.db.placeholder(1)}`, [ownerId])).rows;
    return rows.sort((left, right) => routeStart(right).localeCompare(routeStart(left)) || left.title.localeCompare(right.title));
  }

  async findById(id: string, ownerId: string) {
    return (await this.db.query<LogSheetRow>(`select log_sheets.*, stored_images.data as image_data, stored_images.mime_type as image_mime_type, stored_images.width as image_width, stored_images.height as image_height from log_sheets left join stored_images on stored_images.id = log_sheets.image_id and stored_images.owner_id = log_sheets.owner_id where log_sheets.id = ${this.db.placeholder(1)} and log_sheets.owner_id = ${this.db.placeholder(2)} limit 1`, [scopedId(ownerId, id), ownerId])).rows[0];
  }

  async upsert(sheet: LogSheet, ownerId: string, motionStationaryThresholdNm = 0.1) {
    const existing = await this.findById(sheet.id, ownerId);
    if (existing) await this.db.query(`delete from log_sheets where id = ${this.db.placeholder(1)} and owner_id = ${this.db.placeholder(2)}`, [scopedId(ownerId, sheet.id), ownerId]);
    await this.insert(sheet, ownerId, motionStationaryThresholdNm);
  }

  async delete(id: string, ownerId: string) {
    await this.db.query(`delete from log_sheets where id = ${this.db.placeholder(1)} and owner_id = ${this.db.placeholder(2)}`, [scopedId(ownerId, id), ownerId]);
  }

  async findSharedByScopedId(scopedSheetId: string) {
    return (await this.db.query<LogSheetRow>(`select log_sheets.*, stored_images.data as image_data, stored_images.mime_type as image_mime_type, stored_images.width as image_width, stored_images.height as image_height from log_sheets left join stored_images on stored_images.id = log_sheets.image_id and stored_images.owner_id = log_sheets.owner_id where log_sheets.id = ${this.db.placeholder(1)} and log_sheets.share_privacy <> 'private' limit 1`, [scopedSheetId])).rows[0];
  }

  async findSharedByUnscopedId(sheetId: string) {
    return (await this.db.query<LogSheetRow>(`select log_sheets.*, stored_images.data as image_data, stored_images.mime_type as image_mime_type, stored_images.width as image_width, stored_images.height as image_height from log_sheets left join stored_images on stored_images.id = log_sheets.image_id and stored_images.owner_id = log_sheets.owner_id where (log_sheets.id = ${this.db.placeholder(1)} or log_sheets.id like ${this.db.placeholder(2)}) and log_sheets.share_privacy <> 'private' limit 1`, [sheetId, `%:${sheetId}`])).rows[0];
  }

  async deleteAll(ownerId: string) {
    await this.db.query(`delete from log_sheets where owner_id = ${this.db.placeholder(1)}`, [ownerId]);
  }

  async insert(sheet: LogSheet, ownerId: string, motionStationaryThresholdNm = 0.1) {
    const metrics = calculateLogSheetMetrics(sheet.lines, sheet.route, { stationaryDistanceThresholdNm: motionStationaryThresholdNm });
    await this.db.query(
      `insert into log_sheets (id, title, status, source, verification_note, scanner_warnings, boat_id, skipper, route, weather_briefing, day_summary, remarks, watch_plan, technical_checks, image_id, owner_id, motor_miles, sail_miles, total_miles, duration_minutes, motor_hours, overall_duration_minutes, motion_duration_minutes, share_privacy, share_master_data, share_picture, share_loglines, share_metrics, share_technical_log, share_skipper, share_crew) values (${this.values(31)})`,
      [scopedId(ownerId, sheet.id), sheet.title, sheet.status, sheet.source ?? null, sheet.verificationNote ?? null, sheet.scannerWarnings ? JSON.stringify(sheet.scannerWarnings) : null, scopedId(ownerId, sheet.boatId), JSON.stringify({}), JSON.stringify(sheet.route), JSON.stringify({}), JSON.stringify({}), JSON.stringify([]), JSON.stringify(sheet.watchPlan), JSON.stringify(sheet.technicalChecks), sheet.imageId ?? sheet.image?.id ?? null, ownerId, metrics.motorMiles, metrics.sailMiles, metrics.totalMiles, metrics.durationMinutes, metrics.motorHours, metrics.overallDurationMinutes, metrics.motionDurationMinutes, overallPrivacy(sheet.share), privacyFor(sheet.share?.masterData), privacyFor(sheet.share?.picture), privacyFor(sheet.share?.logLines), privacyFor(sheet.share?.metrics), privacyFor(sheet.share?.technicalLog), privacyFor(sheet.share?.skipper), privacyFor(sheet.share?.crew)],
    );
  }


  async updateMetrics(sheet: Pick<LogSheet, "id" | "route">, lines: LogLine[], ownerId: string, motionStationaryThresholdNm = 0.1) {
    const metrics = calculateLogSheetMetrics(lines, sheet.route, { stationaryDistanceThresholdNm: motionStationaryThresholdNm });
    await this.db.query(
      `update log_sheets set motor_miles = ${this.db.placeholder(1)}, sail_miles = ${this.db.placeholder(2)}, total_miles = ${this.db.placeholder(3)}, duration_minutes = ${this.db.placeholder(4)}, motor_hours = ${this.db.placeholder(5)}, overall_duration_minutes = ${this.db.placeholder(6)}, motion_duration_minutes = ${this.db.placeholder(7)} where id = ${this.db.placeholder(8)}`,
      [metrics.motorMiles, metrics.sailMiles, metrics.totalMiles, metrics.durationMinutes, metrics.motorHours, metrics.overallDurationMinutes, metrics.motionDurationMinutes, scopedId(ownerId, sheet.id)],
    );
  }

  static toLogbook(boatRows: BoatRow[], sheetRows: LogSheetRow[], crewRows: CrewMemberRow[], lineRows: LogLineRow[], crewProfileRows: CrewMemberRow[] = []): PersistedLogbook {
    const crewBySheet = groupBy(crewRows, (crew) => crew.sheet_id);
    const linesBySheet = groupBy(lineRows, (line) => line.sheet_id);
    const boats: Boat[] = boatRows.map((boat) => ({
      id: unscopedId(boat.id),
      archived: Boolean(boat.archived),
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
      ...(boat.engines?.length ? { engines: boat.engines } : {}),
      ...(boat.wind_drift_table == null ? {} : { windDriftTable: normalizeWindDriftTable(parseJson<NonNullable<Boat["windDriftTable"]>>(boat.wind_drift_table)) }),
      ...(boat.image_id ? { imageId: boat.image_id } : {}),
      ...(imageFromRow(boat) ? { image: imageFromRow(boat) } : {}),
    }));
    const crewDetails = (crew: CrewMemberRow) => ({ ...(crew.date_of_birth === undefined ? {} : { dateOfBirth: crew.date_of_birth }), ...(crew.place_of_birth === undefined ? {} : { placeOfBirth: crew.place_of_birth }), ...(crew.gender === undefined ? {} : { gender: crew.gender }), ...(crew.identity_document_type === undefined ? {} : { identityDocumentType: crew.identity_document_type }), ...(crew.identity_document_number === undefined ? {} : { identityDocumentNumber: crew.identity_document_number }), ...(crew.identity_document_issuing_date === undefined ? {} : { identityDocumentIssuingDate: crew.identity_document_issuing_date }), ...(crew.identity_document_expiry_date === undefined ? {} : { identityDocumentExpiryDate: crew.identity_document_expiry_date }) });
    const crewMembers = crewProfileRows.map((crew) => ({ id: unscopedId(crew.crew_member_id ?? crew.id), name: crew.name, ...crewDetails(crew), nationality: crew.nationality, role: crew.role, address: crew.address ?? "", certificate: crew.certificate ?? "", isPrimary: Boolean(crew.is_primary), ...(crew.image_id ? { imageId: crew.image_id } : {}), ...(imageFromRow(crew) ? { image: imageFromRow(crew) } : {}) }));
    const sheets: LogSheet[] = sheetRows.map((sheet) => ({
      ...mapStoredSheet(sheet),
      crew: (crewBySheet.get(sheet.id) ?? []).map(({ sheet_id, crew_member_id, sort_order, is_primary, embarkation_datetime, embarkation_position, disembarkation_datetime, disembarkation_position, image_data, image_mime_type, image_width, image_height, date_of_birth, place_of_birth, identity_document_type, identity_document_number, identity_document_issuing_date, identity_document_expiry_date, ...crew }) => ({ ...crew, ...(date_of_birth === undefined ? {} : { dateOfBirth: date_of_birth }), ...(place_of_birth === undefined ? {} : { placeOfBirth: place_of_birth }), ...(identity_document_type === undefined ? {} : { identityDocumentType: identity_document_type }), ...(identity_document_number === undefined ? {} : { identityDocumentNumber: identity_document_number }), ...(identity_document_issuing_date === undefined ? {} : { identityDocumentIssuingDate: identity_document_issuing_date }), ...(identity_document_expiry_date === undefined ? {} : { identityDocumentExpiryDate: identity_document_expiry_date }), id: unscopedId(crew_member_id), isPrimary: Boolean(is_primary), embarkationDateTime: embarkation_datetime, embarkationPosition: embarkation_position, disembarkationDateTime: disembarkation_datetime, disembarkationPosition: disembarkation_position, ...(crew.image_id ? { imageId: crew.image_id } : {}), ...(imageFromRow({ image_id: crew.image_id, image_data, image_mime_type, image_width, image_height }) ? { image: imageFromRow({ image_data, image_mime_type, image_width, image_height }) } : {}) })),
      lines: (linesBySheet.get(sheet.id) ?? []).map(({ sheet_id, sort_order, position_name, weather_remark, log_nm, wind_direction, wind_strength, wind_unit, temperature_unit, waves, sea_unit, tide_unit, compass_course, magnetic_course, true_course, wind_drift, course_through_water, current_drift, course_over_ground, speed_kn, sail_miles, sail_note, motor_miles, motor_hours, engineHours, motor_note, ...line }) => ({
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
        ...(Object.keys(engineHours ?? {}).length ? { engineHours } : {}),
        motorHours: Object.keys(engineHours ?? {}).length ? Object.values(engineHours ?? {}).reduce((sum, hours) => sum + Number(hours), 0) : Number(motor_hours) || 0,
        motorNote: motor_note,
      })),
    }));
    return { boats, crewMembers, sheets };
  }

  private values(count: number) {
    return Array.from({ length: count }, (_, index) => this.db.placeholder(index + 1)).join(", ");
  }
}

function routeStart(sheet: LogSheetRow) {
  return parseJson<Partial<LogSheet["route"]>>(sheet.route)?.departed ?? "";
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
    status: sheet.status,
    ...(sheet.source ? { source: sheet.source } : {}),
    ...(sheet.verification_note ? { verificationNote: sheet.verification_note } : {}),
    ...(sheet.scanner_warnings ? { scannerWarnings: parseJson<string[]>(sheet.scanner_warnings) } : {}),
    boatId: unscopedId(sheet.boat_id),
    route: parseJson<LogSheet["route"]>(sheet.route),
    watchPlan: parseJson<string[]>(sheet.watch_plan),
    technicalChecks: parseJson<unknown[]>(sheet.technical_checks).map(normalizeTechnicalCheck).filter((item): item is NonNullable<typeof item> => Boolean(item)),
    ...(sheet.image_id ? { imageId: sheet.image_id } : {}),
    ...(imageFromRow(sheet) ? { image: imageFromRow(sheet) } : {}),
    metrics: {
      motorMiles: Number(sheet.motor_miles) || 0,
      sailMiles: Number(sheet.sail_miles) || 0,
      totalMiles: Number(sheet.total_miles) || 0,
      durationMinutes: sheet.duration_minutes == null ? null : Number(sheet.duration_minutes),
      motorHours: Number(sheet.motor_hours) || 0,
      overallDurationMinutes: sheet.overall_duration_minutes == null ? (sheet.duration_minutes == null ? null : Number(sheet.duration_minutes)) : Number(sheet.overall_duration_minutes),
      motionDurationMinutes: Number(sheet.motion_duration_minutes) || 0,
    },
    share: {
      masterData: privacyFromRow(sheet.share_master_data, sheet.share_privacy),
      picture: privacyFromRow(sheet.share_picture, sheet.share_privacy),
      logLines: privacyFromRow(sheet.share_loglines, sheet.share_privacy),
      metrics: privacyFromRow(sheet.share_metrics, sheet.share_privacy),
      technicalLog: privacyFromRow(sheet.share_technical_log, sheet.share_privacy),
      skipper: privacyFromRow(sheet.share_skipper, sheet.share_privacy),
      crew: privacyFromRow(sheet.share_crew, sheet.share_privacy),
    },
  };
}

function privacyFor(value: NonNullable<LogSheet["share"]>[keyof NonNullable<LogSheet["share"]>] | undefined) {
  if (value === "public") return 1;
  if (value === "registered") return 2;
  return 0;
}

function overallPrivacy(share: LogSheet["share"]) {
  const settings = share ?? defaultLogSheetShareSettings;
  if (Object.values(settings).includes("public")) return "public";
  if (Object.values(settings).includes("registered")) return "registered";
  return "private";
}

function privacyFromRow(value: unknown, legacyPrivacy: NonNullable<LogSheet["share"]>[keyof NonNullable<LogSheet["share"]>] | null | undefined) {
  if (value === "public" || value === "registered" || value === "private") return value;
  if (value === 2 || value === "2") return "registered";
  if (value === 1 || value === "1" || value === true) return legacyPrivacy === "registered" ? "registered" : "public";
  return "private";
}
