import { describe, expect, it } from "vitest";
import initSqlJs from "sql.js";
import { readFile } from "node:fs/promises";
import { normalizeBoatFlagStates, removeLegacyLogSheetDateRange, runMigrations, structureScannerWarnings } from "../../../../app/lib/db/migrations";
import type { QueryableDatabase, QueryResult } from "../../../../app/lib/db/logbook-database";
import { readMigrations, STRICT_STORAGE_FORMATS_MIGRATION_ID, STRUCTURED_SCANNER_WARNINGS_MIGRATION_ID, USER_COMPLIANCE_MIGRATION_ID } from "../../../../app/lib/db/schema";

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


class RemoveDateRangeDatabase implements QueryableDatabase {
  calls: Array<{ sql: string; params?: unknown[] }> = [];
  placeholder(index: number) { return `$${index}`; }
  async query<Row>(sql: string, params?: unknown[]): Promise<QueryResult<Row>> {
    this.calls.push({ sql, params });
    if (sql === "select id, date_range, route from log_sheets") return { rows: [{ id: "legacy-sheet", date_range: "14 May 2026", route: JSON.stringify({ from: "A", to: "B", departed: "", arrived: "" }) }] as Row[] };
    return { rows: [] };
  }
}

describe("runMigrations", () => {
  it("discovers migrations in order", async () => {
    const migrations = await readMigrations();
    expect(migrations.at(-1)?.id).toBe(STRICT_STORAGE_FORMATS_MIGRATION_ID);
    expect(migrations.find(({ id }) => id === USER_COMPLIANCE_MIGRATION_ID)?.sql).toContain("user_compliance_licenses");
    expect(migrations.find(({ id }) => id === STRUCTURED_SCANNER_WARNINGS_MIGRATION_ID)?.sql).toContain("scanner warning JSON");
  });
  it("normalizes legacy boat country names and emoji to ISO codes", async () => {
    const calls: Array<{ sql: string; params?: unknown[] }> = [];
    const db: QueryableDatabase = {
      placeholder: (index) => `?${index}`,
      query: async <Row>(sql: string, params?: unknown[]) => {
        calls.push({ sql, params });
        if (sql === "select id, flag_state from boats") return { rows: [
          { id: "name", flag_state: "Switzerland" },
          { id: "emoji", flag_state: "🇭🇷" },
          { id: "code", flag_state: "DE" },
          { id: "unknown", flag_state: "Pirate" },
        ] as Row[] };
        return { rows: [] };
      },
    };

    await normalizeBoatFlagStates(db);

    expect(calls.filter(({ sql }) => sql.startsWith("update boats"))).toEqual([
      { sql: "update boats set flag_state = ?1 where id = ?2", params: ["CH", "name"] },
      { sql: "update boats set flag_state = ?1 where id = ?2", params: ["HR", "emoji"] },
      { sql: "update boats set flag_state = ?1 where id = ?2", params: ["", "unknown"] },
    ]);
  });

  it("permanently converts legacy scanner warning arrays to structured records", async () => {
    const calls: Array<{ sql: string; params?: unknown[] }> = [];
    const db: QueryableDatabase = {
      placeholder: (index) => `$${index}`,
      query: async <Row>(sql: string, params?: unknown[]) => {
        calls.push({ sql, params });
        if (sql.startsWith("select id, scanner_warnings")) return { rows: [
          { id: "sheet-1", scanner_warnings: JSON.stringify(["Missing signature", "Check route"]) },
          { id: "sheet-2", scanner_warnings: JSON.stringify([{ id: "existing", message: "Already converted" }]) },
          { id: "sheet-3", scanner_warnings: JSON.stringify([{ id: "duplicate", code: "noRows" }, { id: "duplicate", code: "missingSheetTitle" }]) },
        ] as Row[] };
        return { rows: [] };
      },
    };

    await structureScannerWarnings(db);

    const updates = calls.filter(({ sql }) => sql.startsWith("update log_sheets"));
    expect(updates[0]?.params?.[1]).toBe("sheet-1");
    expect(JSON.parse(updates[0]?.params?.[0] as string)).toEqual([
      { id: expect.any(String), code: "scannerGenerated", fallbackMessage: "Missing signature" },
      { id: expect.any(String), code: "scannerGenerated", fallbackMessage: "Check route" },
    ]);
    expect(JSON.parse(updates[1]?.params?.[0] as string)).toEqual([
      { id: "existing", code: "scannerGenerated", fallbackMessage: "Already converted" },
    ]);
    expect(JSON.parse(updates[2]?.params?.[0] as string)).toEqual([
      { id: "duplicate", code: "noRows" },
      { id: expect.not.stringMatching(/^duplicate$/), code: "missingSheetTitle" },
    ]);
    expect(updates).toHaveLength(3);
  });

  it("backfills legacy motor hours to every known engine without overwriting explicit runtime", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run("create table log_sheets (id text primary key, boat_id text not null, motor_hours real not null default 0); create table log_lines (sheet_id text, sort_order integer, motor_hours real); create table engines (id text primary key, boat_id text); create table log_line_engine_hours (sheet_id text, line_sort_order integer, engine_id text, runtime_hours real, primary key (sheet_id, line_sort_order, engine_id));");
    db.run("insert into log_sheets values ('sheet-1', 'boat-1', 1.5); insert into log_lines values ('sheet-1', 0, 1.5); insert into engines values ('port', 'boat-1'), ('starboard', 'boat-1'); insert into log_line_engine_hours values ('sheet-1', 0, 'port', 2.0);");

    db.run(await readFile("app/lib/db/migrations/039_backfill_engine_hours.sql", "utf8"));

    expect(db.exec("select engine_id, runtime_hours from log_line_engine_hours order by engine_id")[0].values).toEqual([["port", 2], ["starboard", 1.5]]);
    expect(db.exec("select motor_hours from log_sheets")[0].values).toEqual([[3.5]]);
    db.close();
  });

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

  it("moves the legacy sheet date into route timestamps before dropping the duplicate column", async () => {
    const db = new RemoveDateRangeDatabase();
    await removeLegacyLogSheetDateRange(db);
    expect(db.calls).toContainEqual({ sql: "update log_sheets set route = $1 where id = $2", params: [JSON.stringify({ from: "A", to: "B", departed: "2026-05-14T00:00:00+00:00", arrived: "2026-05-14T00:00:00+00:00" }), "legacy-sheet"] });
    expect(db.calls.at(-1)).toEqual({ sql: "alter table log_sheets drop column date_range", params: undefined });
  });

});
