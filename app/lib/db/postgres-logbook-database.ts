import { Pool, type PoolClient } from "pg";
import type { PersistedLogbook } from "../../models/logbook";
import { LogbookDatabase, type QueryResult } from "./logbook-database";
import { runMigrations } from "./migrations";

export class PostgresLogbookDatabase extends LogbookDatabase {
  private pool: Pool;

  constructor(connectionString: string) {
    super();
    this.pool = new Pool({ connectionString });
  }

  placeholder(index: number) {
    return `$${index}`;
  }

  async query<Row>(sql: string, values?: unknown[]): Promise<QueryResult<Row>> {
    const result = await this.pool.query(sql, values);
    return { rows: result.rows as Row[] };
  }

  protected async ensureSchema() {
    await runMigrations(this);
  }

  override async writeLogbook(logbook: PersistedLogbook) {
    await this.ensureSchemaAndBackfill();
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await new PostgresTransactionLogbookDatabase(client, this.ownerId).writeLogbook(logbook);
      await client.query("commit");
      return logbook;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  protected async insertLogbook(logbook: PersistedLogbook) {
    await this.insertPostgresLogbook(logbook);
  }

  private async insertPostgresLogbook(logbook: PersistedLogbook) {
    const ownerId = this.ownerId;
    for (const boat of logbook.boats) await this.boats.insert(boat, ownerId);
    for (const crew of logbook.crewMembers ?? []) await this.crew.insertProfile(crew, ownerId);
    for (const sheet of logbook.sheets) {
      await this.sheets.insert(sheet, ownerId);
      for (const [index, crew] of sheet.crew.entries()) await this.crew.insert(sheet.id, index, crew, ownerId);
      for (const [index, line] of sheet.lines.entries()) await this.lines.insert(sheet.id, index, line, ownerId);
      await this.sheets.updateMetrics(sheet, sheet.lines, ownerId);
    }
  }
}

class PostgresTransactionLogbookDatabase extends LogbookDatabase {
  constructor(private client: PoolClient, ownerId: string) {
    super();
    this.ownerId = ownerId;
  }

  placeholder(index: number) {
    return `$${index}`;
  }

  async query<Row>(sql: string, values?: unknown[]): Promise<QueryResult<Row>> {
    const result = await this.client.query(sql, values);
    return { rows: result.rows as Row[] };
  }

  protected async ensureSchema() {
    return;
  }

  protected async insertLogbook(logbook: PersistedLogbook) {
    const ownerId = this.ownerId;
    for (const boat of logbook.boats) await this.boats.insert(boat, ownerId);
    for (const crew of logbook.crewMembers ?? []) await this.crew.insertProfile(crew, ownerId);
    for (const sheet of logbook.sheets) {
      await this.sheets.insert(sheet, ownerId);
      for (const [index, crew] of sheet.crew.entries()) await this.crew.insert(sheet.id, index, crew, ownerId);
      for (const [index, line] of sheet.lines.entries()) await this.lines.insert(sheet.id, index, line, ownerId);
      await this.sheets.updateMetrics(sheet, sheet.lines, ownerId);
    }
  }
}
