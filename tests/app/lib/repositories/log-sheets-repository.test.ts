import { describe, expect, it } from "vitest";
import { sampleBoats, sampleLogSheets } from "../../../fixtures/logbook";
import type { BoatRow, CrewMemberRow, LogLineRow, LogSheetRow } from "../../../../app/models/logbook";
import type { QueryableDatabase, QueryResult } from "../../../../app/lib/db/logbook-database";
import { LogSheetsRepository } from "../../../../app/lib/repositories/log-sheets-repository";

type QueryCall = { sql: string; values?: unknown[] };

class MockDatabase implements QueryableDatabase {
  calls: QueryCall[] = [];

  constructor(private resultRows: Record<string, unknown[]> = {}) {}

  placeholder(index: number) {
    return `$${index}`;
  }

  async query<Row>(sql: string, values?: unknown[]): Promise<QueryResult<Row>> {
    this.calls.push({ sql, values });
    const [key] = Object.keys(this.resultRows).filter((candidate) => sql.includes(candidate));
    return { rows: (key ? this.resultRows[key] : []) as Row[] };
  }
}

const boat = sampleBoats[0];
const sheet = sampleLogSheets[0];
const crew = sheet.crew[0];
const line = sheet.lines[0];

describe("LogSheetsRepository", () => {
  it("finds all log sheet rows", async () => {
    const row: LogSheetRow = logSheetRow();
    const db = new MockDatabase({ log_sheets: [row] });

    await expect(new LogSheetsRepository(db).findAll("repository-user")).resolves.toEqual([row]);
    expect(db.calls[0].sql).toContain("from log_sheets left join stored_images");
    expect(db.calls[0].sql).toContain("where log_sheets.owner_id = $1");
    expect(db.calls[0].values).toEqual(["repository-user"]);
  });

  it("deletes all log sheet rows", async () => {
    const db = new MockDatabase();

    await new LogSheetsRepository(db).deleteAll("repository-user");
    expect(db.calls).toEqual([{ sql: "delete from log_sheets where owner_id = $1", values: ["repository-user"] }]);
  });

  it("inserts a log sheet with nested values serialized", async () => {
    const db = new MockDatabase();

    await new LogSheetsRepository(db).insert(sheet, "repository-user");

    expect(db.calls[0].sql).toContain("insert into log_sheets");
    expect(db.calls[0].values).toEqual([`repository-user:${sheet.id}`, sheet.title, sheet.status, null, null, null, `repository-user:${sheet.boatId}`, JSON.stringify({}), JSON.stringify(sheet.route), JSON.stringify({}), JSON.stringify({}), JSON.stringify([]), JSON.stringify(sheet.watchPlan), JSON.stringify(sheet.technicalChecks), JSON.stringify({}), null, "repository-user", 9, 54, 63, 635, 1, 635, 635, "private", 0, 0, 0, 0, 0, 0, 0]);
  });

  it("maps relational rows back to a persisted logbook", () => {
    const boatRow: BoatRow = { ...boat, flag_state: boat.flagState, home_port: boat.homePort, yacht_data: JSON.stringify(boat.yachtData), deviation_table: JSON.stringify(boat.deviationTable) };
    const sheetRow = logSheetRow();
    const crewRow: CrewMemberRow = { sheet_id: sheet.id, crew_member_id: "luca-frei-swiss", sort_order: 0, ...crew, embarkation_datetime: crew.embarkationDateTime, embarkation_position: crew.embarkationPosition, disembarkation_datetime: crew.disembarkationDateTime, disembarkation_position: crew.disembarkationPosition };
    const lineRow: LogLineRow = logLineRow();

    expect(LogSheetsRepository.toLogbook([boatRow], [sheetRow], [crewRow], [lineRow])).toEqual({
      boats: [{ ...boat, archived: false }],
      crewMembers: [],
      sheets: [{ ...sheet, engineHourCounters: {}, metrics: { motorMiles: 0, sailMiles: 0, totalMiles: 0, durationMinutes: null, motorHours: 0, overallDurationMinutes: null, motionDurationMinutes: 0 }, share: { masterData: "private", picture: "private", logLines: "private", metrics: "private", technicalLog: "private", skipper: "private", crew: "private" }, crew: [{ ...crew, isPrimary: false }], lines: [line] }],
    });
  });

  it("persists and maps cumulative engine hour counters", async () => {
    const counters = { "main-engine": { start: 120.5, end: 123.25 } };
    const db = new MockDatabase();

    await new LogSheetsRepository(db).insert({ ...sheet, engineHourCounters: counters }, "repository-user");

    expect(db.calls[0].values).toContain(JSON.stringify(counters));
    const mapped = LogSheetsRepository.toLogbook([], [logSheetRow({ engine_hour_counters: JSON.stringify(counters) })], [], []);
    expect(mapped.sheets[0].engineHourCounters).toEqual(counters);
  });

  it("persists and maps optional scanner metadata", async () => {
    const scannerSheet = { ...sheet, source: "scanner" as const, verificationNote: "Reviewed OCR fields", scannerWarnings: [{ id: "warning-1", message: "Missing signature" }] };
    const db = new MockDatabase();

    await new LogSheetsRepository(db).insert(scannerSheet, "repository-user");

    expect(db.calls[0].values).toContain(scannerSheet.source);
    expect(db.calls[0].values).toContain(scannerSheet.verificationNote);
    expect(db.calls[0].values).toContain(JSON.stringify(scannerSheet.scannerWarnings));

    const sheetRow = logSheetRow({ source: scannerSheet.source, verification_note: scannerSheet.verificationNote, scanner_warnings: JSON.stringify(scannerSheet.scannerWarnings) });
    expect(LogSheetsRepository.toLogbook([], [sheetRow], [], []).sheets[0]).toMatchObject({
      source: scannerSheet.source,
      verificationNote: scannerSheet.verificationNote,
      scannerWarnings: scannerSheet.scannerWarnings,
    });
  });

  it("persists and maps stored images", async () => {
    const image = { id: "sheet-image", data: "base64-sheet", mimeType: "image/webp", width: 1024, height: 768 };
    const db = new MockDatabase();

    await new LogSheetsRepository(db).insert({ ...sheet, image }, "repository-user");

    expect(db.calls[0].values?.slice(15, 17)).toEqual([image.id, "repository-user"]);

    const boatRow: BoatRow = { ...boat, flag_state: boat.flagState, home_port: boat.homePort, yacht_data: JSON.stringify(boat.yachtData), deviation_table: JSON.stringify(boat.deviationTable), image_data: "base64-boat", image_mime_type: "image/png", image_width: 640, image_height: 480 };
    const sheetRow = logSheetRow({ image_id: image.id, image_data: image.data, image_mime_type: image.mimeType, image_width: image.width, image_height: image.height });
    const crewRow: CrewMemberRow = { sheet_id: sheet.id, crew_member_id: "luca-frei-swiss", sort_order: 0, ...crew, embarkation_datetime: crew.embarkationDateTime, embarkation_position: crew.embarkationPosition, disembarkation_datetime: crew.disembarkationDateTime, disembarkation_position: crew.disembarkationPosition, image_data: "base64-crew", image_mime_type: "image/jpeg", image_width: 320, image_height: 240 };

    const crewProfileRow: CrewMemberRow = { ...crewRow, id: "luca-frei-swiss", is_primary: 1 };

    expect(LogSheetsRepository.toLogbook([boatRow], [sheetRow], [crewRow], [], [crewProfileRow])).toMatchObject({
      boats: [{ image: { data: "base64-boat", mimeType: "image/png", width: 640, height: 480 } }],
      crewMembers: [{ image: { data: "base64-crew", mimeType: "image/jpeg", width: 320, height: 240 } }],
      sheets: [{ image, crew: [{ image: { data: "base64-crew", mimeType: "image/jpeg", width: 320, height: 240 } }] }],
    });
  });
});

