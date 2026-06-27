import { describe, expect, it } from "vitest";
import { sampleBoats } from "../../../../resources/sample-data/logbook";
import type { BoatRow } from "../../../../app/models/logbook";
import type { QueryableDatabase, QueryResult } from "../../../../app/lib/db/logbook-database";
import { BoatsRepository } from "../../../../app/lib/repositories/boats-repository";

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

describe("BoatsRepository", () => {
  it("finds all boat rows", async () => {
    const row: BoatRow = { ...boat, flag_state: boat.flagState, home_port: boat.homePort, yacht_data: boat.yachtData, deviation_table: boat.deviationTable };
    const db = new MockDatabase({ boats: [row] });

    await expect(new BoatsRepository(db).findAll()).resolves.toEqual([row]);
    expect(db.calls[0].sql).toContain("from boats where owner_id = $1 order by name");
    expect(db.calls[0].values).toEqual(["legacy-user"]);
  });

  it("deletes all boat rows", async () => {
    const db = new MockDatabase();

    await new BoatsRepository(db).deleteAll();
    expect(db.calls).toEqual([{ sql: "delete from boats where owner_id = $1", values: ["legacy-user"] }]);
  });

  it("inserts a boat with serialized yacht data", async () => {
    const db = new MockDatabase();

    await new BoatsRepository(db).insert(boat);

    expect(db.calls[0].sql).toContain("insert into boats");
    expect(db.calls[0].sql).toContain("$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11");
    expect(db.calls[0].values).toEqual([`legacy-user:${boat.id}`, boat.name, boat.type, boat.registration, boat.flagState, boat.homePort, boat.owner, boat.dimensions, JSON.stringify(boat.yachtData), JSON.stringify(boat.deviationTable), "legacy-user"]);
  });
});
