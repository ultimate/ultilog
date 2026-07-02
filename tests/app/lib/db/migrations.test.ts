import { describe, expect, it } from "vitest";
import { runMigrations } from "../../../../app/lib/db/migrations";
import type { QueryableDatabase, QueryResult } from "../../../../app/lib/db/logbook-database";

class DuplicateColumnDatabase implements QueryableDatabase {
  calls: string[] = [];
  placeholder(index: number) {
    return `$${index}`;
  }
  async query<Row>(sql: string): Promise<QueryResult<Row>> {
    this.calls.push(sql);
    if (sql.includes("select id from schema_migrations")) {
      return { rows: [{ id: "001_initial_schema" }, { id: "002_users_and_ownership" }, { id: "003_boat_deviation_table" }, { id: "004_crew_profiles" }, { id: "005_unique_user_names" }, { id: "006_primary_crew_profiles" }, { id: "007_user_groups" }, { id: "008_split_crew_assignment_fields" }] as Row[] };
    }
    if (sql.startsWith("alter table log_lines add column wind_direction")) {
      throw new Error("duplicate column name: wind_direction");
    }
    return { rows: [] };
  }
}

describe("runMigrations", () => {
  it("marks the log line column migration applied after duplicate columns from a partial prior run", async () => {
    const db = new DuplicateColumnDatabase();

    await expect(runMigrations(db)).resolves.toBeUndefined();

    expect(db.calls).toContain("insert into schema_migrations (id) values ($1)");
  });
});
