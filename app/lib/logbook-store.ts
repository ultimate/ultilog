import { Pool } from "pg";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { sampleBoats, sampleLogSheets } from "../sample-data/logbook";
import type { PersistedLogbook } from "../models/logbook";

const LOGBOOK_KEY = "default";
const defaultLogbook: PersistedLogbook = { boats: sampleBoats, sheets: sampleLogSheets };

let postgresPool: Pool | undefined;
type SqliteDatabase = { exec: (sql: string) => void; prepare: (sql: string) => { get: (...values: unknown[]) => unknown; run: (...values: unknown[]) => unknown } };

let sqliteDb: SqliteDatabase | undefined;

function getPostgresUrl() {
  return process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
}

function getLocalDatabasePath() {
  return process.env.LOCAL_DATABASE_PATH ?? join(process.cwd(), ".data", "ultilog.sqlite");
}

function getPostgresPool() {
  postgresPool ??= new Pool({ connectionString: getPostgresUrl() });
  return postgresPool;
}

async function getSqliteDb(): Promise<SqliteDatabase> {
  if (sqliteDb) return sqliteDb;
  const path = getLocalDatabasePath();
  await mkdir(dirname(path), { recursive: true });
  const { DatabaseSync } = await import("node:sqlite");
  sqliteDb = new DatabaseSync(path) as unknown as SqliteDatabase;
  return sqliteDb;
}

async function ensurePostgresSchema() {
  await getPostgresPool().query(`
    create table if not exists logbook_documents (
      id text primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    )
  `);
}

async function ensureSqliteSchema() {
  const db = await getSqliteDb();
  db.exec(`
    create table if not exists logbook_documents (
      id text primary key,
      data text not null,
      updated_at text not null default current_timestamp
    )
  `);
}

export async function readLogbook(): Promise<PersistedLogbook> {
  if (getPostgresUrl()) {
    await ensurePostgresSchema();
    const result = await getPostgresPool().query<{ data: PersistedLogbook }>("select data from logbook_documents where id = $1", [LOGBOOK_KEY]);
    if (result.rows[0]?.data) return result.rows[0].data;
    await writeLogbook(defaultLogbook);
    return defaultLogbook;
  }

  await ensureSqliteSchema();
  const db = await getSqliteDb();
  const row = db.prepare("select data from logbook_documents where id = ?").get(LOGBOOK_KEY) as { data: string } | undefined;
  if (row?.data) return JSON.parse(row.data) as PersistedLogbook;
  await writeLogbook(defaultLogbook);
  return defaultLogbook;
}

export async function writeLogbook(logbook: PersistedLogbook) {
  if (getPostgresUrl()) {
    await ensurePostgresSchema();
    await getPostgresPool().query(
      `insert into logbook_documents (id, data, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (id) do update set data = excluded.data, updated_at = now()`,
      [LOGBOOK_KEY, JSON.stringify(logbook)],
    );
    return logbook;
  }

  await ensureSqliteSchema();
  const db = await getSqliteDb();
  db.prepare(`
    insert into logbook_documents (id, data, updated_at)
    values (?, ?, current_timestamp)
    on conflict(id) do update set data = excluded.data, updated_at = current_timestamp
  `).run(LOGBOOK_KEY, JSON.stringify(logbook));
  return logbook;
}
