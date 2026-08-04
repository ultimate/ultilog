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
      await new PostgresTransactionLogbookDatabase(client, this.requireOwnerId()).writeLogbook(logbook);
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
    const ownerId = this.requireOwnerId();
    const motionStationaryThresholdNm = await this.motionStationaryThresholdNm();
    for (const boat of logbook.boats) await this.boats.insert(boat, ownerId);
    const crewProfiles = new Map([...(logbook.crewMembers ?? []), ...logbook.sheets.flatMap((sheet) => sheet.crew)].map((crew) => [crew.id, crew])).values();
    for (const crew of crewProfiles) await this.crew.insertProfile(crew, ownerId);
    for (const sheet of logbook.sheets) await this.sheets.insert(sheet, ownerId, motionStationaryThresholdNm);
    await this.crew.insertAssignments(logbook.sheets.flatMap((sheet) => sheet.crew.map((crew, sortOrder) => ({ sheetId: sheet.id, sortOrder, crew }))), ownerId);
    await this.lines.insertMany(logbook.sheets.flatMap((sheet) => sheet.lines.map((line, sortOrder) => ({ sheetId: sheet.id, sortOrder, line }))), ownerId);
    for (const sheet of logbook.sheets) await this.sheets.updateMetrics(sheet, sheet.lines, ownerId, motionStationaryThresholdNm);
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
    const ownerId = this.requireOwnerId();
    const motionStationaryThresholdNm = await this.motionStationaryThresholdNm();
    for (const boat of logbook.boats) await this.boats.insert(boat, ownerId);
    const crewProfiles = new Map([...(logbook.crewMembers ?? []), ...logbook.sheets.flatMap((sheet) => sheet.crew)].map((crew) => [crew.id, crew])).values();
    for (const crew of crewProfiles) await this.crew.insertProfile(crew, ownerId);
    for (const sheet of logbook.sheets) await this.sheets.insert(sheet, ownerId, motionStationaryThresholdNm);
    await this.crew.insertAssignments(logbook.sheets.flatMap((sheet) => sheet.crew.map((crew, sortOrder) => ({ sheetId: sheet.id, sortOrder, crew }))), ownerId);
    await this.lines.insertMany(logbook.sheets.flatMap((sheet) => sheet.lines.map((line, sortOrder) => ({ sheetId: sheet.id, sortOrder, line }))), ownerId);
    for (const sheet of logbook.sheets) await this.sheets.updateMetrics(sheet, sheet.lines, ownerId, motionStationaryThresholdNm);
  }
}
