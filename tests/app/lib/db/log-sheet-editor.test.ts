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
