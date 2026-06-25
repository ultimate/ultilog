import { describe, expect, it } from "vitest";
import { sampleBoats, sampleLogSheets } from "../../../resources/sample-data/logbook";
import type { BoatRow, CrewMemberRow, LogLineRow, LogSheetRow } from "../../models/logbook";
import type { QueryableDatabase, QueryResult } from "../db/logbook-database";
import { BoatsRepository } from "./boats-repository";
import { CrewRepository } from "./crew-repository";
import { LogLinesRepository } from "./log-lines-repository";
import { LogSheetsRepository } from "./log-sheets-repository";

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

describe("BoatsRepository", () => {
  it("finds all boat rows", async () => {
    const row: BoatRow = { ...boat, flag_state: boat.flagState, home_port: boat.homePort, yacht_data: boat.yachtData };
    const db = new MockDatabase({ boats: [row] });

    await expect(new BoatsRepository(db).findAll()).resolves.toEqual([row]);
    expect(db.calls[0].sql).toBe("select * from boats order by name");
  });

  it("deletes all boat rows", async () => {
    const db = new MockDatabase();

    await new BoatsRepository(db).deleteAll();
    expect(db.calls).toEqual([{ sql: "delete from boats", values: undefined }]);
  });

  it("inserts a boat with serialized yacht data", async () => {
    const db = new MockDatabase();

    await new BoatsRepository(db).insert(boat);

    expect(db.calls[0].sql).toContain("insert into boats");
    expect(db.calls[0].sql).toContain("$1, $2, $3, $4, $5, $6, $7, $8, $9");
    expect(db.calls[0].values).toEqual([boat.id, boat.name, boat.type, boat.registration, boat.flagState, boat.homePort, boat.owner, boat.dimensions, JSON.stringify(boat.yachtData)]);
  });
});

describe("LogSheetsRepository", () => {
  it("finds all log sheet rows", async () => {
    const row: LogSheetRow = logSheetRow();
    const db = new MockDatabase({ log_sheets: [row] });

    await expect(new LogSheetsRepository(db).findAll()).resolves.toEqual([row]);
    expect(db.calls[0].sql).toBe("select * from log_sheets order by date_range desc, title");
  });

  it("deletes all log sheet rows", async () => {
    const db = new MockDatabase();

    await new LogSheetsRepository(db).deleteAll();
    expect(db.calls).toEqual([{ sql: "delete from log_sheets", values: undefined }]);
  });

  it("inserts a log sheet with nested values serialized", async () => {
    const db = new MockDatabase();

    await new LogSheetsRepository(db).insert(sheet);

    expect(db.calls[0].sql).toContain("insert into log_sheets");
    expect(db.calls[0].values).toEqual([sheet.id, sheet.title, sheet.dateRange, sheet.status, sheet.boatId, JSON.stringify(sheet.skipper), JSON.stringify(sheet.route), JSON.stringify(sheet.weatherBriefing), JSON.stringify(sheet.daySummary), JSON.stringify(sheet.remarks), JSON.stringify(sheet.watchPlan), JSON.stringify(sheet.technicalChecks)]);
  });

  it("maps relational rows back to a persisted logbook", () => {
    const boatRow: BoatRow = { ...boat, flag_state: boat.flagState, home_port: boat.homePort, yacht_data: JSON.stringify(boat.yachtData) };
    const sheetRow = logSheetRow();
    const crewRow: CrewMemberRow = { sheet_id: sheet.id, sort_order: 0, ...crew };
    const lineRow: LogLineRow = { ...line, sheet_id: sheet.id, sort_order: 0, log_nm: line.logNm, magnetic_course: line.magneticCourse, sea_state: line.seaState };

    expect(LogSheetsRepository.toLogbook([boatRow], [sheetRow], [crewRow], [lineRow])).toEqual({
      boats: [boat],
      sheets: [{ ...sheet, crew: [crew], lines: [line] }],
    });
  });
});

describe("CrewRepository", () => {
  it("finds all crew rows", async () => {
    const row: CrewMemberRow = { sheet_id: sheet.id, sort_order: 0, ...crew };
    const db = new MockDatabase({ crew_members: [row] });

    await expect(new CrewRepository(db).findAll()).resolves.toEqual([row]);
    expect(db.calls[0].sql).toBe("select * from crew_members order by sheet_id, sort_order");
  });

  it("deletes all crew rows", async () => {
    const db = new MockDatabase();

    await new CrewRepository(db).deleteAll();
    expect(db.calls).toEqual([{ sql: "delete from crew_members", values: undefined }]);
  });

  it("inserts a crew member", async () => {
    const db = new MockDatabase();

    await new CrewRepository(db).insert(sheet.id, 0, crew);

    expect(db.calls[0].sql).toContain("insert into crew_members");
    expect(db.calls[0].values).toEqual([sheet.id, 0, crew.name, crew.nationality, crew.role, crew.embarkation, crew.disembarkation]);
  });
});

describe("LogLinesRepository", () => {
  it("finds all log line rows", async () => {
    const row: LogLineRow = { ...line, sheet_id: sheet.id, sort_order: 0, log_nm: line.logNm, magnetic_course: line.magneticCourse, sea_state: line.seaState };
    const db = new MockDatabase({ log_lines: [row] });

    await expect(new LogLinesRepository(db).findAll()).resolves.toEqual([row]);
    expect(db.calls[0].sql).toContain("from log_lines order by sheet_id, sort_order");
  });

  it("deletes all log line rows", async () => {
    const db = new MockDatabase();

    await new LogLinesRepository(db).deleteAll();
    expect(db.calls).toEqual([{ sql: "delete from log_lines", values: undefined }]);
  });

  it("inserts a log line", async () => {
    const db = new MockDatabase();

    await new LogLinesRepository(db).insert(sheet.id, 0, line);

    expect(db.calls[0].sql).toContain("insert into log_lines");
    expect(db.calls[0].values).toEqual([sheet.id, 0, line.time, line.position, line.latitude, line.longitude, line.logNm, line.course, line.magneticCourse, line.seaState, line.barometer, line.wind, line.weather, line.sails, line.engine, line.remarks]);
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
