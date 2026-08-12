import { defaultLogSheetShareSettings, type Boat, type CrewMember, type LogLine, type LogSheet, type PersistedLogbook } from "../../models/logbook";
import { BoatsRepository } from "../repositories/boats-repository";
import { CrewRepository } from "../repositories/crew-repository";
import { LogLinesRepository } from "../repositories/log-lines-repository";
import { expectedRevision, scopedId } from "../repositories/boats-repository";
import { LogSheetsRepository } from "../repositories/log-sheets-repository";
import { StoredImagesRepository } from "../repositories/stored-images-repository";
import { backfillCrewMemberEncryption } from "./encryption-backfill";
import { createHash } from "node:crypto";
import { referencedBoatDeletionError, sheetBoatMutationError } from "../../domain/boats/boat-policy";

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
  protected readonly images = new StoredImagesRepository(this);

  abstract placeholder(index: number): string;
  abstract query<Row>(sql: string, values?: unknown[]): Promise<QueryResult<Row>>;
  protected abstract ensureSchema(): Promise<void>;

  protected abstract withTransaction<T>(operation: (database: LogbookDatabase) => Promise<T>): Promise<T>;

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

  async createStoredImage(id: string, image: import("../../models/stored-image").StoredImage) {
    await this.ensureSchemaAndBackfill();
    return this.images.create(id, this.requireOwnerId(), image);
  }

  async readStoredImage(id: string) {
    await this.ensureSchemaAndBackfill();
    return this.images.findById(id, this.requireOwnerId());
  }

  async deleteStoredImage(id: string) {
    await this.ensureSchemaAndBackfill();
    return this.images.delete(id, this.requireOwnerId());
  }

  async upsertBoat(boat: Boat) {
    await this.ensureSchemaAndBackfill();
    return this.withTransaction(async (database) => {
      const ownerId = database.requireOwnerId();
      const previousImageId = (await database.boats.findById(boat.id, ownerId))?.image_id ?? undefined;
      const nextImageId = boat.imageId ?? boat.image?.id;
      await database.images.assertOwned(nextImageId, ownerId);
      await database.boats.upsert(boat, ownerId);
      if (previousImageId !== nextImageId) await database.images.deleteIfOrphaned(previousImageId, ownerId);
      const row = await database.boats.findById(boat.id, ownerId);
      return row ? LogSheetsRepository.toLogbook([row], [], [], []).boats[0] : undefined;
    });
  }

  async deleteBoat(id: string, revision: number) {
    await this.ensureSchemaAndBackfill();
    return this.withTransaction(async (database) => {
      const ownerId = database.requireOwnerId();
      const row = await database.boats.findById(id, ownerId);
      if (!row) return undefined;
      if (Number(row.revision) !== expectedRevision(revision)) throw Object.assign(new Error("The boat was changed by another request."), { code: "revision_conflict" });
      const entity = LogSheetsRepository.toLogbook([row], [], [], []).boats[0];
      const imageId = row.image_id ?? undefined;
      const policyError = referencedBoatDeletionError(entity, await database.boats.isReferenced(id, ownerId));
      if (policyError) throw Object.assign(new Error(policyError.message), { code: policyError.code });
      await database.boats.delete(id, ownerId, revision);
      await database.images.deleteIfOrphaned(imageId, ownerId);
      return entity;
    });
  }

  async upsertCrewMember(crew: CrewMember) {
    await this.ensureSchemaAndBackfill();
    return this.withTransaction(async (database) => {
      const ownerId = database.requireOwnerId();
      const previousImageId = (await database.crew.findProfile(crew.id, ownerId))?.image_id ?? undefined;
      const nextImageId = crew.imageId ?? crew.image?.id;
      await database.images.assertOwned(nextImageId, ownerId);
      await database.crew.upsert(crew, ownerId);
      if (previousImageId !== nextImageId) await database.images.deleteIfOrphaned(previousImageId, ownerId);
      const row = await database.crew.findProfile(crew.id, ownerId);
      return row ? LogSheetsRepository.toLogbook([], [], [], [], [row]).crewMembers[0] : undefined;
    });
  }

  async deleteCrewMember(id: string, revision: number) {
    await this.ensureSchemaAndBackfill();
    return this.withTransaction(async (database) => {
      const ownerId = database.requireOwnerId();
      const row = await database.crew.findProfile(id, ownerId);
      if (!row) return undefined;
      const entity = LogSheetsRepository.toLogbook([], [], [], [], [row]).crewMembers[0];
      const imageId = row.image_id ?? undefined;
      await database.crew.delete(id, ownerId, revision);
      await database.images.deleteIfOrphaned(imageId, ownerId);
      return entity;
    });
  }

  async upsertLogSheet(sheet: LogSheet) {
    await this.ensureSchemaAndBackfill();
    return this.withTransaction(async (database) => {
      const ownerId = database.requireOwnerId();
      const boatRow = await database.boats.findById(sheet.boatId, ownerId);
      const prior = await database.sheets.findById(sheet.id, ownerId);
      const previousImageId = prior?.image_id ?? undefined;
      const nextImageId = sheet.imageId ?? sheet.image?.id;
      await database.images.assertOwned(nextImageId, ownerId);
      for (const member of sheet.crew) await database.images.assertOwned(member.imageId ?? member.image?.id, ownerId);
      const policyError = sheetBoatMutationError(boatRow ? { name: boatRow.name, archived: Boolean(boatRow.archived) } : undefined, Boolean(prior && prior.boat_id === scopedId(ownerId, sheet.boatId)));
      if (policyError) throw Object.assign(new Error(policyError.message), { code: policyError.code });
      if (!boatRow) throw new Error("Boat policy failed to reject a missing boat.");
      const threshold = await database.motionStationaryThresholdNm();
      const persistedLineRows = prior ? await database.lines.findForSheet(prior.id) : [];
      const persistedLines = prior ? LogSheetsRepository.toLogbook([], [prior], [], persistedLineRows).sheets[0].lines : [];
      await database.sheets.upsert({ ...sheet, lines: persistedLines }, ownerId, threshold);
      await database.crew.replaceAssignments(sheet.id, sheet.crew, ownerId);
      // Focused sheet writes own metadata and assignments only. Log lines are
      // independently versioned resources and are never collection-replaced.
      // Internal imports may still seed a brand-new aggregate in one operation;
      // focused HTTP creates always pass an empty collection.
      if (!prior && sheet.lines.length) await database.lines.insertMany(sheet.lines.map((line, sortOrder) => ({ sheetId: sheet.id, sortOrder, line })), ownerId);
      if (!prior && sheet.lines.length) {
        const createdRow = (await database.sheets.findById(sheet.id, ownerId))!;
        const createdLineRows = await database.lines.findForSheet(createdRow.id);
        const createdLines = LogSheetsRepository.toLogbook([], [createdRow], [], createdLineRows).sheets[0].lines;
        await database.sheets.updateMetrics(sheet, createdLines, ownerId, threshold);
      }
      if (previousImageId !== nextImageId) await database.images.deleteIfOrphaned(previousImageId, ownerId);
      const [row, crew, lines] = await Promise.all([database.sheets.findById(sheet.id, ownerId), database.crew.findForSheet(scopedId(ownerId, sheet.id), ownerId), database.lines.findForSheet(scopedId(ownerId, sheet.id))]);
      return row ? LogSheetsRepository.toLogbook([], [row], crew, lines).sheets[0] : undefined;
    });
  }

  /** Creates a new sheet and its independently addressable lines atomically. */
  async createLogSheetAggregate(sheet: Omit<LogSheet, "lines">, lines: LogLine[]) {
    await this.ensureSchemaAndBackfill();
    return this.withTransaction(async (database) => {
      const ownerId = database.requireOwnerId();
      if (await database.sheets.findById(sheet.id, ownerId)) throw new Error("A log sheet with this id already exists.");

      const boatRow = await database.boats.findById(sheet.boatId, ownerId);
      const policyError = sheetBoatMutationError(boatRow ? { name: boatRow.name, archived: Boolean(boatRow.archived) } : undefined, false);
      if (policyError) throw Object.assign(new Error(policyError.message), { code: policyError.code });
      if (!boatRow) throw new Error("Boat policy failed to reject a missing boat.");

      await database.images.assertOwned(sheet.imageId ?? sheet.image?.id, ownerId);
      for (const member of sheet.crew) await database.images.assertOwned(member.imageId ?? member.image?.id, ownerId);

      const focusedSheet: LogSheet = { ...sheet, lines: [] };
      const threshold = await database.motionStationaryThresholdNm();
      await database.sheets.insert(focusedSheet, ownerId, threshold);
      await database.crew.replaceAssignments(sheet.id, sheet.crew, ownerId);
      for (const line of lines) {
        const created = await database.lines.create(sheet.id, line, ownerId);
        if (!created) throw new Error("The new log sheet could not be addressed while creating its lines.");
      }

      const row = (await database.sheets.findById(sheet.id, ownerId))!;
      const lineRows = await database.lines.findForSheet(row.id);
      const persistedLines = LogSheetsRepository.toLogbook([], [row], [], lineRows).sheets[0].lines;
      await database.sheets.updateMetrics(sheet, persistedLines, ownerId, threshold);
      const [createdRow, crew] = await Promise.all([
        database.sheets.findById(sheet.id, ownerId),
        database.crew.findForSheet(row.id, ownerId),
      ]);
      return createdRow ? LogSheetsRepository.toLogbook([], [createdRow], crew, lineRows).sheets[0] : undefined;
    });
  }

  async deleteLogSheet(id: string, revision: number) {
    await this.ensureSchemaAndBackfill();
    return this.withTransaction(async (database) => {
      const ownerId = database.requireOwnerId();
      const row = await database.sheets.findById(id, ownerId);
      if (!row) return undefined;
      const [crew, lines] = await Promise.all([database.crew.findForSheet(row.id, ownerId), database.lines.findForSheet(row.id)]);
      const entity = LogSheetsRepository.toLogbook([], [row], crew, lines).sheets[0];
      const imageId = row.image_id ?? undefined;
      await database.sheets.delete(id, ownerId, revision);
      await database.images.deleteIfOrphaned(imageId, ownerId);
      return entity;
    });
  }

  async createLogLine(sheetId: string, line: LogLine) {
    return this.mutateLogLines(sheetId, database => database.lines.create(sheetId, line, database.requireOwnerId()));
  }

  async updateLogLine(sheetId: string, lineId: string, line: LogLine) {
    return this.mutateLogLines(sheetId, database => database.lines.update(sheetId, lineId, line, database.requireOwnerId()));
  }

  async deleteLogLine(sheetId: string, lineId: string, revision: number) {
    return this.mutateLogLines(sheetId, database => database.lines.delete(sheetId, lineId, database.requireOwnerId(), revision));
  }

  async reorderLogLines(sheetId: string, lineIds: string[]) {
    return this.mutateLogLines(sheetId, database => database.lines.reorder(sheetId, lineIds, database.requireOwnerId()));
  }

  private async mutateLogLines<T>(sheetId: string, mutation: (database: LogbookDatabase) => Promise<T | undefined>) {
    await this.ensureSchemaAndBackfill();
    return this.withTransaction(async database => {
      const ownerId = database.requireOwnerId();
      const sheetRow = await database.sheets.findById(sheetId, ownerId);
      if (!sheetRow) return undefined;
      const result = await mutation(database);
      if (result === undefined) return undefined;
      const lines = await database.lines.findForSheet(sheetRow.id);
      const sheet = LogSheetsRepository.toLogbook([], [sheetRow], [], lines).sheets[0];
      await database.sheets.updateMetrics(sheet, sheet.lines, ownerId, await database.motionStationaryThresholdNm());
      return result;
    });
  }

  async readSharedSheet(sheetId: string, isAuthenticated: boolean, ownerId?: string): Promise<{ sheet: LogSheet; boatName: string; ownerAvatar?: string; showOwnerAvatarOnPrint?: boolean } | undefined> {
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
    const owner = (await this.query<{ email: string; avatar_data: string | null; avatar_mime_type: string | null; show_avatar_on_print: number | boolean }>(
      `select email, avatar_data, avatar_mime_type, show_avatar_on_print from users where id = ${this.placeholder(1)}`,
      [sharedRow.owner_id],
    )).rows[0];
    const showOwnerAvatarOnPrint = owner ? Boolean(owner.show_avatar_on_print) : false;
    const ownerAvatar = owner && showOwnerAvatarOnPrint
      ? owner.avatar_data && owner.avatar_mime_type
        ? `data:${owner.avatar_mime_type};base64,${owner.avatar_data}`
        : `https://www.gravatar.com/avatar/${createHash("sha256").update(owner.email.trim().toLowerCase()).digest("hex")}?s=256&d=mp`
      : undefined;
    return { sheet: filterSharedSheet(sheet, visibility), boatName: visibility.masterData ? boat?.name ?? "" : "", ownerAvatar, showOwnerAvatarOnPrint };
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
