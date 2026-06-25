import { Pool, type PoolClient } from "pg";
import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { sampleBoats, sampleLogSheets } from "../sample-data/logbook";
import type { Boat, LogLine, LogSheet, PersistedLogbook } from "../models/logbook";
import type { CrewMember } from "../models/crew-member";

const defaultLogbook: PersistedLogbook = { boats: sampleBoats, sheets: sampleLogSheets };

type StoredLogSheet = Omit<LogSheet, "crew" | "lines">;

type BoatRow = Omit<Boat, "flagState" | "homePort" | "yachtData"> & { flag_state: string; home_port: string; yacht_data: unknown };
type LogSheetRow = {
  id: string;
  title: string;
  date_range: string;
  status: LogSheet["status"];
  boat_id: string;
  skipper: unknown;
  route: unknown;
  weather_briefing: unknown;
  day_summary: unknown;
  remarks: unknown;
  watch_plan: unknown;
  technical_checks: unknown;
};
type CrewMemberRow = CrewMember & { sheet_id: string; sort_order: number };
type LogLineRow = Omit<LogLine, "logNm" | "magneticCourse" | "seaState"> & { sheet_id: string; sort_order: number; log_nm: number; magnetic_course: string; sea_state: string };

abstract class LogbookDatabase {
  async readLogbook(): Promise<PersistedLogbook> {
    await this.ensureSchema();
    const logbook = await this.readTables();
    if (logbook.boats.length || logbook.sheets.length) return logbook;
    await this.writeLogbook(defaultLogbook);
    return defaultLogbook;
  }

  async writeLogbook(logbook: PersistedLogbook) {
    await this.ensureSchema();
    await this.replaceTables(logbook);
    return logbook;
  }

  protected abstract ensureSchema(): Promise<void>;
  protected abstract readTables(): Promise<PersistedLogbook>;
  protected abstract replaceTables(logbook: PersistedLogbook): Promise<void>;
}

class PostgresLogbookDatabase extends LogbookDatabase {
  private pool: Pool;

  constructor(connectionString: string) {
    super();
    this.pool = new Pool({ connectionString });
  }

  protected async ensureSchema() {
    await this.pool.query(`
      create table if not exists boats (
        id text primary key,
        name text not null,
        type text not null,
        registration text not null,
        flag_state text not null,
        home_port text not null,
        owner text not null,
        dimensions text not null,
        yacht_data jsonb not null
      );

      create table if not exists log_sheets (
        id text primary key,
        title text not null,
        date_range text not null,
        status text not null,
        boat_id text not null references boats(id) on delete cascade,
        skipper jsonb not null,
        route jsonb not null,
        weather_briefing jsonb not null,
        day_summary jsonb not null,
        remarks jsonb not null,
        watch_plan jsonb not null,
        technical_checks jsonb not null
      );

      create table if not exists crew_members (
        sheet_id text not null references log_sheets(id) on delete cascade,
        sort_order integer not null,
        name text not null,
        nationality text not null,
        role text not null,
        embarkation text not null,
        disembarkation text not null,
        primary key (sheet_id, sort_order)
      );

      create table if not exists log_lines (
        sheet_id text not null references log_sheets(id) on delete cascade,
        sort_order integer not null,
        time text not null,
        position_name text not null,
        latitude double precision not null,
        longitude double precision not null,
        log_nm double precision not null,
        course text not null,
        magnetic_course text not null,
        sea_state text not null,
        barometer text not null,
        wind text not null,
        weather text not null,
        sails text not null,
        engine text not null,
        remarks text not null,
        primary key (sheet_id, sort_order)
      );
    `);
  }

  protected async readTables(): Promise<PersistedLogbook> {
    const [boats, sheets, crew, lines] = await Promise.all([
      this.pool.query<BoatRow>("select * from boats order by name"),
      this.pool.query<LogSheetRow>("select * from log_sheets order by date_range desc, title"),
      this.pool.query<CrewMemberRow>("select * from crew_members order by sheet_id, sort_order"),
      this.pool.query<LogLineRow>("select sheet_id, sort_order, time, position_name as position, latitude, longitude, log_nm, course, magnetic_course, sea_state, barometer, wind, weather, sails, engine, remarks from log_lines order by sheet_id, sort_order"),
    ]);
    return mapRowsToLogbook(boats.rows, sheets.rows, crew.rows, lines.rows);
  }

  protected async replaceTables(logbook: PersistedLogbook) {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query("delete from log_lines");
      await client.query("delete from crew_members");
      await client.query("delete from log_sheets");
      await client.query("delete from boats");
      await insertPostgresLogbook(client, logbook);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
}

class SqliteLogbookDatabase extends LogbookDatabase {
  private db: SqlJsDatabase | undefined;

  constructor(private databasePath: string) {
    super();
  }

