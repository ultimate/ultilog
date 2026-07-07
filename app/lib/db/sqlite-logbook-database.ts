import initSqlJs, { type Database as SqlJsDatabase, type SqlValue } from "sql.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { PersistedLogbook } from "../../models/logbook";
import { LogbookDatabase, type QueryResult } from "./logbook-database";
import { runMigrations } from "./migrations";

export class SqliteLogbookDatabase extends LogbookDatabase {
  private db: SqlJsDatabase | undefined;

  constructor(private databasePath: string) {
    super();
  }

  placeholder() {
    return "?";
  }

  async query<Row>(sql: string, values: unknown[] = []): Promise<QueryResult<Row>> {
    const db = await this.getDb();
    if (sql.trim().toLowerCase().startsWith("select")) return { rows: selectRows<Row>(db, sql, values) };
    if (values.length) db.run(sql, values as SqlValue[]);
    else db.exec(sql);
    return { rows: [] };
  }

  protected async ensureSchema() {
    await runMigrations(this);
  }

  override async writeLogbook(logbook: PersistedLogbook) {
    await this.ensureSchemaAndBackfill();
    const db = await this.getDb();
    try {
      db.run("begin");
      await this.deleteTables();
      await this.insertSqliteLogbook(logbook);
      db.run("commit");
      await this.persist();
      return logbook;
    } catch (error) {
      db.run("rollback");
      throw error;
    }
  }

  protected async insertLogbook(logbook: PersistedLogbook) {
    await this.insertSqliteLogbook(logbook);
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

  private async insertSqliteLogbook(logbook: PersistedLogbook) {
    const ownerId = this.ownerId;
    for (const boat of logbook.boats) await this.boats.insert(boat, ownerId);
    for (const crew of logbook.crewMembers ?? []) await this.crew.insertProfile(crew, ownerId);
    for (const sheet of logbook.sheets) {
      await this.sheets.insert(sheet, ownerId);
      for (const [index, crew] of sheet.crew.entries()) await this.crew.insert(sheet.id, index, crew, ownerId);
      for (const [index, line] of sheet.lines.entries()) await this.lines.insert(sheet.id, index, line, ownerId);
    }
  }
}

function selectRows<Row>(db: SqlJsDatabase, sql: string, values: unknown[]): Row[] {
  const statement = db.prepare(sql, values as SqlValue[]);
  const rows: Row[] = [];
  try {
    while (statement.step()) rows.push(statement.getAsObject() as Row);
    return rows;
  } finally {
    statement.free();
  }
}
