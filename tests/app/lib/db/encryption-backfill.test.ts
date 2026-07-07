import { beforeEach, describe, expect, it } from "vitest";
import { decryptCrewField, encryptCrewField } from "../../../../app/lib/crypto/crew-encryption";
import { backfillCrewMemberEncryption } from "../../../../app/lib/db/encryption-backfill";
import type { QueryableDatabase, QueryResult } from "../../../../app/lib/db/logbook-database";

const testMasterKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

type CrewRow = {
  id: string;
  owner_id: string;
  name: string;
  role: string;
  address: string;
  nationality: string;
  certificate: string;
};

class MockDatabase implements QueryableDatabase {
  calls: { sql: string; values?: unknown[] }[] = [];

  constructor(private rows: CrewRow[]) {}

  placeholder(index: number) {
    return `$${index}`;
  }

  async query<Row>(sql: string, values?: unknown[]): Promise<QueryResult<Row>> {
    this.calls.push({ sql, values });
    if (sql.trim().toLowerCase().startsWith("select")) return { rows: this.rows.map((row) => ({ ...row })) as Row[] };

    const id = values?.at(-1) as string;
    const row = this.rows.find((candidate) => candidate.id === id);
    if (!row || !values) return { rows: [] };

    const setClause = sql.slice(sql.indexOf("set") + 3, sql.indexOf("where"));
    const fields = setClause.split(",").map((assignment) => assignment.trim().split(" = ")[0] as keyof CrewRow);
    fields.forEach((field, index) => {
      row[field] = values[index] as string;
    });
    return { rows: [] };
  }
}

describe("backfillCrewMemberEncryption", () => {
  beforeEach(() => {
    process.env.CREW_ENCRYPTION_MASTER_KEY = testMasterKey;
    delete process.env.CREW_DATA_ENCRYPTION_KEY;
  });

  it("encrypts plaintext crew member fields using owner, crew id, and field name", async () => {
    const rows = [{ id: "crew-1", owner_id: "owner-a", name: "Ada", role: "Engineer", address: "123 Main", nationality: "CH", certificate: "RYA" }];
    const db = new MockDatabase(rows);

    await backfillCrewMemberEncryption(db);

    expect(db.calls).toHaveLength(2);
    for (const field of ["name", "role", "address", "nationality", "certificate"] as const) {
      expect(rows[0][field]).toMatch(/^\{"v":1,"alg":"AES-256-GCM","kid":"crew-pii-v1",/);
      expect(decryptCrewField("owner-a", "crew-1", field, rows[0][field])).toBe({ name: "Ada", role: "Engineer", address: "123 Main", nationality: "CH", certificate: "RYA" }[field]);
    }
  });

  it("skips fields that are already encrypted JSON envelopes", async () => {
    const encryptedName = encryptCrewField("owner-a", "crew-1", "name", "Ada");
    const rows = [{ id: "crew-1", owner_id: "owner-a", name: encryptedName, role: "Engineer", address: "", nationality: "CH", certificate: "" }];
    const db = new MockDatabase(rows);

    await backfillCrewMemberEncryption(db);
    await backfillCrewMemberEncryption(db);

    expect(rows[0].name).toBe(encryptedName);
    expect(db.calls.filter((call) => call.sql.trim().toLowerCase().startsWith("update"))).toHaveLength(1);
  });
});
