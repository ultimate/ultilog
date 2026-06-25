import { Pool } from "pg";
import type { PersistedLogbook } from "../../models/logbook";
import { LogbookDatabase, type QueryResult } from "./logbook-database";
import { readSchemaSql } from "./schema";

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
    await this.pool.query(await readSchemaSql());
  }

  override async writeLogbook(logbook: PersistedLogbook) {
    await this.ensureSchema();
    const client = await this.pool.connect();
    const originalQuery = this.query.bind(this);
    this.query = async <Row>(sql: string, values?: unknown[]) => {
      const result = await client.query(sql, values);
      return { rows: result.rows as Row[] };
    };

    try {
      await client.query("begin");
      await this.deleteTables();
      await this.insertPostgresLogbook(logbook);
      await client.query("commit");
      return logbook;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      this.query = originalQuery;
      client.release();
    }
  }

  protected async insertLogbook(logbook: PersistedLogbook) {
    await this.insertPostgresLogbook(logbook);
  }

  private async insertPostgresLogbook(logbook: PersistedLogbook) {
    for (const boat of logbook.boats) await this.boats.insert(boat);
    for (const sheet of logbook.sheets) {
      await this.sheets.insert(sheet);
      for (const [index, crew] of sheet.crew.entries()) await this.crew.insert(sheet.id, index, crew);
      for (const [index, line] of sheet.lines.entries()) await this.lines.insert(sheet.id, index, line);
    }
  }
}