function logSheetRow(overrides: Partial<LogSheetRow> = {}): LogSheetRow {
  return {
    id: sheet.id,
    title: sheet.title,
    status: sheet.status,
    boat_id: sheet.boatId,
    skipper: JSON.stringify({}),
    route: JSON.stringify(sheet.route),
    weather_briefing: JSON.stringify({}),
    day_summary: JSON.stringify({}),
    remarks: JSON.stringify([]),
    watch_plan: JSON.stringify(sheet.watchPlan),
    technical_checks: JSON.stringify(sheet.technicalChecks),
    ...overrides,
  };
}

function logLineRow(): LogLineRow {
  const { position, weatherRemark, temperatureUnit, logNm, windDirection, windStrength, windUnit, waves, seaUnit, tideUnit, compassCourse, magneticCourse, trueCourse, windDrift, courseThroughWater, currentDrift, courseOverGround, speedKn, sailMiles, sailNote, motorMiles, motorHours, motorNote, ...rest } = line;
  return { ...rest, sheet_id: sheet.id, sort_order: 0, position_name: position, weather_remark: weatherRemark, temperature_unit: temperatureUnit, log_nm: logNm, wind_direction: windDirection, wind_strength: windStrength, wind_unit: windUnit, waves, sea_unit: seaUnit, tide_unit: tideUnit, compass_course: compassCourse, magnetic_course: magneticCourse, true_course: trueCourse, wind_drift: windDrift, course_through_water: courseThroughWater, current_drift: currentDrift, course_over_ground: courseOverGround, speed_kn: speedKn, sail_miles: sailMiles, sail_note: sailNote, motor_miles: motorMiles, motor_hours: motorHours, motor_note: motorNote };
}
