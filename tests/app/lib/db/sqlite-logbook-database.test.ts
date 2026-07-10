import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { defaultDeviationTable } from "../../../../app/models/logbook";
import { SqliteLogbookDatabase } from "../../../../app/lib/db/sqlite-logbook-database";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("SqliteLogbookDatabase", () => {
  it("creates an empty local database without sample data", async () => {
    const db = new SqliteLogbookDatabase(await tempDatabasePath());

    await expect(db.readLogbook()).resolves.toEqual({ boats: [], crewMembers: [{ id: "me", name: "Local demo user", nationality: "", role: "Owner", address: "", certificate: "", isPrimary: true }], sheets: [] });
  });

  it("does not replace an intentionally empty user logbook that already has a crew profile", async () => {
    const databasePath = await tempDatabasePath();
    const db = new SqliteLogbookDatabase(databasePath).forUser("new-user");
    await db.migrate();
    await db.query("insert into users (id, name, email, password_hash) values (?, ?, ?, ?)", ["new-user", "New User", "new@example.test", ""]);
    const emptyUserLogbook = {
      boats: [],
      crewMembers: [{ id: "me", name: "New User", nationality: "", role: "", address: "", certificate: "", isPrimary: true }],
      sheets: [],
    };

    await db.writeLogbook(emptyUserLogbook);

    await expect(new SqliteLogbookDatabase(databasePath).forUser("new-user").readLogbook()).resolves.toEqual(emptyUserLogbook);
  });

  it("persists replaced logbook data and can read it from a new database wrapper", async () => {
    const databasePath = await tempDatabasePath();
    const firstWrapper = new SqliteLogbookDatabase(databasePath);
    const updatedLogbook = {
      crewMembers: [],
      boats: [{ id: "boat-1", name: "SY Repository Test", type: "Sail" as const, registration: "", flagState: "", homePort: "", owner: "", dimensions: "", yachtData: {}, deviationTable: defaultDeviationTable() }],
      sheets: [{ id: "sheet-1", title: "Repository integration test", dateRange: "2026-07-10", status: "Draft" as const, boatId: "boat-1", route: { from: "", to: "", departed: "", arrived: "" }, crew: [], watchPlan: [], technicalChecks: [], lines: [] }],
    };

    await firstWrapper.writeLogbook(updatedLogbook);

    await expect(new SqliteLogbookDatabase(databasePath).readLogbook()).resolves.toMatchObject({ boats: updatedLogbook.boats, sheets: updatedLogbook.sheets });
  });
});

async function tempDatabasePath() {
  const directory = await mkdtemp(join(tmpdir(), "ultilog-db-"));
  tempDirs.push(directory);
  return join(directory, "ultilog.sqlite");
}
