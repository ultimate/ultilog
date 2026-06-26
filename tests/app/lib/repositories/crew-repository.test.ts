import { describe, expect, it } from "vitest";
import { sampleLogSheets } from "../../../../resources/sample-data/logbook";
import type { CrewMemberRow } from "../../../../app/models/logbook";
import type { QueryableDatabase, QueryResult } from "../../../../app/lib/db/logbook-database";
import { CrewRepository } from "../../../../app/lib/repositories/crew-repository";

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
const crew = sheet.crew[0];

describe("CrewRepository", () => {
  it("finds all crew rows", async () => {
    const row: CrewMemberRow = { sheet_id: sheet.id, crew_member_id: "luca-frei-swiss", sort_order: 0, ...crew };
    const db = new MockDatabase({ crew_members: [row] });

    await expect(new CrewRepository(db).findAll()).resolves.toEqual([row]);
    expect(db.calls[0].sql).toContain("from sheet_crew_members");
    expect(db.calls[0].sql).toContain("join crew_members");
    expect(db.calls[0].sql).toContain("where log_sheets.owner_id = $1");
    expect(db.calls[0].values).toEqual(["legacy-user"]);
  });

  it("deletes all crew rows", async () => {
    const db = new MockDatabase();

    await new CrewRepository(db).deleteAll();
    expect(db.calls).toEqual([
      { sql: "delete from sheet_crew_members where sheet_id in (select id from log_sheets where owner_id = $1)", values: ["legacy-user"] },
      { sql: "delete from crew_members where owner_id = $1", values: ["legacy-user"] },
    ]);
  });

  it("inserts a crew member", async () => {
    const db = new MockDatabase();

    await new CrewRepository(db).insert(sheet.id, 0, crew);

    expect(db.calls[0].sql).toContain("insert into crew_members");
    expect(db.calls[0].values).toEqual(["legacy-user-luca-frei-swiss", crew.name, crew.nationality, crew.role, "legacy-user"]);
    expect(db.calls[1].sql).toContain("insert into sheet_crew_members");
    expect(db.calls[1].values).toEqual([sheet.id, "legacy-user-luca-frei-swiss", 0, crew.embarkation, crew.disembarkation]);
  });
});
