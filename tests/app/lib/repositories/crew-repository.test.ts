import { beforeEach, describe, expect, it } from "vitest";
import { sampleLogSheets } from "../../../../resources/sample-data/logbook";
import type { CrewMemberRow } from "../../../../app/models/logbook";
import type { QueryableDatabase, QueryResult } from "../../../../app/lib/db/logbook-database";
import { CrewRepository } from "../../../../app/lib/repositories/crew-repository";
import { encryptCrewField } from "../../../../app/lib/crypto/crew-encryption";

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
const testMasterKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("CrewRepository", () => {
  beforeEach(() => {
    process.env.CREW_ENCRYPTION_MASTER_KEY = testMasterKey;
    delete process.env.CREW_DATA_ENCRYPTION_KEY;
  });
  it("finds all crew rows", async () => {
    const row: CrewMemberRow = { sheet_id: sheet.id, crew_member_id: "legacy-user:luca-frei-swiss", sort_order: 0, ...crew, name: encryptCrewField("legacy-user", "legacy-user:luca-frei-swiss", "name", crew.name), nationality: encryptCrewField("legacy-user", "legacy-user:luca-frei-swiss", "nationality", crew.nationality), role: encryptCrewField("legacy-user", "legacy-user:luca-frei-swiss", "role", crew.role), address: encryptCrewField("legacy-user", "legacy-user:luca-frei-swiss", "address", crew.address ?? ""), certificate: encryptCrewField("legacy-user", "legacy-user:luca-frei-swiss", "certificate", crew.certificate ?? ""), embarkation_datetime: crew.embarkationDateTime, embarkation_position: crew.embarkationPosition, disembarkation_datetime: crew.disembarkationDateTime, disembarkation_position: crew.disembarkationPosition };
    const decryptedRow = { ...row, name: crew.name, nationality: crew.nationality, role: crew.role, address: crew.address ?? "", certificate: crew.certificate ?? "" };
    const db = new MockDatabase({ crew_members: [row] });

    await expect(new CrewRepository(db).findAll()).resolves.toEqual([decryptedRow]);
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
    expect(db.calls[0].values?.[0]).toBe("legacy-user:luca-frei-swiss");
    expect(db.calls[0].values?.slice(6)).toEqual([crew.isPrimary ? 1 : 0, "legacy-user"]);
    for (const [index, plaintext] of [crew.name, crew.nationality, crew.role, crew.address ?? "", crew.certificate ?? ""].entries()) {
      expect(db.calls[0].values?.[index + 1]).not.toBe(plaintext);
      expect(db.calls[0].values?.[index + 1]).toEqual(expect.stringMatching(/^\{"v":1,"alg":"AES-256-GCM","kid":"crew-pii-v1",/));
    }
    expect(db.calls[1].sql).toContain("insert into sheet_crew_members");
    expect(db.calls[1].values).toEqual([`legacy-user:${sheet.id}`, "legacy-user:luca-frei-swiss", 0, crew.embarkationPosition, crew.disembarkationPosition, crew.embarkationDateTime, crew.embarkationPosition, crew.disembarkationDateTime, crew.disembarkationPosition]);
  });
});
