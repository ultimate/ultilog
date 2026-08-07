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

class IsoDatetimeMigrationDatabase implements QueryableDatabase {
  calls: Array<{ sql: string; params?: unknown[] }> = [];
  placeholder(index: number) {
    return `$${index}`;
  }
  async query<Row>(sql: string, params?: unknown[]): Promise<QueryResult<Row>> {
    this.calls.push({ sql, params });
    if (sql.includes("select id from schema_migrations")) {
      return { rows: [
        { id: "001_initial_schema" },
        { id: "002_users_and_ownership" },
        { id: "003_boat_deviation_table" },
        { id: "004_crew_profiles" },
        { id: "005_unique_user_names" },
        { id: "006_primary_crew_profiles" },
        { id: "007_user_groups" },
        { id: "008_split_crew_assignment_fields" },
        { id: "009_log_line_column_types" },
        { id: "010_log_sheet_scanner_metadata" },
        { id: "011_log_line_issue_104_columns" },
        { id: "011_log_line_miles_column_names" },
        { id: "012_user_onboarding_completed_tasks" },
        { id: "013_user_view_preferences" },
        { id: "014_user_compliance_read" },
        { id: "015_user_preferences" },
        { id: "016_log_line_temperature_unit" },
        { id: "017_ensure_primary_crew_profiles" },
        { id: "018_password_reset_tokens" },
        { id: "018_stored_images" },
        { id: "019_email_verification_tokens" },
        { id: "020_boat_logfactor" },
        { id: "020_log_sheet_sharing" },
      ] as Row[] };
    }
    if (sql === "select id, route from log_sheets") {
      return { rows: [{ id: "sheet-1", route: JSON.stringify({ from: "A", to: "B", departed: "2026-07-21, 09:15", arrived: "2026-07-21T12:30:00+02:00" }) }] as Row[] };
    }
    if (sql === "select sheet_id, sort_order, time from log_lines") {
      return { rows: [{ sheet_id: "sheet-1", sort_order: 0, time: "2026-07-21T10:00" }] as Row[] };
    }
    if (sql === "select sheet_id, crew_member_id, sort_order, embarkation_datetime, disembarkation_datetime from sheet_crew_members") {
      return { rows: [{ sheet_id: "sheet-1", crew_member_id: "crew-1", sort_order: 0, embarkation_datetime: "2026-07-21T08:00", disembarkation_datetime: "" }] as Row[] };
    }
    return { rows: [] };
  }
}

class LegacyBoatEngineMigrationDatabase implements QueryableDatabase {
  calls: Array<{ sql: string; params?: unknown[] }> = [];
  placeholder(index: number) { return `$${index}`; }
  async query<Row>(sql: string, params?: unknown[]): Promise<QueryResult<Row>> {
    this.calls.push({ sql, params });
    if (sql.includes("select id from schema_migrations")) {
      return { rows: [{ id: "029_multi_engine_hours" }] as Row[] };
    }
    if (sql.includes("select boats.id as boat_id")) {
      return { rows: [
        { boat_id: "boat-1", yacht_data: JSON.stringify({ Manufacturer: "Yard", Engine: "Volvo Penta D2-55" }), engine_id: "boat-1:main-engine", model: "" },
        { boat_id: "boat-2", yacht_data: { Engine: "Legacy engine", Safety: "EPIRB" }, engine_id: "boat-2:main-engine", model: "Modern model" },
      ] as Row[] };
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

  it("normalizes legacy logsheet datetimes to ISO strings with UTC offsets", async () => {
    const db = new IsoDatetimeMigrationDatabase();

    await expect(runMigrations(db)).resolves.toBeUndefined();

    expect(db.calls).toContainEqual(expect.objectContaining({
      sql: "update log_sheets set route = $1 where id = $2",
      params: [JSON.stringify({ from: "A", to: "B", departed: "2026-07-21T09:15:00+00:00", arrived: "2026-07-21T12:30:00+02:00" }), "sheet-1"],
    }));
    expect(db.calls).toContainEqual(expect.objectContaining({
      sql: "update log_lines set time = $1 where sheet_id = $2 and sort_order = $3",
      params: ["2026-07-21T10:00:00+00:00", "sheet-1", 0],
    }));
    expect(db.calls).toContainEqual(expect.objectContaining({
      sql: "update sheet_crew_members set embarkation_datetime = $1, disembarkation_datetime = $2 where sheet_id = $3 and crew_member_id = $4 and sort_order = $5",
      params: ["2026-07-21T08:00:00+00:00", "", "sheet-1", "crew-1", 0],
    }));
  });

  it("moves the obsolete boat engine value to the first engine model", async () => {
    const db = new LegacyBoatEngineMigrationDatabase();

    await runMigrations(db);

    expect(db.calls).toContainEqual({ sql: "update engines set model = $1 where id = $2", params: ["Volvo Penta D2-55", "boat-1:main-engine"] });
    expect(db.calls).not.toContainEqual(expect.objectContaining({ params: ["Legacy engine", "boat-2:main-engine"] }));
    expect(db.calls).toContainEqual({ sql: "update boats set yacht_data = $1 where id = $2", params: [JSON.stringify({ Manufacturer: "Yard" }), "boat-1"] });
    expect(db.calls).toContainEqual({ sql: "update boats set yacht_data = $1 where id = $2", params: [JSON.stringify({ Safety: "EPIRB" }), "boat-2"] });
  });
});
