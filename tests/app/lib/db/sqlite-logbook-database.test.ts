import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultDeviationTable } from "../../../../app/models/logbook";
import { SqliteLogbookDatabase } from "../../../../app/lib/db/sqlite-logbook-database";
import { sampleLogSheets } from "../../../fixtures/logbook";
import { calculateLogSheetMetrics } from "../../../../app/domain/logbook/sheet-metrics";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("SqliteLogbookDatabase", () => {
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

    const created = { ...source.lines[2], id: "created-line", motorMiles: 7, sailMiles: 3, motorHours: 2 };
    await db.createLogLine(first.id, created);
    await db.updateLogLine(first.id, created.id, { ...created, motorMiles: 9, remarks: "updated" });
    await db.reorderLogLines(first.id, [created.id, first.lines[1].id, first.lines[0].id]);
    await db.deleteLogLine(first.id, created.id);

    const persisted = await db.readLogbook();
    const changed = persisted.sheets.find(sheet => sheet.id === first.id)!;
    expect(changed.lines.map(line => line.id)).toEqual([first.lines[1].id]);
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
    await expect(owner.upsertBoat(initial)).resolves.toMatchObject(initial);
    await expect(owner.upsertBoat({ ...initial, name: "Updated" })).resolves.toMatchObject({ name: "Updated" });
    const other = new SqliteLogbookDatabase(path).forUser("owner-b");
    await expect(other.deleteBoat(initial.id)).resolves.toBeUndefined();
    await expect(owner.readLogbook()).resolves.toMatchObject({ boats: [{ name: "Updated" }] });
    await expect(owner.deleteBoat(initial.id)).resolves.toMatchObject({ id: initial.id });
  });

  it("enforces referenced and archived boat policies for focused mutations", async () => {
    const db = new SqliteLogbookDatabase(await tempDatabasePath()).forUser("policy-user");
    await db.migrate();
    await db.query("insert into users (id, name, email, password_hash) values (?, ?, ?, ?)", ["policy-user", "Policy", "policy@example.test", ""]);
    const boat = { id: "boat-1", archived: true, name: "Archived", type: "Sail" as const, registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: defaultDeviationTable() };
    await db.upsertBoat(boat);
    const sheet = { id: "sheet-1", title: "Trip", status: "Draft" as const, boatId: boat.id, route: { from: "", to: "", departed: "", arrived: "" }, crew: [], watchPlan: [], technicalChecks: [], lines: [] };
    await expect(db.upsertLogSheet(sheet)).rejects.toMatchObject({ code: "archived_boat_for_new_sheet" });
    await db.upsertBoat({ ...boat, archived: false });
    await db.upsertLogSheet(sheet);
    await expect(db.deleteBoat(boat.id)).rejects.toMatchObject({ code: "referenced_boat_deleted" });
    await expect(db.deleteLogSheet(sheet.id)).resolves.toMatchObject({ id: sheet.id });
    await expect(db.deleteBoat(boat.id)).resolves.toMatchObject({ id: boat.id });
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
      if (sql.startsWith("update log_sheets set motor_miles")) throw new Error("simulated metrics failure");
      return query(sql, values);
    });

    await expect(db.upsertLogSheet({ ...original, title: "Must roll back" })).rejects.toThrow("simulated metrics failure");
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

    await expect(Promise.all([
      db.upsertLogSheet({ ...sheet, title: "First queued edit" }),
      db.upsertLogSheet({ ...sheet, title: "Second queued edit" }),
    ])).resolves.toHaveLength(2);

    await expect(db.readLogbook()).resolves.toMatchObject({ sheets: [{ title: "Second queued edit" }] });
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
