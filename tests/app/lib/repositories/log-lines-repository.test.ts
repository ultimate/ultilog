import { describe, expect, it } from "vitest";
import { sampleLogSheets } from "../../../../resources/sample-data/logbook";
import type { LogLineRow } from "../../../../app/models/logbook";
import type { QueryableDatabase, QueryResult } from "../../../../app/lib/db/logbook-database";
import { LogLinesRepository } from "../../../../app/lib/repositories/log-lines-repository";

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

const sheet = sampleLogSheets[0];
const line = sheet.lines[0];

describe("LogLinesRepository", () => {
  it("finds all log line rows", async () => {
    const row: LogLineRow = { ...line, sheet_id: sheet.id, sort_order: 0, log_nm: line.logNm, magnetic_course: line.magneticCourse, sea_state: line.seaState };
    const db = new MockDatabase({ log_lines: [row] });

    await expect(new LogLinesRepository(db).findAll()).resolves.toEqual([row]);
    expect(db.calls[0].sql).toContain("from log_lines join log_sheets");
    expect(db.calls[0].sql).toContain("where log_sheets.owner_id = $1");
    expect(db.calls[0].values).toEqual(["legacy-user"]);
  });

  it("deletes all log line rows", async () => {
    const db = new MockDatabase();

    await new LogLinesRepository(db).deleteAll();
    expect(db.calls).toEqual([{ sql: "delete from log_lines where sheet_id in (select id from log_sheets where owner_id = $1)", values: ["legacy-user"] }]);
  });

  it("inserts a log line", async () => {
    const db = new MockDatabase();

    await new LogLinesRepository(db).insert(sheet.id, 0, line);

    expect(db.calls[0].sql).toContain("insert into log_lines");
    expect(db.calls[0].values).toEqual([`legacy-user:${sheet.id}`, 0, line.time, line.position, line.latitude, line.longitude, line.logNm, line.course, line.magneticCourse, line.seaState, line.barometer, line.wind, line.weather, line.sails, line.engine, line.remarks]);
  });
});
