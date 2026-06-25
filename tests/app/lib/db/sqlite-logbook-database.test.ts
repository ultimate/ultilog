import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { sampleBoats, sampleLogSheets } from "../../../../resources/sample-data/logbook";
import { SqliteLogbookDatabase } from "../../../../app/lib/db/sqlite-logbook-database";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("SqliteLogbookDatabase", () => {
  it("creates an empty local database and seeds it from sample data", async () => {
    const db = new SqliteLogbookDatabase(await tempDatabasePath());

    await expect(db.readLogbook()).resolves.toEqual({ boats: sampleBoats, sheets: sampleLogSheets });
  });

  it("persists replaced logbook data and can read it from a new database wrapper", async () => {
    const databasePath = await tempDatabasePath();
    const firstWrapper = new SqliteLogbookDatabase(databasePath);
    const logbook = await firstWrapper.readLogbook();
    const updatedLogbook = {
      boats: [{ ...logbook.boats[0], name: "SY Repository Test" }],
      sheets: [{ ...logbook.sheets[0], title: "Repository integration test", boatId: logbook.boats[0].id }],
    };

    await firstWrapper.writeLogbook(updatedLogbook);

    await expect(new SqliteLogbookDatabase(databasePath).readLogbook()).resolves.toEqual(updatedLogbook);
  });
});

async function tempDatabasePath() {
  const directory = await mkdtemp(join(tmpdir(), "ultilog-db-"));
  tempDirs.push(directory);
  return join(directory, "ultilog.sqlite");
}
