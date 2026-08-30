import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export type SqlMigration = {
  id: string;
  sql: string;
};

/** Latest migration for persistent, concurrently tracked compliance licenses. */
export const USER_COMPLIANCE_MIGRATION_ID = "042_user_compliance_licenses";

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
