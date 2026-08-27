import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultDeviationTable } from "../../../../app/models/logbook";
import { SqliteLogbookDatabase } from "../../../../app/lib/db/sqlite-logbook-database";
import { sampleBoats, sampleLogSheets } from "../../../fixtures/logbook";
import { calculateLogSheetMetrics } from "../../../../app/domain/logbook/sheet-metrics";

const tempDirs: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("SqliteLogbookDatabase", () => {
  it("keeps crew-independent focused mutations independent from the encryption backfill", async () => {
    const db = new SqliteLogbookDatabase(await tempDatabasePath()).forUser("focused-user");
    await db.migrate();
    await db.query("insert into users (id, name, email, password_hash) values (?, ?, ?, ?)", ["focused-user", "Focused", "focused@example.test", ""]);
    await db.query("insert into crew_members (id, name, nationality, role, owner_id) values (?, ?, ?, ?, ?)", ["focused-user:legacy-crew", "Legacy plaintext", "", "Crew", "focused-user"]);

    const boat = { id: "boat-1", name: "Boat", type: "Sail" as const, registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: defaultDeviationTable() };
    const createdBoat = await db.upsertBoat(boat);
    const sheet = { id: "sheet-1", title: "Trip", status: "Draft" as const, boatId: boat.id, route: { from: "", to: "", departed: "", arrived: "" }, crew: [], watchPlan: [], technicalChecks: [], lines: [] };
    await db.upsertLogSheet(sheet);

    vi.stubEnv("CREW_DATA_ENCRYPTION_KEY", "");
    await expect(db.createStoredImage("unattached", { data: "aW1hZ2U=", mimeType: "image/png", width: 1, height: 1 })).resolves.toMatchObject({ id: "unattached" });
    await expect(db.readStoredImage("unattached")).resolves.toMatchObject({ id: "unattached" });
    await expect(db.deleteStoredImage("unattached")).resolves.toBe(true);
    await expect(db.createLogLine(sheet.id, sampleLogSheets[0].lines[0])).resolves.toMatchObject({ id: sampleLogSheets[0].lines[0].id });
    await expect(db.deleteBoat(boat.id, createdBoat!.revision!)).rejects.toMatchObject({ code: "referenced_boat_deleted" });
  });

  it("updates sheet metadata atomically without rewriting lines, engine hours, or unrelated sheets", async () => {
    const db = new SqliteLogbookDatabase(await tempDatabasePath()).forUser("metadata-user");
    await db.migrate();
    await db.query("insert into users (id, name, email, password_hash) values (?, ?, ?, ?)", ["metadata-user", "Metadata", "metadata@example.test", ""]);
    const boat = { ...sampleBoats[0], id: "boat-1" };
    await db.upsertBoat(boat);
    const source = sampleLogSheets[0];
    const line = { ...source.lines[0], engineHours: { "main-engine": 1.25 }, motorHours: 1.25 };
    const affected = { ...source, id: "affected", boatId: boat.id, crew: [], lines: [line] };
    const unrelated = { ...source, id: "unrelated", title: "Untouched", boatId: boat.id, crew: [], lines: source.lines.slice(1, 3) };
    await db.upsertLogSheet(affected);
    await db.upsertLogSheet(unrelated);
    await db.query("update log_sheets set created_at = ?, updated_at = ? where id = ?", ["2025-01-01T00:00:00.000Z", "2025-01-02T00:00:00.000Z", "metadata-user:affected"]);

    const linesBefore = await db.query("select * from log_lines order by sheet_id, sort_order");
    const engineHoursBefore = await db.query("select * from log_line_engine_hours order by sheet_id, line_sort_order, engine_id");
    expect(engineHoursBefore.rows).toEqual([
      { sheet_id: "metadata-user:affected", line_sort_order: 0, engine_id: "metadata-user:boat-1:main-engine", runtime_hours: 1.25 },
    ]);
    const unrelatedBefore = await db.query("select * from log_sheets where id = ?", ["metadata-user:unrelated"]);
    const sheetBefore = (await db.query<{ revision: number; created_at: string; updated_at: string }>("select revision, created_at, updated_at from log_sheets where id = ?", ["metadata-user:affected"])).rows[0];
    const persisted = (await db.readLogbook()).sheets.find((sheet) => sheet.id === affected.id)!;

    await db.upsertLogSheet({ ...persisted, title: "Metadata changed", route: { ...persisted.route, to: "New destination" }, lines: [{ ...line, remarks: "must be ignored" }] });

    expect(await db.query("select * from log_lines order by sheet_id, sort_order")).toEqual(linesBefore);
    expect(await db.query("select * from log_line_engine_hours order by sheet_id, line_sort_order, engine_id")).toEqual(engineHoursBefore);
    expect(await db.query("select * from log_sheets where id = ?", ["metadata-user:unrelated"])).toEqual(unrelatedBefore);
    const sheetAfter = (await db.query<{ title: string; revision: number; created_at: string; updated_at: string }>("select title, revision, created_at, updated_at from log_sheets where id = ?", ["metadata-user:affected"])).rows[0];
    expect(sheetAfter).toMatchObject({ title: "Metadata changed", revision: sheetBefore.revision + 1, created_at: sheetBefore.created_at });
    expect(new Date(sheetAfter.updated_at).getTime()).toBeGreaterThan(new Date(sheetBefore.updated_at).getTime());
  });

  it("mutates only the addressed line and sheet while keeping cached metrics current", async () => {
    const db = new SqliteLogbookDatabase(await tempDatabasePath()).forUser("focused-lines");
    await db.migrate();
    await db.query("insert into users (id, name, email, password_hash) values (?, ?, ?, ?)", ["focused-lines", "Lines", "focused@example.test", ""]);
    const boat = { id: "boat-1", name: "Boat", type: "Sail" as const, registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: defaultDeviationTable() };
    await db.upsertBoat(boat);
    const source = sampleLogSheets[0];
    const firstLines = source.lines.slice(0, 2).map(line => ({ ...line, motorHours: 0, engineHours: undefined }));
    const first = { ...source, id: "first", boatId: boat.id, crew: [], lines: firstLines };
    const unrelated = { ...source, id: "unrelated", title: "Do not touch", boatId: boat.id, crew: [], lines: source.lines.slice(2, 4) };
    await db.upsertLogSheet(first);
    await db.upsertLogSheet(unrelated);
    const untouchedBefore = await db.query("select * from log_lines where sheet_id = ? order by sort_order", ["focused-lines:unrelated"]);

    const created = { ...source.lines[2], id: "created-line", motorMiles: 7, sailMiles: 3, engineHours: { "main-engine": 2 }, motorHours: 2 };
    await db.createLogLine(first.id, created);
    const createdWithRevision = (await db.readLogbook()).sheets.find(sheet => sheet.id === first.id)!.lines.find(line => line.id === created.id)!;
    await db.updateLogLine(first.id, created.id, { ...created, revision: createdWithRevision!.revision, motorMiles: 9, engineHours: { "main-engine": 3 }, motorHours: 3, remarks: "updated" });
    await db.reorderLogLines(first.id, [created.id, first.lines[1].id, first.lines[0].id]);
    const updatedLine = (await db.readLogbook()).sheets.find(sheet => sheet.id === first.id)!.lines.find(line => line.id === created.id)!;
    await expect(db.deleteLogLine(first.id, created.id, createdWithRevision.revision!)).rejects.toMatchObject({ code: "revision_conflict" });
    expect((await db.readLogbook()).sheets.find(sheet => sheet.id === first.id)!.lines).toContainEqual(expect.objectContaining({ id: created.id, engineHours: { "main-engine": 3 }, motorHours: 3, remarks: "updated" }));
    await db.deleteLogLine(first.id, created.id, updatedLine.revision!);

    const persisted = await db.readLogbook();
    const changed = persisted.sheets.find(sheet => sheet.id === first.id)!;
    expect(changed.lines.map(line => line.id)).toEqual([first.lines[1].id, first.lines[0].id]);
    expect(calculateLogSheetMetrics(changed.lines, changed.route)).toMatchObject(changed.metrics!);
    expect(await db.query("select * from log_lines where sheet_id = ? order by sort_order", ["focused-lines:unrelated"])).toEqual(untouchedBefore);
    expect(persisted.sheets.find(sheet => sheet.id === unrelated.id)).toMatchObject({ title: unrelated.title, lines: unrelated.lines });
  });

  it("scopes focused create, update, and delete mutations to their owner", async () => {
    const path = await tempDatabasePath();
    const owner = new SqliteLogbookDatabase(path).forUser("owner-a");
    await owner.migrate();
    await owner.query("insert into users (id, name, email, password_hash) values (?, ?, ?, ?), (?, ?, ?, ?)", ["owner-a", "A", "a@example.test", "", "owner-b", "B", "b@example.test", ""]);
    const initial = { id: "shared-id", name: "Owner A boat", type: "Sail" as const, registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: defaultDeviationTable() };
    const created = await owner.upsertBoat(initial);
    await expect(owner.upsertBoat({ ...initial, revision: created!.revision, name: "Updated" })).resolves.toMatchObject({ name: "Updated" });
    const other = new SqliteLogbookDatabase(path).forUser("owner-b");
    await expect(other.deleteBoat(initial.id, 2)).resolves.toBeUndefined();
    await expect(owner.readLogbook()).resolves.toMatchObject({ boats: [{ name: "Updated" }] });
    await expect(owner.deleteBoat(initial.id, 1)).rejects.toMatchObject({ code: "revision_conflict" });
    await expect(owner.readLogbook()).resolves.toMatchObject({ boats: [{ id: initial.id, name: "Updated", revision: 2 }] });
    await expect(owner.deleteBoat(initial.id, 2)).resolves.toMatchObject({ id: initial.id });
  });

  it("enforces referenced and archived boat policies for focused mutations", async () => {
    const db = new SqliteLogbookDatabase(await tempDatabasePath()).forUser("policy-user");
    await db.migrate();
    await db.query("insert into users (id, name, email, password_hash) values (?, ?, ?, ?)", ["policy-user", "Policy", "policy@example.test", ""]);
    const boat = { id: "boat-1", archived: true, name: "Archived", type: "Sail" as const, registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: defaultDeviationTable() };
    const createdBoat = await db.upsertBoat(boat);
    const sheet = { id: "sheet-1", title: "Trip", status: "Draft" as const, boatId: boat.id, route: { from: "", to: "", departed: "", arrived: "" }, crew: [], watchPlan: [], technicalChecks: [], lines: [] };
    await expect(db.upsertLogSheet(sheet)).rejects.toMatchObject({ code: "archived_boat_for_new_sheet" });
    await db.upsertBoat({ ...boat, revision: createdBoat!.revision, archived: false });
    await db.upsertLogSheet(sheet);
    await expect(db.deleteBoat(boat.id, 2)).rejects.toMatchObject({ code: "referenced_boat_deleted" });
    await expect(db.deleteLogSheet(sheet.id, 1)).resolves.toMatchObject({ id: sheet.id });
    await expect(db.deleteBoat(boat.id, 2)).resolves.toMatchObject({ id: boat.id });
  });

  it("rolls back a failed focused sheet mutation", async () => {
    const db = new SqliteLogbookDatabase(await tempDatabasePath()).forUser("rollback-user");
    await db.migrate();
    await db.query("insert into users (id, name, email, password_hash) values (?, ?, ?, ?)", ["rollback-user", "Rollback", "rollback@example.test", ""]);
    const boat = { id: "boat-1", name: "Boat", type: "Sail" as const, registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: defaultDeviationTable() };
    await db.upsertBoat(boat);
    const original = { id: "sheet-1", title: "Original", status: "Draft" as const, boatId: boat.id, route: { from: "", to: "", departed: "", arrived: "" }, crew: [], watchPlan: [], technicalChecks: [], lines: [] };
    await db.upsertLogSheet(original);
    const query = db.query.bind(db);
    const failure = vi.spyOn(db, "query").mockImplementation(async (sql, values) => {
      if (sql.startsWith("update log_sheets set title")) throw new Error("simulated metadata failure");
      return query(sql, values);
    });

    const persistedBeforeFailure = (await db.readLogbook()).sheets.find(sheet => sheet.id === original.id)!;
    await expect(db.upsertLogSheet({ ...original, revision: persistedBeforeFailure.revision, title: "Must roll back" })).rejects.toThrow("simulated metadata failure");
    failure.mockRestore();

    const persisted = await db.readLogbook();
    expect(persisted.sheets.find(sheet => sheet.id === original.id)?.title).toBe("Original");
  });

  it("serializes concurrent focused mutations for the same sheet", async () => {
    const db = new SqliteLogbookDatabase(await tempDatabasePath()).forUser("concurrent-user");
    await db.migrate();
    await db.query("insert into users (id, name, email, password_hash) values (?, ?, ?, ?)", ["concurrent-user", "Concurrent", "concurrent@example.test", ""]);
    const boat = { id: "boat-1", name: "Boat", type: "Sail" as const, registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: defaultDeviationTable() };
    await db.upsertBoat(boat);
    const source = sampleLogSheets[0];
    const sheet = { ...source, id: "sheet-1", boatId: boat.id, crew: [], lines: source.lines.slice(0, 2) };
    await db.upsertLogSheet(sheet);

    const persisted = (await db.readLogbook()).sheets.find(item => item.id === sheet.id)!;
    const results = await Promise.allSettled([
      db.upsertLogSheet({ ...sheet, revision: persisted.revision, title: "First queued edit" }),
      db.upsertLogSheet({ ...sheet, revision: persisted.revision, title: "Second queued edit" }),
    ]);
    expect(results.map(result => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(results.find(result => result.status === "rejected")).toMatchObject({ reason: { code: "revision_conflict" } });
  });

  it("requires every logbook access to be scoped to an explicit user", async () => {
    const db = new SqliteLogbookDatabase(await tempDatabasePath());

    await expect(db.readLogbook()).rejects.toThrow("must be scoped with forUser(userId)");
  });

  it("removes the retired shared demo identity during migration", async () => {
    const db = new SqliteLogbookDatabase(await tempDatabasePath());

    await db.migrate();

    await expect(db.query<{ id: string }>("select id from users where id = ?", ["legacy-user"])).resolves.toEqual({ rows: [] });
  });

  it("restores a missing primary crew profile when replacing a user logbook", async () => {
    const databasePath = await tempDatabasePath();
    const db = new SqliteLogbookDatabase(databasePath).forUser("new-user");
    await db.migrate();
    await db.query("insert into users (id, name, email, password_hash) values (?, ?, ?, ?)", ["new-user", "New User", "new@example.test", ""]);

    await db.writeLogbook({ boats: [], crewMembers: [], sheets: [] });

    await expect(new SqliteLogbookDatabase(databasePath).forUser("new-user").readLogbook()).resolves.toEqual({
      boats: [],
      crewMembers: [expect.objectContaining({ id: "me", name: "New User", nationality: "", role: "Owner", address: "", certificate: "", dateOfBirth: "", placeOfBirth: "", gender: "", identityDocumentType: "", identityDocumentNumber: "", identityDocumentIssuingDate: "", identityDocumentExpiryDate: "", isPrimary: true, revision: 1, createdAt: expect.any(String), updatedAt: expect.any(String) })],
      sheets: [],
    });
  });

  it("does not replace an intentionally empty user logbook that already has a crew profile", async () => {
    const databasePath = await tempDatabasePath();
    const db = new SqliteLogbookDatabase(databasePath).forUser("new-user");
    await db.migrate();
    await db.query("insert into users (id, name, email, password_hash) values (?, ?, ?, ?)", ["new-user", "New User", "new@example.test", ""]);
    const emptyUserLogbook = {
      boats: [],
      crewMembers: [{ id: "me", name: "New User", nationality: "", role: "", address: "", certificate: "", dateOfBirth: "", placeOfBirth: "", gender: "", identityDocumentType: "", identityDocumentNumber: "", identityDocumentIssuingDate: "", identityDocumentExpiryDate: "", isPrimary: true }],
      sheets: [],
    };

    await db.writeLogbook(emptyUserLogbook);

    await expect(new SqliteLogbookDatabase(databasePath).forUser("new-user").readLogbook()).resolves.toEqual({ ...emptyUserLogbook, crewMembers: [expect.objectContaining({ ...emptyUserLogbook.crewMembers[0], revision: 1, createdAt: expect.any(String), updatedAt: expect.any(String) })] });
  });

  it("persists replaced logbook data and can read it from a new database wrapper", async () => {
    const databasePath = await tempDatabasePath();
    const firstWrapper = new SqliteLogbookDatabase(databasePath).forUser("new-user");
    await firstWrapper.migrate();
    await firstWrapper.query("insert into users (id, name, email, password_hash) values (?, ?, ?, ?)", ["new-user", "New User", "new@example.test", ""]);
    const updatedLogbook = {
      crewMembers: [],
      boats: [{ id: "boat-1", archived: true, name: "SY Repository Test", type: "Sail" as const, registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: defaultDeviationTable() }],
      sheets: [{ id: "sheet-1", title: "Repository integration test", status: "Draft" as const, boatId: "boat-1", route: { from: "", to: "", departed: "", arrived: "" }, crew: [], watchPlan: [], technicalChecks: [], lines: [] }],
    };

    await firstWrapper.writeLogbook(updatedLogbook);

    await expect(new SqliteLogbookDatabase(databasePath).forUser("new-user").readLogbook()).resolves.toMatchObject({ boats: updatedLogbook.boats, sheets: updatedLogbook.sheets });
  });

  it("retains line identifiers through reloads, independent edits, and reordering", async () => {
    const databasePath = await tempDatabasePath();
    const db = new SqliteLogbookDatabase(databasePath).forUser("line-id-user");
    await db.migrate();
    await db.query("insert into users (id, name, email, password_hash) values (?, ?, ?, ?)", ["line-id-user", "Line IDs", "lines@example.test", ""]);
    const boat = { id: "boat-1", archived: false, name: "ID test", type: "Sail" as const, registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: defaultDeviationTable() };
    const original = sampleLogSheets[0].lines.slice(0, 2).map((line) => ({ ...line, time: "2026-05-14T10:00" }));
    const sheet = { id: "sheet-1", title: "Stable IDs", status: "Draft" as const, boatId: boat.id, route: { from: "", to: "", departed: "", arrived: "" }, crew: [], watchPlan: [], technicalChecks: [], lines: [...original].reverse() };

    await db.writeLogbook({ boats: [boat], crewMembers: [], sheets: [sheet] });
    const reloaded = await new SqliteLogbookDatabase(databasePath).forUser("line-id-user").readLogbook();
    expect(reloaded.sheets[0].lines.map((line) => line.id)).toEqual(sheet.lines.map((line) => line.id));

    const editedLines = reloaded.sheets[0].lines.map((line) => ({ ...line, remarks: line.id === original[0].id ? "first edit" : "second edit" }));
    await db.writeLogbook({ ...reloaded, sheets: [{ ...reloaded.sheets[0], lines: editedLines }] });
    const edited = await new SqliteLogbookDatabase(databasePath).forUser("line-id-user").readLogbook();
    expect(Object.fromEntries(edited.sheets[0].lines.map((line) => [line.id, line.remarks]))).toEqual({ [original[0].id]: "first edit", [original[1].id]: "second edit" });
  });
});

async function tempDatabasePath() {
  const directory = await mkdtemp(join(tmpdir(), "ultilog-db-"));
  tempDirs.push(directory);
  return join(directory, "ultilog.sqlite");
}
