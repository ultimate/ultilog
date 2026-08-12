import { join } from "node:path";
import type { Boat, CrewMember, LogLine, LogSheet, PersistedLogbook } from "../models/logbook";
import { LogbookDatabase } from "./db/logbook-database";
import { PostgresLogbookDatabase } from "./db/postgres-logbook-database";
import { SqliteLogbookDatabase } from "./db/sqlite-logbook-database";

type StoreState = { database?: LogbookDatabase; writeQueue: Promise<unknown> };
const globalLogbookStores = globalThis as typeof globalThis & { __ultilogLogbookStores?: Map<string, StoreState> };

function storeState(): { state: StoreState; postgresUrl: string | undefined } {
  const postgresUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  const key = postgresUrl ? `postgres:${postgresUrl}` : `sqlite:${process.env.LOCAL_DATABASE_PATH ?? join(process.cwd(), ".data", "ultilog.sqlite")}`;
  const stores = globalLogbookStores.__ultilogLogbookStores ??= new Map();
  let state = stores.get(key);
  if (!state) {
    state = { writeQueue: Promise.resolve() };
    stores.set(key, state);
  }
  return { state, postgresUrl };
}

export function getDatabase(): LogbookDatabase {
  const { state, postgresUrl } = storeState();
  if (!state.database) state.database = postgresUrl ? new PostgresLogbookDatabase(postgresUrl) : new SqliteLogbookDatabase(process.env.LOCAL_DATABASE_PATH ?? join(process.cwd(), ".data", "ultilog.sqlite"));
  return state.database;
}

export async function readLogbook(userId: string): Promise<PersistedLogbook> {
  const { state } = storeState();
  const operation = state.writeQueue.then(() => getDatabase().forUser(userId).readLogbook());
  state.writeQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function writeLogbook(logbook: PersistedLogbook, userId: string) {
  const { state } = storeState();
  const operation = state.writeQueue.then(() => getDatabase().forUser(userId).writeLogbook(logbook));
  state.writeQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

function mutate<T>(userId: string, operation: (database: LogbookDatabase) => Promise<T>) {
  const { state } = storeState();
  const pending = state.writeQueue.then(() => operation(getDatabase().forUser(userId)));
  state.writeQueue = pending.then(() => undefined, () => undefined);
  return pending;
}

export const upsertBoat = (boat: Boat, userId: string) => mutate(userId, db => db.upsertBoat(boat));
export const deleteBoat = (id: string, revision: number, userId: string) => mutate(userId, db => db.deleteBoat(id, revision));
export const upsertCrewMember = (crew: CrewMember, userId: string) => mutate(userId, db => db.upsertCrewMember(crew));
export const deleteCrewMember = (id: string, revision: number, userId: string) => mutate(userId, db => db.deleteCrewMember(id, revision));
export const upsertLogSheet = (sheet: LogSheet, userId: string) => mutate(userId, db => db.upsertLogSheet(sheet));
export const createLogSheetAggregate = (sheet: Omit<LogSheet, "lines">, lines: LogLine[], userId: string) => mutate(userId, db => db.createLogSheetAggregate(sheet, lines));
export const deleteLogSheet = (id: string, revision: number, userId: string) => mutate(userId, db => db.deleteLogSheet(id, revision));
export const createLogLine = (sheetId: string, line: LogLine, userId: string) => mutate(userId, db => db.createLogLine(sheetId, line));
export const updateLogLine = (sheetId: string, lineId: string, line: LogLine, userId: string) => mutate(userId, db => db.updateLogLine(sheetId, lineId, line));
export const deleteLogLine = (sheetId: string, lineId: string, revision: number, userId: string) => mutate(userId, db => db.deleteLogLine(sheetId, lineId, revision));
export const reorderLogLines = (sheetId: string, lineIds: string[], userId: string) => mutate(userId, db => db.reorderLogLines(sheetId, lineIds));
export const createStoredImage = (id: string, image: import("../models/stored-image").StoredImage, userId: string) => mutate(userId, db => db.createStoredImage(id, image));
export const readStoredImage = (id: string, userId: string) => mutate(userId, db => db.readStoredImage(id));
export const deleteStoredImage = (id: string, userId: string) => mutate(userId, db => db.deleteStoredImage(id));

export async function readSharedLogSheet(sheetId: string, isAuthenticated: boolean, ownerId?: string) {
  const { state } = storeState();
  const operation = state.writeQueue.then(() => getDatabase().readSharedSheet(sheetId, isAuthenticated, ownerId));
  state.writeQueue = operation.then(() => undefined, () => undefined);
  return operation;
}
