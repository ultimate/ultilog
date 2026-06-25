import { join } from "node:path";
import type { PersistedLogbook } from "../models/logbook";
import { LogbookDatabase } from "./db/logbook-database";
import { PostgresLogbookDatabase } from "./db/postgres-logbook-database";
import { SqliteLogbookDatabase } from "./db/sqlite-logbook-database";

let database: LogbookDatabase | undefined;

function getDatabase() {
  if (database) return database;
  const postgresUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  database = postgresUrl ? new PostgresLogbookDatabase(postgresUrl) : new SqliteLogbookDatabase(process.env.LOCAL_DATABASE_PATH ?? join(process.cwd(), ".data", "ultilog.sqlite"));
  return database;
}

export async function readLogbook(): Promise<PersistedLogbook> {
  return getDatabase().readLogbook();
}

export async function writeLogbook(logbook: PersistedLogbook) {
  return getDatabase().writeLogbook(logbook);
}
