import { defaultLogSheetShareSettings, type LogSheet, type PersistedLogbook } from "../../models/logbook";
import { BoatsRepository } from "../repositories/boats-repository";
import { CrewRepository } from "../repositories/crew-repository";
import { LogLinesRepository } from "../repositories/log-lines-repository";
import { scopedId } from "../repositories/boats-repository";
import { LogSheetsRepository } from "../repositories/log-sheets-repository";
import { backfillCrewMemberEncryption } from "./encryption-backfill";

export type QueryResult<Row> = { rows: Row[] };

export interface QueryableDatabase {
  placeholder(index: number): string;
  query<Row>(sql: string, values?: unknown[]): Promise<QueryResult<Row>>;
}

const emptyLogbook: PersistedLogbook = { boats: [], crewMembers: [], sheets: [] };

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
    await this.crew.ensurePrimaryProfile(this.ownerId);
    const logbook = await this.readTables();
    return logbook.boats.length || logbook.sheets.length || logbook.crewMembers.length ? logbook : emptyLogbook;
  }

  async writeLogbook(logbook: PersistedLogbook) {
    await this.ensureSchemaAndBackfill();
    await this.replaceTables(logbook);
    return logbook;
  }

  async readSharedSheet(sheetId: string, isAuthenticated: boolean, ownerId?: string): Promise<{ sheet: LogSheet; boatName: string } | undefined> {
    await this.ensureSchemaAndBackfill();
    const sharedRow = ownerId
      ? await this.sheets.findSharedByScopedId(scopedId(ownerId, sheetId))
      : await this.sheets.findSharedByUnscopedId(sheetId);
    if (!sharedRow?.owner_id) return undefined;

    const share = LogSheetsRepository.toLogbook([], [sharedRow], [], []).sheets[0]?.share ?? defaultLogSheetShareSettings;
    const visibility = sectionVisibility(share, isAuthenticated);
    if (!Object.values(visibility).some(Boolean)) return undefined;

    const [boatRow, crewRows, lineRows] = await Promise.all([
      visibility.masterData ? this.boats.findByScopedId(sharedRow.boat_id) : undefined,
      (visibility.skipper || visibility.crew) ? this.crew.findForSheet(sharedRow.id, sharedRow.owner_id) : [],
      visibility.logLines ? this.lines.findForSheet(sharedRow.id) : [],
    ]);
    const logbook = LogSheetsRepository.toLogbook(boatRow ? [boatRow] : [], [sharedRow], crewRows, lineRows);
    const sheet = logbook.sheets[0];
    if (!sheet) return undefined;
    const boat = logbook.boats.find((candidate) => candidate.id === sheet.boatId);
    return { sheet: filterSharedSheet(sheet, visibility), boatName: visibility.masterData ? boat?.name ?? "" : "" };
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
    await this.crew.ensurePrimaryProfile(this.ownerId);
  }
}

type SectionVisibility = Record<keyof NonNullable<LogSheet["share"]>, boolean>;

function sectionVisibility(share: NonNullable<LogSheet["share"]>, isAuthenticated: boolean): SectionVisibility {
  return {
    masterData: canViewSection(share.masterData, isAuthenticated),
    picture: canViewSection(share.picture, isAuthenticated),
    logLines: canViewSection(share.logLines, isAuthenticated),
    metrics: canViewSection(share.metrics, isAuthenticated),
    technicalLog: canViewSection(share.technicalLog, isAuthenticated),
    skipper: canViewSection(share.skipper, isAuthenticated),
    crew: canViewSection(share.crew, isAuthenticated),
  };
}

function canViewSection(privacy: LogSheet["share"] extends infer Share ? Share extends undefined ? never : Share[keyof Share] : never, isAuthenticated: boolean) {
  return privacy === "public" || (privacy === "registered" && isAuthenticated);
}

function filterSharedSheet(sheet: LogSheet, visibility: SectionVisibility): LogSheet {
  const crew = visibility.crew
    ? sheet.crew.filter((_, index) => visibility.skipper || index !== 0)
    : visibility.skipper && sheet.crew[0]
      ? [sheet.crew[0]]
      : [];
  return {
    ...sheet,
    boatId: visibility.masterData ? sheet.boatId : "",
    route: visibility.masterData ? sheet.route : { from: "", to: "", departed: "", arrived: "" },
    image: visibility.picture ? sheet.image : undefined,
    lines: visibility.logLines ? sheet.lines : [],
    metrics: visibility.metrics ? sheet.metrics : undefined,
    technicalChecks: visibility.technicalLog ? sheet.technicalChecks : [],
    crew,
  };
}
