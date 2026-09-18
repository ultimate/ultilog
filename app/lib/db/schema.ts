import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export type SqlMigration = {
  id: string;
  sql: string;
};

/** Latest migration for persistent, concurrently tracked compliance licenses. */
export const USER_COMPLIANCE_MIGRATION_ID = "042_user_compliance_licenses";
export const STRUCTURED_SCANNER_WARNINGS_MIGRATION_ID = "043_structure_scanner_warnings";
export const LOCALIZED_SCANNER_WARNINGS_MIGRATION_ID = "044_localize_scanner_warnings";
export const STRICT_STORAGE_FORMATS_MIGRATION_ID = "045_remove_legacy_storage_formats";
export const STRICT_LOG_LINE_ENGINE_HOURS_MIGRATION_ID = "046_remove_legacy_log_line_motor_hours";
export const NORMALIZED_BOAT_MASTER_DATA_MIGRATION_ID = "047_normalize_boat_master_data";
export const SHARED_SHEET_SOURCE_DETAILS_MIGRATION_ID = "048_shared_sheet_source_details";

let migrations: SqlMigration[] | undefined;
let schemaSql: string | undefined;

export async function readMigrations() {
  if (migrations) return migrations;
  const migrationsDirectory = join(process.cwd(), "app", "lib", "db", "migrations");
  const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith(".sql")).sort();
  migrations = await Promise.all(files.map(async (file) => ({
    id: file.replace(/\.sql$/, ""),
    sql: await readFile(join(migrationsDirectory, file), "utf8"),
  })));
  return migrations;
}

export async function readSchemaSql() {
  schemaSql ??= (await readMigrations()).map((migration) => migration.sql).join("\n");
  return schemaSql;
}
