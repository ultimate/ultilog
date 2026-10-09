import { canAccessRegisteredShares } from "../../../../app/lib/registered-share-access";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { calculateLogSheetMetrics } from "../../../../app/domain/logbook/sheet-metrics";
import { calculateLogbookStatistics } from "../../../../app/domain/logbook/logbook-statistics";
import { calculateLicenseProgress } from "../../../../app/domain/compliance/license-progress";
import type { Requirement } from "../../../../app/domain/compliance/catalog";
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
        expect(shared).toMatchObject({ ownerName: "Contract owner", sourceOwnerId: context.owner });
        expect(shared?.ownerAvatar).toMatch(/^https:\/\/secure\.gravatar\.com\/avatar\//);
      } finally { await context.cleanup(); }
    });

    it("shares engine counters only when the technical log is visible", async () => {
      const context = await setup();
      try {
        const source = { ...sheet([]), engineHourCounters: { main: { start: 12, end: 15 } }, share: { masterData: "public", logLines: "private", technicalLog: "private", picture: "private", metrics: "private", skipper: "private", crew: "private" } as const };
        await context.database.upsertLogSheet(source);
        const hidden = await context.database.readSharedSheet("sheet", false, context.owner);
        expect(hidden?.sheet.engineHourCounters).toBeUndefined();
        const current = (await context.database.readLogbook()).sheets[0];
        await context.database.upsertLogSheet({ ...current, share: { ...source.share, technicalLog: "public" } });
        const visible = await context.database.readSharedSheet("sheet", false, context.owner);
        expect(visible?.sheet.engineHourCounters).toEqual(source.engineHourCounters);
      } finally { await context.cleanup(); }
    });

    it("lists an owner's visible shared sheets in creation order", async () => {
      const context = await setup();
      try {
        await context.database.upsertLogSheet({
          ...sheet([]),
          title: "Visible voyage",
          share: {
            masterData: "public",
            logLines: "private",
            technicalLog: "private",
            picture: "private",
            metrics: "private",
            skipper: "private",
            crew: "private",
          },
        });
        await context.database.upsertLogSheet({
          ...sheet([]),
          id: "private-sheet",
          title: "Private voyage",
        });

        const collection = await context.database.readSharedSheets(context.owner, false);

        expect(collection).toMatchObject({
          ownerId: context.owner,
          ownerName: "Contract owner",
          sheets: [{ sheet: { id: "sheet", title: "Visible voyage" } }],
        });
      } finally { await context.cleanup(); }
    });

    it("limits demo viewers and copies to public shared sections", async () => {
      const context = await setup();
      try {
        const db = context.database;
        const p = (index: number) => db.placeholder(index);
        await expect(canAccessRegisteredShares(db, context.owner)).resolves.toBe(true);
        await expect(canAccessRegisteredShares(db, "missing-user")).resolves.toBe(false);
        await expect(canAccessRegisteredShares(db)).resolves.toBe(false);
        await db.query(`insert into user_groups (user_id, name) values (${p(1)}, 'demo')`, [context.owner]);
        await expect(canAccessRegisteredShares(db, context.owner)).resolves.toBe(false);
        // A sandbox remains a demo even if its group is removed or it has expired.
        await db.query(`insert into demo_sandboxes (user_id, template_version, expires_at, last_accessed_at) values (${p(1)}, 1, '2000-01-01T00:00:00Z', '2000-01-01T00:00:00Z')`, [context.owner]);
        await db.query(`delete from user_groups where user_id = ${p(1)}`, [context.owner]);
        const access = await canAccessRegisteredShares(db, context.owner);
        expect(access).toBe(false);

        db.forUser(context.other);
        await db.upsertBoat({ ...context.boat, id: "source-boat", revision: undefined });
        const registeredShare = { masterData: "registered", logLines: "registered", technicalLog: "registered", picture: "registered", metrics: "registered", skipper: "registered", crew: "registered" } as const;
        await db.upsertCrewMember({ id: "sailor", name: "Registered-only sailor", nationality: "GB", role: "Crew" });
        const sourceImageId = randomUUID();
        await db.createStoredImage(sourceImageId, { data: "data:image/png;base64,Y29weQ==", mimeType: "image/png", width: 2, height: 3 });
        await db.upsertLogSheet({ ...sheet([]), boatId: "source-boat", share: registeredShare, imageId: sourceImageId,
          crew: [{ id: "sailor", embarkationDateTime: "", embarkationPosition: "", disembarkationDateTime: "", disembarkationPosition: "" }] });
        const registeredView = await db.readSharedSheet("sheet", true, context.other);
        expect(registeredView?.sheet.crew).toHaveLength(1);
        expect(registeredView?.sheet.image).toBeDefined();
        await expect(db.readSharedSheet("sheet", access, context.other)).resolves.toBeUndefined();
        await expect(db.readSharedSheet("sheet", access)).resolves.toBeUndefined();
        await expect(db.readSharedSheets(context.other, access)).resolves.toMatchObject({ sheets: [] });
        db.forUser(context.owner);
        await expect(db.copySharedSheet(context.other, "sheet", { destinationBoatId: "boat", includeCrew: true, includePicture: true })).rejects.toMatchObject({ code: "shared_sections_not_visible" });

        db.forUser(context.other);
        const source = (await db.readLogbook()).sheets[0];
        await db.upsertLogSheet({ ...source, share: { ...registeredShare, masterData: "public", logLines: "public", technicalLog: "public" } });
        const visible = await db.readSharedSheet("sheet", access, context.other);
        expect(visible?.capability.canCopy).toBe(true);
        expect(visible?.sheet).toMatchObject({ crew: [], image: undefined, metrics: undefined });
        await expect(db.readSharedSheets(context.other, access)).resolves.toMatchObject({ sheets: [{ sheet: { id: "sheet" } }] });
        db.forUser(context.owner);
        const copied = await db.copySharedSheet(context.other, "sheet", { destinationBoatId: "boat", includeCrew: true, includePicture: true });
        expect(copied?.crew).toEqual([]);
        expect(copied?.imageId).toBeUndefined();
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
          ...sheet([sourceLine]), boatId: "source-boat", title: "Shared voyage", remarks: "A smooth crossing.", technicalChecks: [{ status: "ok", text: "Rig" }],
          crew: [{ id: "sailor", embarkationDateTime: "", embarkationPosition: "", disembarkationDateTime: "", disembarkationPosition: "" }],
          imageId: sourceImageId,
          share: { masterData: "registered", logLines: "registered", technicalLog: "registered", picture: "registered", metrics: "private", skipper: "registered", crew: "private" },
        });
        context.database.forUser(context.owner);
        const copied = await context.database.copySharedSheet(context.other, "sheet", { destinationBoatId: "boat", includeCrew: true, includePicture: true });
        expect(copied).toMatchObject({ title: "Shared voyage", status: "Draft", source: "shared", copyProvenance: { sourceOwnerId: context.other, sourceOwnerName: "Other owner", sourceSheetId: "sheet", sourceRevision: expect.any(Number), copiedAt: expect.any(String), sourceTitle: "Shared voyage" }, boatId: "boat", remarks: "A smooth crossing.", technicalChecks: [{ status: "ok", text: "Rig" }], share: { masterData: "private", logLines: "private", technicalLog: "private", picture: "private", metrics: "private", skipper: "private", crew: "private" } });
        expect(new Date(copied!.copyProvenance!.copiedAt).toISOString()).toBe(copied!.copyProvenance!.copiedAt);
        expect(copied!.id).not.toBe("sheet");
        expect(copied!.lines[0].id).not.toBe("source-line");
        expect(copied!.crew).toHaveLength(1);
        expect(copied!.crew[0].id).not.toBe("sailor");
        expect(copied!.imageId).not.toBe(sourceImageId);
        await expect(context.database.readStoredImage(copied!.imageId!)).resolves.toMatchObject({ data: "data:image/png;base64,Y29weQ==", width: 2, height: 3 });
        const calculated = calculateLogSheetMetrics(copied!.lines, copied!.route);
        expect(copied!.metrics).toMatchObject({ motorMiles: calculated.motorMiles, sailMiles: calculated.sailMiles, totalMiles: calculated.totalMiles, motorHours: calculated.motorHours, motionDurationMinutes: calculated.motionDurationMinutes });

        await expect(context.database.copySharedSheet(context.other, "sheet", { destinationBoatId: "boat" })).rejects.toMatchObject({
          code: "duplicate_shared_copy",
          previousCopy: { id: copied!.id, title: "Shared voyage", copiedAt: copied!.copyProvenance!.copiedAt },
        });
        const withoutCrew = await context.database.copySharedSheet(context.other, "sheet", { destinationBoatId: "boat", allowDuplicate: true });
        expect(withoutCrew!.crew).toEqual([]);

        const { lines: _lines, crew: copiedCrew, copyProvenance: _attemptedChange, ...editableCopy } = copied!;
        const edited = await context.database.upsertLogSheet({ ...editableCopy, crew: copiedCrew.map(member => ({ id: member.id, embarkationDateTime: member.embarkationDateTime, embarkationPosition: member.embarkationPosition, disembarkationDateTime: member.disembarkationDateTime, disembarkationPosition: member.disembarkationPosition })), title: "My edited copy" });
        expect(edited!.copyProvenance).toEqual(copied!.copyProvenance);

        sourceDb.forUser(context.other);
        const sourceSheet = (await sourceDb.readLogbook()).sheets.find(candidate => candidate.id === "sheet")!;
        await sourceDb.deleteLogSheet("sheet", sourceSheet.revision!);
        context.database.forUser(context.owner);
        expect((await context.database.readLogbook()).sheets.find(candidate => candidate.id === copied!.id)).toMatchObject({ title: "My edited copy", copyProvenance: copied!.copyProvenance });
        await context.database.deleteLogSheet(copied!.id, edited!.revision!);
        expect((await context.database.readLogbook()).sheets.some(candidate => candidate.id === copied!.id)).toBe(false);
      } finally { await context.cleanup(); }
    });

    it("counts a copied sheet read by its recipient exactly like a manually created sheet", async () => {
      const context = await setup();
      try {
        const sourceDb = context.database.forUser(context.other);
        await sourceDb.upsertBoat({ ...context.boat, id: "source-boat", revision: undefined });
        const sourceLines = voyageLines();
        const voyage = {
          ...sheet(sourceLines),
          boatId: "source-boat",
          route: { from: "A", to: "B", departed: "2026-09-10T08:00:00Z", arrived: "2026-09-12T08:00:00Z" },
          share: { masterData: "registered", logLines: "registered", technicalLog: "registered", picture: "private", metrics: "private", skipper: "private", crew: "private" } as const,
        };
        await sourceDb.upsertLogSheet(voyage);

        context.database.forUser(context.owner);
        const manual = await context.database.upsertLogSheet({ ...voyage, id: "manual", boatId: "boat", share: undefined });
        const copied = await context.database.copySharedSheet(context.other, "sheet", { destinationBoatId: "boat" });
        const recipientSheets = (await context.database.readLogbook()).sheets;
        const recipientCopy = recipientSheets.find(candidate => candidate.id === copied!.id)!;
        const recipientManual = recipientSheets.find(candidate => candidate.id === manual!.id)!;

        expect(recipientCopy.id).not.toBe(voyage.id);
        expect(recipientCopy.lines.map(line => line.id)).not.toEqual(sourceLines.map(line => line.id));
        const copiedMetrics = calculateLogSheetMetrics(recipientCopy.lines, recipientCopy.route);
        const manualMetrics = calculateLogSheetMetrics(recipientManual.lines, recipientManual.route);
        expect(copiedMetrics).toMatchObject({ sailMiles: 9, motorMiles: 6, totalMiles: 15 });
        expect(copiedMetrics).toEqual(manualMetrics);
        expect(recipientCopy.metrics).toMatchObject({
          sailMiles: copiedMetrics.sailMiles,
          motorMiles: copiedMetrics.motorMiles,
          totalMiles: copiedMetrics.totalMiles,
          durationMinutes: copiedMetrics.durationMinutes,
          overallDurationMinutes: copiedMetrics.overallDurationMinutes,
          motionDurationMinutes: copiedMetrics.motionDurationMinutes,
        });

        expect(calculateLogbookStatistics([recipientCopy])).toEqual({ sailMiles: 9, motorMiles: 6, totalMiles: 15, sailingDays: 3, daysAtSea: 3 });
        expect(calculateLogbookStatistics([recipientCopy])).toEqual(calculateLogbookStatistics([recipientManual]));
        expect(calculateLogbookStatistics(recipientSheets)).toEqual({ sailMiles: 18, motorMiles: 12, totalMiles: 30, sailingDays: 3, daysAtSea: 3 });

        const requirements = [
          automaticRequirement("sail", "sail-miles"), automaticRequirement("motor", "motor-miles"),
          automaticRequirement("total", "total-miles"), automaticRequirement("sailing-days", "days-sailing"),
          automaticRequirement("sea-days", "days-at-sea"),
        ];
        expect(calculateLicenseProgress(requirements, [recipientCopy]).map(item => item.achievedValue)).toEqual([9, 6, 15, 3, 3]);
        expect(calculateLicenseProgress(requirements, [recipientCopy]).map(item => item.achievedValue))
          .toEqual(calculateLicenseProgress(requirements, [recipientManual]).map(item => item.achievedValue));
      } finally { await context.cleanup(); }
    });

    it("copies empty visible log lines despite private source metrics and contributes zero miles", async () => {
      const context = await setup();
      try {
        const sourceDb = context.database.forUser(context.other);
        await sourceDb.upsertBoat({ ...context.boat, id: "source-boat", revision: undefined });
        await sourceDb.upsertLogSheet({
          ...sheet([]), boatId: "source-boat",
          share: { masterData: "public", logLines: "public", technicalLog: "public", picture: "private", metrics: "private", skipper: "private", crew: "private" },
        });

        context.database.forUser(context.owner);
        const copied = await context.database.copySharedSheet(context.other, "sheet", { destinationBoatId: "boat" });
        const recipientCopy = (await context.database.readLogbook()).sheets.find(candidate => candidate.id === copied!.id)!;

        expect(recipientCopy.lines).toEqual([]);
        expect(calculateLogSheetMetrics(recipientCopy.lines, recipientCopy.route)).toMatchObject({ sailMiles: 0, motorMiles: 0, totalMiles: 0 });
        expect(calculateLogbookStatistics([recipientCopy])).toEqual({ sailMiles: 0, motorMiles: 0, totalMiles: 0, sailingDays: 0, daysAtSea: 0 });
        expect(calculateLicenseProgress([automaticRequirement("miles", "total-miles")], [recipientCopy])[0].achievedValue).toBe(0);
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
  return { id: "sheet", title: "Contract sheet", status: "Draft", boatId: "boat", route: { from: "", to: "", departed: "", arrived: "" }, crew: [], technicalChecks: [], lines };
}

function voyageLines(): LogLine[] {
  return [
    { ...sampleLogSheets[0].lines[0], id: "source-line-1", time: "2026-09-10T08:00:00Z", latitude: 54, longitude: 10, logNm: 0, sailMiles: 0, motorMiles: 0 },
    { ...sampleLogSheets[0].lines[0], id: "source-line-2", time: "2026-09-11T08:00:00Z", latitude: 54, longitude: 11, logNm: 6, sailMiles: 4, motorMiles: 2 },
    { ...sampleLogSheets[0].lines[0], id: "source-line-3", time: "2026-09-12T08:00:00Z", latitude: 54, longitude: 12, logNm: 15, sailMiles: 5, motorMiles: 4 },
  ];
}

function automaticRequirement(id: string, type: Requirement["type"]): Requirement {
  return { id, type, threshold: 100, filters: null, translationKey: "dashboard.totalMiles", unit: type.includes("miles") ? "nautical-miles" : "days" } as Requirement;
}
