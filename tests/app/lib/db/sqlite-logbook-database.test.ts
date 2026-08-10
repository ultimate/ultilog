import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { defaultDeviationTable } from "../../../../app/models/logbook";
import { SqliteLogbookDatabase } from "../../../../app/lib/db/sqlite-logbook-database";
import { sampleLogSheets } from "../../../fixtures/logbook";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("SqliteLogbookDatabase", () => {
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
      crewMembers: [{ id: "me", name: "New User", nationality: "", role: "Owner", address: "", certificate: "", dateOfBirth: "", placeOfBirth: "", gender: "", identityDocumentType: "", identityDocumentNumber: "", identityDocumentIssuingDate: "", identityDocumentExpiryDate: "", isPrimary: true }],
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

    await expect(new SqliteLogbookDatabase(databasePath).forUser("new-user").readLogbook()).resolves.toEqual(emptyUserLogbook);
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
