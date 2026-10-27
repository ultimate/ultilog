import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SqliteLogbookDatabase } from "../../../../app/lib/db/sqlite-logbook-database";
import * as schema from "../../../../app/lib/db/schema";
import { sampleBoats, sampleLogSheets } from "../../../fixtures/logbook";
import { lineFormToLogLine } from "../../../../app/domain/log-lines/log-line-form";
import { defaultLineForm } from "../../../../app/components/logbook/forms";

const directories: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function database() {
  const directory = await mkdtemp(join(tmpdir(), "log-sheet-editor-"));
  directories.push(directory);
  return new SqliteLogbookDatabase(join(directory, "logbook.sqlite")).forUser("owner");
}
async function seed(db: SqliteLogbookDatabase) {
  await db.query("insert into users (id, name, email, password_hash) values (?, ?, ?, ?)", ["owner", "Owner", "owner@example.test", ""]);
  await db.upsertBoat(sampleBoats[1]);
  const sheet = { ...sampleLogSheets[1], id: "sheet", boatId: sampleBoats[1].id, crew: [], lines: [{ ...sampleLogSheets[1].lines[0], engineHours: { "port-engine": 1, "starboard-engine": 1 } }] };
  await db.upsertLogSheet(sheet);
  return sheet;
}

describe("log sheet editor database contract", () => {
  it("acknowledges saved field changes atomically and follows lines through reorder and deletion", async () => {
    const db = await database();
    await db.migrate();
    await seed(db);
    const first = { ...sampleLogSheets[1].lines[0], id: "first", engineHours: {} };
    const second = { ...first, id: "second" };
    await db.createLogSheetAggregate({ ...sampleLogSheets[1], id: "warnings", boatId: sampleBoats[1].id, crew: [], source: "scanner", scannerWarnings: [
      { id: "coordinates", code: "missingFields", row: 1, fields: ["latitude", "longitude"] },
      { id: "pressure", code: "missingFields", row: 1, fields: ["barometer"] },
      { id: "second", code: "missingFields", row: 2, fields: ["latitude"] },
      { id: "sheet", code: "missingSheetTitle" },
    ] }, [first, second]);
    const read = async () => (await db.readLogbook()).sheets.find(sheet => sheet.id === "warnings")!;
    let stored = await read();
    const initialRevision = stored.revision!;
    await db.updateLogLine("warnings", "first", { ...stored.lines[0], remarks: "unrelated edit" });
    stored = await read();
    expect(stored.scannerWarnings?.some(warning => warning.acknowledgedAt)).toBe(false);
    expect(stored.revision).toBe(initialRevision);
    const stale = stored.lines[0];
    await db.updateLogLine("warnings", "first", { ...stale, latitude: (stale.latitude ?? 0) + 1 });
    stored = await read();
    expect(stored.scannerWarnings?.[0].acknowledgedAt).toEqual(expect.any(String));
    expect(stored.scannerWarnings?.slice(1).some(warning => warning.acknowledgedAt)).toBe(false);
    expect(stored.revision).toBe(initialRevision + 1);
    await expect(db.updateLogLine("warnings", "first", { ...stale, barometer: 999 })).rejects.toThrow("changed by another request");
    expect((await read()).scannerWarnings).toEqual(stored.scannerWarnings);
    const history = stored.scannerWarnings?.[0].acknowledgedAt;
    await db.reorderLogLines("warnings", ["second", "first"]);
    stored = await read();
    expect(stored.scannerWarnings?.find(warning => warning.id === "coordinates")).toMatchObject({ row: 2, acknowledgedAt: history });
    expect(stored.scannerWarnings?.find(warning => warning.id === "second")).toMatchObject({ row: 1 });
    await db.deleteLogLine("warnings", "first", stored.lines.find(line => line.id === "first")!.revision!);
    stored = await read();
    expect(stored.scannerWarnings?.map(warning => warning.id)).toEqual(["second", "sheet"]);
    expect(stored.scannerWarnings?.[0]).toMatchObject({ row: 1 });
    await db.updateLogLine("warnings", "second", stored.lines[0]);
    expect((await read()).scannerWarnings?.[0].acknowledgedAt).toBeUndefined();
  });

  it("rolls back both the line and its acknowledgment when the transaction fails", async () => {
    const db = await database();
    await db.migrate();
    await seed(db);
    const first = { ...sampleLogSheets[1].lines[0], id: "first", engineHours: {}, temperature: null, barometer: null, windStrength: null, waves: null, tide: null, compassCourse: null, deviation: null, magneticCourse: null, variation: null, trueCourse: null, windDrift: null, courseThroughWater: null, currentDrift: null, courseOverGround: null, speedKn: null, logNm: null, sailMiles: null, motorMiles: null };
    await db.createLogSheetAggregate({ ...sampleLogSheets[1], id: "atomic", boatId: sampleBoats[1].id, crew: [], source: "scanner", scannerWarnings: [{ id: "pressure", code: "missingFields", row: 1, fields: ["barometer"] }] }, [first]);
    const before = (await db.readLogbook()).sheets.find(sheet => sheet.id === "atomic")!;
    for (const field of ["temperature", "barometer", "windStrength", "waves", "tide", "compassCourse", "speedKn", "logNm", "sailMiles", "motorMiles"] as const) expect(before.lines[0][field]).toBeNull();
    // Intercept the adapter's transaction-scoped queries too.
    const query = SqliteLogbookDatabase.prototype.query;
    const failure = vi.spyOn(SqliteLogbookDatabase.prototype, "query").mockImplementation(function (this: SqliteLogbookDatabase, sql, values) {
      if (sql.startsWith("update log_sheets set motor_miles")) throw new Error("metrics failure");
      return query.call(this, sql, values);
    });
    await expect(db.updateLogLine("atomic", "first", { ...before.lines[0], barometer: 0 })).rejects.toThrow("metrics failure");
    failure.mockRestore();
    const after = (await db.readLogbook()).sheets.find(sheet => sheet.id === "atomic")!;
    expect(after.lines[0]).toEqual(before.lines[0]);
    expect(after.scannerWarnings).toEqual(before.scannerWarnings);
    expect(after.revision).toBe(before.revision);
    await db.updateLogLine("atomic", "first", { ...after.lines[0], barometer: 0 });
    const saved = (await db.readLogbook()).sheets.find(sheet => sheet.id === "atomic")!;
    expect(saved.lines[0].barometer).toBe(0);
    expect(saved.scannerWarnings?.[0].acknowledgedAt).toEqual(expect.any(String));
  });

  it("upgrades existing rows without losing engine records, indexes or concurrency metadata", async () => {
    const db = await database();
    const migrations = await schema.readMigrations();
    const oldMigrations = vi.spyOn(schema, "readMigrations").mockResolvedValue(migrations.filter(migration => migration.id !== "054_log_sheet_editor"));
    await db.migrate();
    // Current repositories need this metadata column while seeding the pre-054 schema.
    await db.query("alter table log_sheets add column scanner_warnings_dismissed integer not null default 0");
    const sheet = await seed(db);
    await db.query("alter table log_sheets drop column scanner_warnings_dismissed");
    const linesBefore = (await db.query("select * from log_lines")).rows;
    const hoursBefore = (await db.query("select * from log_line_engine_hours")).rows;
    const foreignKeysBefore = (await db.query("select * from pragma_foreign_key_check")).rows;
    await db.query("update log_sheets set motor_hours = 2 where id = ?", ["owner:sheet"]);
    oldMigrations.mockRestore();
    await db.migrate();
    expect((await db.query("select * from log_lines")).rows).toEqual(linesBefore);
    expect((await db.query("select * from log_line_engine_hours")).rows).toEqual(hoursBefore);
    expect((await db.query("select * from pragma_foreign_key_check")).rows).toEqual(foreignKeysBefore);
    expect((await db.query("select name from sqlite_master where type = 'index' and tbl_name = 'log_lines' and sql is not null")).rows.length).toBeGreaterThan(0);
    const stored = (await db.readLogbook()).sheets.find(candidate => candidate.id === sheet.id)!;
    expect(stored.metrics?.motorHours).toBe(1);
    expect(stored.lines[0].engineHours).toEqual({ "port-engine": 1, "starboard-engine": 1 });
    await db.updateLogLine(sheet.id, stored.lines[0].id, { ...stored.lines[0], temperature: null, logNm: null, engineHours: { "port-engine": 0 } });
    const reloaded = (await db.readLogbook()).sheets.find(candidate => candidate.id === sheet.id)!;
    expect(reloaded.lines[0]).toMatchObject({ temperature: null, logNm: null, engineHours: { "port-engine": 0 } });
    expect(reloaded.lines[0].revision).toBe(stored.lines[0].revision! + 1);
  });

  it("persists incomplete scanner drafts and warning dismissal, rejects locking, and strips warnings from shares", async () => {
    const db = await database();
    await db.migrate();
    await seed(db);
    const incomplete = lineFormToLogLine({ ...defaultLineForm, id: "incomplete" }, { scannerDraft: true });
    const created = await db.createLogSheetAggregate({ ...sampleLogSheets[0], id: "scan", boatId: sampleBoats[1].id, crew: [], source: "scanner", scannerWarningsDismissed: true, scannerWarnings: [{ id: "warning", code: "missingFields", row: 9, fields: ["temperature"], acknowledgedAt: "2026-10-24T10:30:00Z" }], share: { masterData: "public", logLines: "public", metrics: "public", remarks: "private", picture: "private", technicalLog: "private", skipper: "private", crew: "private" } }, [incomplete]);
    expect(created?.lines[0]).toMatchObject({ time: "", latitude: null, longitude: null, temperature: null });
    expect(created?.scannerWarningsDismissed).toBe(true);
    await expect(db.upsertLogSheet({ ...created!, status: "Locked" })).rejects.toThrow("required before locking");
    const shared = await db.readSharedSheet("scan", false, "owner");
    expect(shared?.sheet).not.toHaveProperty("scannerWarnings");
    expect(shared?.sheet).not.toHaveProperty("scannerWarningsDismissed");
    expect(shared?.sheet).not.toHaveProperty("verificationNote");
    const restored = await db.upsertLogSheet({ ...created!, scannerWarnings: created!.scannerWarnings!.map(({ acknowledgedAt: _ack, ...warning }) => warning) });
    expect(restored?.scannerWarningsDismissed).toBeUndefined();
    const reloaded = (await db.readLogbook()).sheets.find(sheet => sheet.id === "scan")!;
    expect(reloaded.scannerWarnings?.[0].acknowledgedAt).toBeUndefined();
    const corrected = await db.updateLogLine("scan", incomplete.id, { ...reloaded.lines[0], time: "2026-10-24T10:30:00+00:00", latitude: 0, longitude: 0 });
    expect(corrected?.latitude).toBe(0);
    await expect(db.upsertLogSheet({ ...reloaded, status: "Locked" })).resolves.toMatchObject({ status: "Locked" });
  });
});