  private async getDb() {
    if (this.db) return this.db;
    await mkdir(dirname(this.databasePath), { recursive: true });
    const sql = await initSqlJs({ locateFile: (file) => join(process.cwd(), "node_modules", "sql.js", "dist", file) });
    try {
      this.db = new sql.Database(await readFile(this.databasePath));
    } catch {
      this.db = new sql.Database();
    }
    this.db.run("pragma foreign_keys = on");
    return this.db;
  }

  private async persist() {
    const db = await this.getDb();
    await writeFile(this.databasePath, Buffer.from(db.export()));
  }

  protected async ensureSchema() {
    const db = await this.getDb();
    db.run(`
      create table if not exists boats (
        id text primary key,
        name text not null,
        type text not null,
        registration text not null,
        flag_state text not null,
        home_port text not null,
        owner text not null,
        dimensions text not null,
        yacht_data text not null
      );

      create table if not exists log_sheets (
        id text primary key,
        title text not null,
        date_range text not null,
        status text not null,
        boat_id text not null references boats(id) on delete cascade,
        skipper text not null,
        route text not null,
        weather_briefing text not null,
        day_summary text not null,
        remarks text not null,
        watch_plan text not null,
        technical_checks text not null
      );

      create table if not exists crew_members (
        sheet_id text not null references log_sheets(id) on delete cascade,
        sort_order integer not null,
        name text not null,
        nationality text not null,
        role text not null,
        embarkation text not null,
        disembarkation text not null,
        primary key (sheet_id, sort_order)
      );

      create table if not exists log_lines (
        sheet_id text not null references log_sheets(id) on delete cascade,
        sort_order integer not null,
        time text not null,
        position_name text not null,
        latitude real not null,
        longitude real not null,
        log_nm real not null,
        course text not null,
        magnetic_course text not null,
        sea_state text not null,
        barometer text not null,
        wind text not null,
        weather text not null,
        sails text not null,
        engine text not null,
        remarks text not null,
        primary key (sheet_id, sort_order)
      );
    `);
  }

  protected async readTables(): Promise<PersistedLogbook> {
    const db = await this.getDb();
    return mapRowsToLogbook(
      selectSqliteRows<BoatRow>(db, "select * from boats order by name"),
      selectSqliteRows<LogSheetRow>(db, "select * from log_sheets order by date_range desc, title"),
      selectSqliteRows<CrewMemberRow>(db, "select * from crew_members order by sheet_id, sort_order"),
      selectSqliteRows<LogLineRow>(db, "select sheet_id, sort_order, time, position_name as position, latitude, longitude, log_nm, course, magnetic_course, sea_state, barometer, wind, weather, sails, engine, remarks from log_lines order by sheet_id, sort_order"),
    );
  }

