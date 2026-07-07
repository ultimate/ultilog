import type { PersistedLogbook } from "../../models/logbook";
import { sampleBoats, sampleLogSheets } from "../../../resources/sample-data/logbook";
import { BoatsRepository } from "../repositories/boats-repository";
import { CrewRepository } from "../repositories/crew-repository";
import { LogLinesRepository } from "../repositories/log-lines-repository";
import { LogSheetsRepository } from "../repositories/log-sheets-repository";
import { backfillCrewMemberEncryption } from "./encryption-backfill";

export type QueryResult<Row> = { rows: Row[] };

export interface QueryableDatabase {
  placeholder(index: number): string;
  query<Row>(sql: string, values?: unknown[]): Promise<QueryResult<Row>>;
}

const defaultLogbook: PersistedLogbook = { boats: sampleBoats, crewMembers: sampleLogSheets.flatMap((sheet) => sheet.crew).filter((crew, index, crews) => crews.findIndex((candidate) => candidate.id === crew.id) === index).map(({ embarkationDateTime, embarkationPosition, disembarkationDateTime, disembarkationPosition, ...crew }) => crew), sheets: sampleLogSheets };

export abstract class LogbookDatabase implements QueryableDatabase {
  protected readonly boats = new BoatsRepository(this);
  protected ownerId = "legacy-user";
  protected readonly sheets = new LogSheetsRepository(this);
  protected readonly crew = new CrewRepository(this);
  protected readonly lines = new LogLinesRepository(this);

  abstract placeholder(index: number): string;
  abstract query<Row>(sql: string, values?: unknown[]): Promise<QueryResult<Row>>;
  protected abstract ensureSchema(): Promise<void>;

  async migrate() {
    await this.ensureSchemaAndBackfill();
  }

  forUser(userId: string) {
    this.ownerId = userId;
    return this;
  }
  protected async ensureSchemaAndBackfill() {
    await this.ensureSchema();
    await backfillCrewMemberEncryption(this);
  }

  protected abstract insertLogbook(logbook: PersistedLogbook): Promise<void>;

  async readLogbook(): Promise<PersistedLogbook> {
    await this.ensureSchemaAndBackfill();
    const logbook = await this.readTables();
    if (logbook.boats.length || logbook.sheets.length) return logbook;
    await this.writeLogbook(defaultLogbook);
    return defaultLogbook;
  }

  async writeLogbook(logbook: PersistedLogbook) {
    await this.ensureSchemaAndBackfill();
    await this.replaceTables(logbook);
    return logbook;
  }

  protected async readTables(): Promise<PersistedLogbook> {
    const [boats, sheets, crewProfiles, crew, lines] = await Promise.all([
      this.boats.findAll(this.ownerId),
      this.sheets.findAll(this.ownerId),
      this.crew.findProfiles(this.ownerId),
      this.crew.findAll(this.ownerId),
      this.lines.findAll(this.ownerId),
    ]);
    return LogSheetsRepository.toLogbook(boats, sheets, crew, lines, crewProfiles);
  }

  protected async deleteTables() {
    await this.lines.deleteAll(this.ownerId);
    await this.crew.deleteAll(this.ownerId);
    await this.sheets.deleteAll(this.ownerId);
    await this.boats.deleteAll(this.ownerId);
  }

  private async replaceTables(logbook: PersistedLogbook) {
    await this.deleteTables();
    await this.insertLogbook(logbook);
  }
}
