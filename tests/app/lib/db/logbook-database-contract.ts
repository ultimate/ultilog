import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { calculateLogSheetMetrics } from "../../../../app/domain/logbook/sheet-metrics";
import type { LogbookDatabase } from "../../../../app/lib/db/logbook-database";
import { defaultDeviationTable, type LogLine, type LogSheet } from "../../../../app/models/logbook";
import { sampleLogSheets } from "../../../fixtures/logbook";

export type ContractDatabase = LogbookDatabase & { close?: () => Promise<void> };
export type ContractHarness = {
  create(): Promise<{ database: ContractDatabase; cleanup(): Promise<void> }>;
  installMetricFailure(database: ContractDatabase): Promise<void>;
};

export function logbookDatabaseContract(name: string, harness: ContractHarness) {
  describe(`${name} logbook database contract`, () => {
    async function setup() {
      const resource = await harness.create();
      const owner = `owner-${randomUUID()}`;
      const other = `other-${randomUUID()}`;
      await resource.database.migrate();
      const p = (index: number) => resource.database.placeholder(index);
      await resource.database.query(
        `insert into users (id, name, email, password_hash) values (${p(1)}, ${p(2)}, ${p(3)}, ${p(4)}), (${p(5)}, ${p(6)}, ${p(7)}, ${p(8)})`,
        [owner, "Contract owner", `${owner}@example.test`, "", other, "Other owner", `${other}@example.test`, ""],
      );
      const database = resource.database.forUser(owner);
      const boat = await database.upsertBoat({ id: "boat", name: "Contract boat", type: "Sail", registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, deviationTable: defaultDeviationTable() });
      return { ...resource, database, owner, other, boat: boat! };
    }

    it("updates only sheet metadata atomically and preserves timestamps", async () => {
      const context = await setup();
      try {
        const source = sampleLogSheets[0];
        await context.database.upsertLogSheet(sheet(source.lines.slice(0, 2)));
        const before = (await context.database.readLogbook()).sheets[0];
        await new Promise(resolve => setTimeout(resolve, 5));
        const updated = await context.database.upsertLogSheet({ ...before, title: "Changed", lines: [{ ...before.lines[0], remarks: "ignored aggregate line edit" }] });
        expect(updated).toMatchObject({ title: "Changed", revision: before.revision! + 1, createdAt: before.createdAt });
        expect(new Date(updated!.updatedAt!).getTime()).toBeGreaterThan(new Date(before.updatedAt!).getTime());
        expect(updated!.lines).toEqual(before.lines);
      } finally { await context.cleanup(); }
    });

    it("creates, updates, reorders, and deletes lines while recalculating metrics", async () => {
      const context = await setup();
      try {
        const lines = sampleLogSheets[0].lines.slice(0, 2).map(line => ({ ...line, motorHours: 0, engineHours: undefined }));
        await context.database.upsertLogSheet(sheet(lines));
        const created = await context.database.createLogLine("sheet", { ...sampleLogSheets[0].lines[2], id: "new-line", motorMiles: 8, sailMiles: 4 });
        expect((await context.database.readLogbook()).sheets[0].lines.map(line => line.id)).toEqual([lines[0].id, lines[1].id, "new-line"]);
        const updated = await context.database.updateLogLine("sheet", "new-line", { ...created!, remarks: "updated", motorMiles: 9 });
        await expect(context.database.updateLogLine("sheet", "new-line", { ...created!, remarks: "stale overwrite" })).rejects.toMatchObject({ code: "revision_conflict" });
        await context.database.reorderLogLines("sheet", ["new-line", lines[1].id, lines[0].id]);
        await expect(context.database.deleteLogLine("sheet", "new-line", created!.revision!)).rejects.toMatchObject({ code: "revision_conflict" });
        await context.database.deleteLogLine("sheet", "new-line", updated!.revision!);
        const persisted = (await context.database.readLogbook()).sheets[0];
        expect(persisted.lines.map(line => line.id)).toEqual([lines[1].id, lines[0].id]);
        const calculated = calculateLogSheetMetrics(persisted.lines, persisted.route);
        expect(persisted.metrics).toMatchObject({ motorMiles: calculated.motorMiles, sailMiles: calculated.sailMiles, totalMiles: calculated.totalMiles, motorHours: calculated.motorHours, motionDurationMinutes: calculated.motionDurationMinutes });
      } finally { await context.cleanup(); }
    });

    it("makes conditional sheet updates atomic and rejects stale revisions", async () => {
      const context = await setup();
      try {
        await context.database.upsertLogSheet(sheet([]));
        const current = (await context.database.readLogbook()).sheets[0];
        const results = await Promise.allSettled([
          context.database.upsertLogSheet({ ...current, title: "first" }),
          context.database.upsertLogSheet({ ...current, title: "second" }),
        ]);
        expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
        expect(results.find(result => result.status === "rejected")).toMatchObject({ reason: { code: "revision_conflict" } });
      } finally { await context.cleanup(); }
    });

    it("returns indistinguishable not-found results for missing and cross-owner IDs", async () => {
      const context = await setup();
      try {
        await context.database.upsertLogSheet(sheet([]));
        const foreign = context.database.forUser(context.other);
        await expect(foreign.deleteLogSheet("sheet", 1)).resolves.toBeUndefined();
        await expect(foreign.deleteLogSheet("missing", 1)).resolves.toBeUndefined();
        await expect(foreign.updateLogLine("sheet", "missing", sampleLogSheets[0].lines[0])).resolves.toBeUndefined();
      } finally { await context.cleanup(); }
    });

    it("returns copy capability from source sharing even when visible collections are empty", async () => {
      const context = await setup();
      try {
        await context.database.upsertLogSheet({
          ...sheet([]),
          technicalChecks: [],
          share: {
            masterData: "public",
            logLines: "public",
            technicalLog: "public",
            picture: "private",
            metrics: "private",
            skipper: "private",
            crew: "private",
          },
        });

        const shared = await context.database.readSharedSheet("sheet", false, context.owner);

        expect(shared?.sheet.lines).toEqual([]);
        expect(shared?.sheet.technicalChecks).toEqual([]);
        expect(shared?.capability).toEqual({ canCopy: true, missingRequiredSections: [], requiresAuthentication: false });
      } finally { await context.cleanup(); }
    });

    it("copies required shared data with regenerated ids, private defaults, and optional visible crew", async () => {
      const context = await setup();
      try {
        const sourceDb = context.database.forUser(context.other);
        await sourceDb.upsertBoat({ ...context.boat, id: "source-boat", revision: undefined });
        const sourceImageId = randomUUID();
        await sourceDb.createStoredImage(sourceImageId, { data: "data:image/png;base64,Y29weQ==", mimeType: "image/png", width: 2, height: 3 });
        const sourceLine = { ...sampleLogSheets[0].lines[0], id: "source-line", revision: undefined, createdAt: undefined, updatedAt: undefined };
        await sourceDb.upsertCrewMember({ id: "sailor", name: "Sailor", nationality: "GB", role: "Crew" });
        await sourceDb.upsertLogSheet({
          ...sheet([sourceLine]), boatId: "source-boat", title: "Shared voyage", watchPlan: ["00-04"], technicalChecks: [{ status: "ok", text: "Rig" }],
          crew: [{ id: "sailor", embarkationDateTime: "", embarkationPosition: "", disembarkationDateTime: "", disembarkationPosition: "" }],
          imageId: sourceImageId,
          share: { masterData: "registered", logLines: "registered", technicalLog: "registered", picture: "registered", metrics: "private", skipper: "registered", crew: "private" },
        });
        context.database.forUser(context.owner);
        const copied = await context.database.copySharedSheet(context.other, "sheet", { destinationBoatId: "boat", includeCrew: true, includePicture: true });
        expect(copied).toMatchObject({ title: "Shared voyage", status: "Draft", boatId: "boat", watchPlan: ["00-04"], technicalChecks: [{ status: "ok", text: "Rig" }], share: { masterData: "private", logLines: "private", technicalLog: "private", picture: "private", metrics: "private", skipper: "private", crew: "private" } });
        expect(copied!.id).not.toBe("sheet");
        expect(copied!.lines[0].id).not.toBe("source-line");
        expect(copied!.crew).toHaveLength(1);
        expect(copied!.crew[0].id).not.toBe("sailor");
        expect(copied!.imageId).not.toBe(sourceImageId);
        await expect(context.database.readStoredImage(copied!.imageId!)).resolves.toMatchObject({ data: "data:image/png;base64,Y29weQ==", width: 2, height: 3 });
        const calculated = calculateLogSheetMetrics(copied!.lines, copied!.route);
        expect(copied!.metrics).toMatchObject({ motorMiles: calculated.motorMiles, sailMiles: calculated.sailMiles, totalMiles: calculated.totalMiles, motorHours: calculated.motorHours, motionDurationMinutes: calculated.motionDurationMinutes });

        const withoutCrew = await context.database.copySharedSheet(context.other, "sheet", { destinationBoatId: "boat" });
        expect(withoutCrew!.crew).toEqual([]);
      } finally { await context.cleanup(); }
    });

    it("rejects hidden required sections and invalid destination boats", async () => {
      const context = await setup();
      try {
        const sourceDb = context.database.forUser(context.other);
        await sourceDb.upsertBoat({ ...context.boat, id: "source-boat", revision: undefined });
        await sourceDb.upsertLogSheet({ ...sheet([]), boatId: "source-boat", share: { masterData: "public", logLines: "private", technicalLog: "public", picture: "private", metrics: "private", skipper: "private", crew: "private" } });
        context.database.forUser(context.owner);
        await expect(context.database.copySharedSheet(context.other, "sheet", { destinationBoatId: "boat" })).rejects.toMatchObject({ code: "shared_sections_not_visible" });
        await expect(context.database.copySharedSheet(context.other, "missing", { destinationBoatId: "boat" })).resolves.toBeUndefined();
      } finally { await context.cleanup(); }
    });

    it("rejects missing and archived destination boats", async () => {
      const context = await setup();
      try {
        const sourceDb = context.database.forUser(context.other);
        await sourceDb.upsertBoat({ ...context.boat, id: "source-boat", revision: undefined });
        await sourceDb.upsertLogSheet({ ...sheet([]), boatId: "source-boat", share: { masterData: "public", logLines: "public", technicalLog: "public", picture: "private", metrics: "private", skipper: "private", crew: "private" } });
        context.database.forUser(context.owner);
        await expect(context.database.copySharedSheet(context.other, "sheet", { destinationBoatId: "missing" })).rejects.toMatchObject({ code: "missing_boat" });
        const archived = await context.database.upsertBoat({ ...context.boat, id: "archived", archived: true, revision: undefined });
        await expect(context.database.copySharedSheet(context.other, "sheet", { destinationBoatId: archived!.id })).rejects.toMatchObject({ code: "archived_boat_for_new_sheet" });
      } finally { await context.cleanup(); }
    });

    it("rolls the complete shared copy back when metric persistence fails", async () => {
      const context = await setup();
      try {
        const sourceDb = context.database.forUser(context.other);
        await sourceDb.upsertBoat({ ...context.boat, id: "source-boat", revision: undefined });
        await sourceDb.upsertLogSheet({ ...sheet([sampleLogSheets[0].lines[0]]), boatId: "source-boat", share: { masterData: "public", logLines: "public", technicalLog: "public", picture: "private", metrics: "private", skipper: "private", crew: "private" } });
        context.database.forUser(context.owner);
        await harness.installMetricFailure(context.database);
        await expect(context.database.copySharedSheet(context.other, "sheet", { destinationBoatId: "boat" })).rejects.toThrow(/metric/i);
        expect((await context.database.readLogbook()).sheets).toEqual([]);
      } finally { await context.cleanup(); }
    });

    it("enforces image ownership and deterministically removes replaced orphans", async () => {
      const context = await setup();
      try {
        const owned = randomUUID(), replacement = randomUUID(), foreignId = randomUUID();
        const image = { data: "data:image/png;base64,YQ==", mimeType: "image/png", width: 1, height: 1 };
        await context.database.createStoredImage(owned, image);
        await context.database.createStoredImage(replacement, image);
        const boat = await context.database.upsertBoat({ ...context.boat, imageId: owned });
        const foreign = context.database.forUser(context.other);
        await foreign.createStoredImage(foreignId, image);
        context.database.forUser(context.owner);
        await expect(context.database.upsertBoat({ ...boat!, imageId: foreignId })).rejects.toMatchObject({ code: "missing_image", message: "Stored image not found." });
        await expect(context.database.upsertBoat({ ...boat!, imageId: randomUUID() })).rejects.toMatchObject({ code: "missing_image", message: "Stored image not found." });
        await context.database.upsertBoat({ ...boat!, imageId: replacement });
        await expect(context.database.readStoredImage(owned)).resolves.toBeUndefined();
      } finally { await context.cleanup(); }
    });

    it("rolls a line mutation back when metric recalculation fails", async () => {
      const context = await setup();
      try {
        await context.database.upsertLogSheet(sheet([]));
        await harness.installMetricFailure(context.database);
        await expect(context.database.createLogLine("sheet", { ...sampleLogSheets[0].lines[0], id: "rolled-back" })).rejects.toThrow(/metric/i);
        expect((await context.database.readLogbook()).sheets[0].lines).toEqual([]);
      } finally { await context.cleanup(); }
    });
  });
}

function sheet(lines: LogLine[]): LogSheet {
  return { id: "sheet", title: "Contract sheet", status: "Draft", boatId: "boat", route: { from: "", to: "", departed: "", arrived: "" }, crew: [], watchPlan: [], technicalChecks: [], lines };
}