  protected async replaceTables(logbook: PersistedLogbook) {
    const db = await this.getDb();
    try {
      db.run("begin");
      db.run("delete from log_lines; delete from crew_members; delete from log_sheets; delete from boats;");
      insertSqliteLogbook(db, logbook);
      db.run("commit");
      await this.persist();
    } catch (error) {
      db.run("rollback");
      throw error;
    }
  }
}

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

function parseJson<T>(value: unknown): T {
  return typeof value === "string" ? JSON.parse(value) as T : value as T;
}

function mapRowsToLogbook(boatRows: BoatRow[], sheetRows: LogSheetRow[], crewRows: CrewMemberRow[], lineRows: LogLineRow[]): PersistedLogbook {
  const crewBySheet = groupBy(crewRows, (crew) => crew.sheet_id);
  const linesBySheet = groupBy(lineRows, (line) => line.sheet_id);
  const boats: Boat[] = boatRows.map((boat) => ({
    id: boat.id,
    name: boat.name,
    type: boat.type,
    registration: boat.registration,
    flagState: boat.flag_state,
    homePort: boat.home_port,
    owner: boat.owner,
    dimensions: boat.dimensions,
    yachtData: parseJson<Record<string, string>>(boat.yacht_data),
  }));
  const sheets: LogSheet[] = sheetRows.map((sheet) => ({
    ...mapStoredSheet(sheet),
    crew: (crewBySheet.get(sheet.id) ?? []).map(({ sheet_id, sort_order, ...crew }) => crew),
    lines: (linesBySheet.get(sheet.id) ?? []).map(({ sheet_id, sort_order, log_nm, magnetic_course, sea_state, ...line }) => ({
      ...line,
      logNm: log_nm,
      magneticCourse: magnetic_course,
      seaState: sea_state,
    })),
  }));
  return { boats, sheets };
}

function groupBy<T>(items: T[], keyFor: (item: T) => string) {
  return items.reduce((groups, item) => {
    const key = keyFor(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
    return groups;
  }, new Map<string, T[]>());
}

function mapStoredSheet(sheet: LogSheetRow): StoredLogSheet {
  return {
    id: sheet.id,
    title: sheet.title,
    dateRange: sheet.date_range,
    status: sheet.status,
    boatId: sheet.boat_id,
    skipper: parseJson<LogSheet["skipper"]>(sheet.skipper),
    route: parseJson<LogSheet["route"]>(sheet.route),
    weatherBriefing: parseJson<LogSheet["weatherBriefing"]>(sheet.weather_briefing),
    daySummary: parseJson<LogSheet["daySummary"]>(sheet.day_summary),
    remarks: parseJson<string[]>(sheet.remarks),
    watchPlan: parseJson<string[]>(sheet.watch_plan),
    technicalChecks: parseJson<string[]>(sheet.technical_checks),
  };
}

async function insertPostgresLogbook(client: PoolClient, logbook: PersistedLogbook) {
  for (const boat of logbook.boats) {
    await client.query("insert into boats (id, name, type, registration, flag_state, home_port, owner, dimensions, yacht_data) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)", [boat.id, boat.name, boat.type, boat.registration, boat.flagState, boat.homePort, boat.owner, boat.dimensions, JSON.stringify(boat.yachtData)]);
  }
  for (const sheet of logbook.sheets) {
    await client.query("insert into log_sheets (id, title, date_range, status, boat_id, skipper, route, weather_briefing, day_summary, remarks, watch_plan, technical_checks) values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb)", [sheet.id, sheet.title, sheet.dateRange, sheet.status, sheet.boatId, JSON.stringify(sheet.skipper), JSON.stringify(sheet.route), JSON.stringify(sheet.weatherBriefing), JSON.stringify(sheet.daySummary), JSON.stringify(sheet.remarks), JSON.stringify(sheet.watchPlan), JSON.stringify(sheet.technicalChecks)]);
    for (const [index, crew] of sheet.crew.entries()) {
      await client.query("insert into crew_members (sheet_id, sort_order, name, nationality, role, embarkation, disembarkation) values ($1,$2,$3,$4,$5,$6,$7)", [sheet.id, index, crew.name, crew.nationality, crew.role, crew.embarkation, crew.disembarkation]);
    }
    for (const [index, line] of sheet.lines.entries()) {
      await client.query("insert into log_lines (sheet_id, sort_order, time, position_name, latitude, longitude, log_nm, course, magnetic_course, sea_state, barometer, wind, weather, sails, engine, remarks) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)", [sheet.id, index, line.time, line.position, line.latitude, line.longitude, line.logNm, line.course, line.magneticCourse, line.seaState, line.barometer, line.wind, line.weather, line.sails, line.engine, line.remarks]);
    }
  }
}

function selectSqliteRows<T>(db: SqlJsDatabase, sql: string): T[] {
  const [result] = db.exec(sql);
  if (!result) return [];
  return result.values.map((values) => Object.fromEntries(result.columns.map((column, index) => [column, values[index]])) as T);
}

function insertSqliteLogbook(db: SqlJsDatabase, logbook: PersistedLogbook) {
  for (const boat of logbook.boats) db.run("insert into boats (id, name, type, registration, flag_state, home_port, owner, dimensions, yacht_data) values (?, ?, ?, ?, ?, ?, ?, ?, ?)", [boat.id, boat.name, boat.type, boat.registration, boat.flagState, boat.homePort, boat.owner, boat.dimensions, JSON.stringify(boat.yachtData)]);
  for (const sheet of logbook.sheets) {
    db.run("insert into log_sheets (id, title, date_range, status, boat_id, skipper, route, weather_briefing, day_summary, remarks, watch_plan, technical_checks) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [sheet.id, sheet.title, sheet.dateRange, sheet.status, sheet.boatId, JSON.stringify(sheet.skipper), JSON.stringify(sheet.route), JSON.stringify(sheet.weatherBriefing), JSON.stringify(sheet.daySummary), JSON.stringify(sheet.remarks), JSON.stringify(sheet.watchPlan), JSON.stringify(sheet.technicalChecks)]);
    for (const [index, crew] of sheet.crew.entries()) db.run("insert into crew_members (sheet_id, sort_order, name, nationality, role, embarkation, disembarkation) values (?, ?, ?, ?, ?, ?, ?)", [sheet.id, index, crew.name, crew.nationality, crew.role, crew.embarkation, crew.disembarkation]);
    for (const [index, line] of sheet.lines.entries()) db.run("insert into log_lines (sheet_id, sort_order, time, position_name, latitude, longitude, log_nm, course, magnetic_course, sea_state, barometer, wind, weather, sails, engine, remarks) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [sheet.id, index, line.time, line.position, line.latitude, line.longitude, line.logNm, line.course, line.magneticCourse, line.seaState, line.barometer, line.wind, line.weather, line.sails, line.engine, line.remarks]);
  }
}
