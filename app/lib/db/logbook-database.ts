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
  protected ownerId: string | undefined;
  protected readonly sheets = new LogSheetsRepository(this);
  protected readonly crew = new CrewRepository(this);
  protected readonly lines = new LogLinesRepository(this);

  abstract placeholder(index: number): string;
  abstract query<Row>(sql: string, values?: unknown[]): Promise<QueryResult<Row>>;
  protected abstract ensureSchema(): Promise<void>;

  async flush() {}

  async migrate() {
    await this.ensureSchemaAndBackfill();
  }

  forUser(userId: string) {
    if (!userId.trim()) throw new Error("A user id is required to access a logbook.");
    this.ownerId = userId;
    return this;
  }

  protected requireOwnerId() {
    if (!this.ownerId) throw new Error("Logbook database access must be scoped with forUser(userId).");
    return this.ownerId;
  }
  protected async ensureSchemaAndBackfill() {
    await this.ensureSchema();
    await backfillCrewMemberEncryption(this);
  }

  protected abstract insertLogbook(logbook: PersistedLogbook): Promise<void>;

  protected async motionStationaryThresholdNm() {
    const row = (await this.query<{ motion_stationary_threshold_nm?: number | string | null }>(`select motion_stationary_threshold_nm from users where id = ${this.placeholder(1)}`, [this.requireOwnerId()])).rows[0];
    const threshold = Number(row?.motion_stationary_threshold_nm);
    return Number.isFinite(threshold) && threshold >= 0 ? threshold : 0.1;
  }

  async readLogbook(): Promise<PersistedLogbook> {
    await this.ensureSchemaAndBackfill();
    await this.crew.ensurePrimaryProfile(this.requireOwnerId());
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
    const ownerId = this.requireOwnerId();
    const [boats, sheets, crewProfiles, crew, lines] = await Promise.all([
      this.boats.findAll(ownerId),
      this.sheets.findAll(ownerId),
      this.crew.findProfiles(ownerId),
      this.crew.findAll(ownerId),
      this.lines.findAll(ownerId),
    ]);
    return LogSheetsRepository.toLogbook(boats, sheets, crew, lines, crewProfiles);
  }

  protected async deleteTables() {
    const ownerId = this.requireOwnerId();
    await this.lines.deleteAll(ownerId);
    await this.crew.deleteAll(ownerId);
    await this.sheets.deleteAll(ownerId);
    await this.boats.deleteAll(ownerId);
  }

  private async replaceTables(logbook: PersistedLogbook) {
    await this.deleteTables();
    await this.insertLogbook(logbook);
    await this.crew.ensurePrimaryProfile(this.requireOwnerId());
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
