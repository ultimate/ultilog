import { describe, expect, it } from "vitest";
import { sampleBoats, sampleLogSheets } from "../../../../resources/sample-data/logbook";
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

    await expect(new LogSheetsRepository(db).findAll()).resolves.toEqual([row]);
    expect(db.calls[0].sql).toBe("select * from log_sheets where owner_id = $1 order by date_range desc, title");
    expect(db.calls[0].values).toEqual(["legacy-user"]);
  });

  it("deletes all log sheet rows", async () => {
    const db = new MockDatabase();

    await new LogSheetsRepository(db).deleteAll();
    expect(db.calls).toEqual([{ sql: "delete from log_sheets where owner_id = $1", values: ["legacy-user"] }]);
  });

  it("inserts a log sheet with nested values serialized", async () => {
    const db = new MockDatabase();

    await new LogSheetsRepository(db).insert(sheet);

    expect(db.calls[0].sql).toContain("insert into log_sheets");
    expect(db.calls[0].values).toEqual([`legacy-user:${sheet.id}`, sheet.title, sheet.dateRange, sheet.status, null, null, null, `legacy-user:${sheet.boatId}`, JSON.stringify({}), JSON.stringify(sheet.route), JSON.stringify({}), JSON.stringify({}), JSON.stringify([]), JSON.stringify(sheet.watchPlan), JSON.stringify(sheet.technicalChecks), "legacy-user"]);
  });

  it("maps relational rows back to a persisted logbook", () => {
    const boatRow: BoatRow = { ...boat, flag_state: boat.flagState, home_port: boat.homePort, yacht_data: JSON.stringify(boat.yachtData), deviation_table: JSON.stringify(boat.deviationTable) };
    const sheetRow = logSheetRow();
    const crewRow: CrewMemberRow = { sheet_id: sheet.id, crew_member_id: "luca-frei-swiss", sort_order: 0, ...crew, embarkation_datetime: crew.embarkationDateTime, embarkation_position: crew.embarkationPosition, disembarkation_datetime: crew.disembarkationDateTime, disembarkation_position: crew.disembarkationPosition };
    const lineRow: LogLineRow = logLineRow();

    expect(LogSheetsRepository.toLogbook([boatRow], [sheetRow], [crewRow], [lineRow])).toEqual({
      boats: [boat],
      crewMembers: [],
      sheets: [{ ...sheet, crew: [{ ...crew, isPrimary: false }], lines: [line] }],
    });
  });

  it("persists and maps optional scanner metadata", async () => {
    const scannerSheet = { ...sheet, source: "scanner" as const, verificationNote: "Reviewed OCR fields", scannerWarnings: ["Missing signature"] };
    const db = new MockDatabase();

    await new LogSheetsRepository(db).insert(scannerSheet);

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
});

function logSheetRow(overrides: Partial<LogSheetRow> = {}): LogSheetRow {
  return {
    id: sheet.id,
    title: sheet.title,
    date_range: sheet.dateRange,
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
