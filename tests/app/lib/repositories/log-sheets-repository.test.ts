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
    expect(db.calls[0].values).toEqual([`legacy-user:${sheet.id}`, sheet.title, sheet.dateRange, sheet.status, `legacy-user:${sheet.boatId}`, JSON.stringify(sheet.skipper), JSON.stringify(sheet.route), JSON.stringify(sheet.weatherBriefing), JSON.stringify(sheet.daySummary), JSON.stringify(sheet.remarks), JSON.stringify(sheet.watchPlan), JSON.stringify(sheet.technicalChecks), "legacy-user"]);
  });

  it("maps relational rows back to a persisted logbook", () => {
    const boatRow: BoatRow = { ...boat, flag_state: boat.flagState, home_port: boat.homePort, yacht_data: JSON.stringify(boat.yachtData) };
    const sheetRow = logSheetRow();
    const crewRow: CrewMemberRow = { sheet_id: sheet.id, crew_member_id: "luca-frei-swiss", sort_order: 0, ...crew };
    const lineRow: LogLineRow = { ...line, sheet_id: sheet.id, sort_order: 0, log_nm: line.logNm, magnetic_course: line.magneticCourse, sea_state: line.seaState };

    expect(LogSheetsRepository.toLogbook([boatRow], [sheetRow], [crewRow], [lineRow])).toEqual({
      boats: [boat],
      sheets: [{ ...sheet, crew: [crew], lines: [line] }],
    });
  });
});

function logSheetRow(): LogSheetRow {
  return {
    id: sheet.id,
    title: sheet.title,
    date_range: sheet.dateRange,
    status: sheet.status,
    boat_id: sheet.boatId,
    skipper: JSON.stringify(sheet.skipper),
    route: JSON.stringify(sheet.route),
    weather_briefing: JSON.stringify(sheet.weatherBriefing),
    day_summary: JSON.stringify(sheet.daySummary),
    remarks: JSON.stringify(sheet.remarks),
    watch_plan: JSON.stringify(sheet.watchPlan),
    technical_checks: JSON.stringify(sheet.technicalChecks),
  };
}
