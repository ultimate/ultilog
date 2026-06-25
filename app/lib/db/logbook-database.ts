import type { PersistedLogbook } from "../../models/logbook";
import { sampleBoats, sampleLogSheets } from "../../sample-data/logbook";
import { BoatsRepository } from "../repositories/boats-repository";
import { CrewMembersRepository } from "../repositories/crew-members-repository";
import { LogLinesRepository } from "../repositories/log-lines-repository";
import { LogSheetsRepository } from "../repositories/log-sheets-repository";

export type QueryResult<Row> = { rows: Row[] };

export interface QueryableDatabase {
  placeholder(index: number): string;
  query<Row>(sql: string, values?: unknown[]): Promise<QueryResult<Row>>;
}

const defaultLogbook: PersistedLogbook = { boats: sampleBoats, sheets: sampleLogSheets };

export abstract class LogbookDatabase implements QueryableDatabase {
  protected readonly boats = new BoatsRepository(this);
  protected readonly sheets = new LogSheetsRepository(this);
  protected readonly crew = new CrewMembersRepository(this);
  protected readonly lines = new LogLinesRepository(this);

  abstract placeholder(index: number): string;
  abstract query<Row>(sql: string, values?: unknown[]): Promise<QueryResult<Row>>;
  protected abstract ensureSchema(): Promise<void>;
  protected abstract insertLogbook(logbook: PersistedLogbook): Promise<void>;

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

  protected async readTables(): Promise<PersistedLogbook> {
    const [boats, sheets, crew, lines] = await Promise.all([
      this.boats.findAll(),
      this.sheets.findAll(),
      this.crew.findAll(),
      this.lines.findAll(),
    ]);
    return LogSheetsRepository.toLogbook(boats, sheets, crew, lines);
  }

  protected async deleteTables() {
    await this.lines.deleteAll();
    await this.crew.deleteAll();
    await this.sheets.deleteAll();
    await this.boats.deleteAll();
  }

  private async replaceTables(logbook: PersistedLogbook) {
    await this.deleteTables();
    await this.insertLogbook(logbook);
  }
}
