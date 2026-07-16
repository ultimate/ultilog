import { join } from "node:path";
import type { PersistedLogbook } from "../models/logbook";
import { LogbookDatabase } from "./db/logbook-database";
import { PostgresLogbookDatabase } from "./db/postgres-logbook-database";
import { SqliteLogbookDatabase } from "./db/sqlite-logbook-database";

let database: LogbookDatabase | undefined;
let writeQueue: Promise<unknown> = Promise.resolve();

export function getDatabase() {
  if (database) return database;
  const postgresUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  database = postgresUrl ? new PostgresLogbookDatabase(postgresUrl) : new SqliteLogbookDatabase(process.env.LOCAL_DATABASE_PATH ?? join(process.cwd(), ".data", "ultilog.sqlite"));
  return database;
}

export async function readLogbook(userId = "legacy-user"): Promise<PersistedLogbook> {
  const operation = writeQueue.then(() => getDatabase().forUser(userId).readLogbook());
  writeQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function writeLogbook(logbook: PersistedLogbook, userId = "legacy-user") {
  const operation = writeQueue.then(() => getDatabase().forUser(userId).writeLogbook(logbook));
  writeQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function readSharedLogSheet(sheetId: string, isAuthenticated: boolean, ownerId?: string) {
  const operation = writeQueue.then(() => getDatabase().readSharedSheet(sheetId, isAuthenticated, ownerId));
  writeQueue = operation.then(() => undefined, () => undefined);
  return operation;
}
