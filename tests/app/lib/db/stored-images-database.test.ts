import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { defaultDeviationTable, type CrewMember, type LogSheet } from "../../../../app/models/logbook";
import { type LogbookDatabase } from "../../../../app/lib/db/logbook-database";
import { PostgresLogbookDatabase } from "../../../../app/lib/db/postgres-logbook-database";
import { SqliteLogbookDatabase } from "../../../../app/lib/db/sqlite-logbook-database";

const tempDirectories: string[] = [];
afterAll(async () => Promise.all(tempDirectories.map(directory => rm(directory, { recursive: true, force: true }))));

type TestDatabase = LogbookDatabase & { close?: () => Promise<void> };
const postgresUrl = process.env.TEST_POSTGRES_URL;
const dialects: { name: string; available: boolean; create: () => Promise<TestDatabase> }[] = [
  {
    name: "SQLite", available: true, create: async () => {
      const directory = await mkdtemp(join(tmpdir(), "ultilog-images-"));
      tempDirectories.push(directory);
      return new SqliteLogbookDatabase(join(directory, "test.sqlite"));
    },
  },
  { name: "PostgreSQL", available: Boolean(postgresUrl), create: async () => new PostgresLogbookDatabase(postgresUrl!) },
];

for (const dialect of dialects) {
  describe.runIf(dialect.available)(`${dialect.name} stored image contract`, () => {
    it("normalizes every entity reference and performs transactional orphan cleanup", async () => {
      const root = await dialect.create();
      const ownerId = `images-${randomUUID()}`;
      const foreignOwnerId = `foreign-${randomUUID()}`;
      await root.migrate();
      await root.query(`insert into users (id, name, email, password_hash) values (${root.placeholder(1)}, ${root.placeholder(2)}, ${root.placeholder(3)}, ${root.placeholder(4)}), (${root.placeholder(5)}, ${root.placeholder(6)}, ${root.placeholder(7)}, ${root.placeholder(8)})`, [ownerId, "Image owner", `${ownerId}@example.test`, "", foreignOwnerId, "Foreign owner", `${foreignOwnerId}@example.test`, ""]);
      const db = root.forUser(ownerId);
      const bytes = "data:image/png;base64,c3RhYmxlLWJ5dGVz";
      const stored = (id: string) => ({ data: `${bytes}-${id}`, mimeType: "image/png", width: 16, height: 12 });
      const ids = { boat: randomUUID(), crew: randomUUID(), sheet: randomUUID(), shared: randomUUID(), replacement: randomUUID(), unattached: randomUUID(), foreign: randomUUID() };

      for (const id of Object.values(ids).filter(id => id !== ids.foreign)) await db.createStoredImage(id, stored(id));
      expect((await db.query<{ count: number | string }>(`select count(*) as count from stored_images where owner_id = ${db.placeholder(1)}`, [ownerId])).rows[0]).toMatchObject({ count: expect.anything() });
      expect(Number((await db.query<{ count: number | string }>(`select count(*) as count from stored_images where id = ${db.placeholder(1)}`, [ids.boat])).rows[0].count)).toBe(1);

      const boat = { id: "boat", name: "Image boat", type: "Sail" as const, registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: defaultDeviationTable(), imageId: ids.boat };
      const crew: CrewMember = { id: "crew", name: "Global crew", nationality: "", role: "", address: "", certificate: "", imageId: ids.crew };
      const assignment = { ...crew, embarkationDateTime: "", embarkationPosition: "", disembarkationDateTime: "", disembarkationPosition: "" };
      const sheet = (id: string, imageId: string): LogSheet => ({ id, title: id, status: "Draft", boatId: boat.id, route: { from: "", to: "", departed: "", arrived: "" }, crew: [{ ...assignment }], watchPlan: [], technicalChecks: [], lines: [], imageId });
      const createdBoat = await db.upsertBoat(boat);
      const createdCrew = await db.upsertCrewMember(crew);
      const firstSheet = await db.upsertLogSheet(sheet("sheet-1", ids.sheet));
      const secondSheet = await db.upsertLogSheet(sheet("sheet-2", ids.shared));

      for (const entity of [createdBoat, createdCrew, firstSheet, secondSheet]) {
        expect(JSON.stringify(entity)).not.toContain(bytes);
        expect(entity).not.toHaveProperty("image.data");
      }
      expect(firstSheet?.crew[0]).toMatchObject({ id: crew.id, imageId: ids.crew });
      expect(secondSheet?.crew[0]).toMatchObject({ id: crew.id, imageId: ids.crew });
      expect(JSON.stringify(firstSheet?.crew)).not.toContain(bytes);
      const assignments = await db.query<Record<string, unknown>>(`select * from sheet_crew_members where crew_member_id = ${db.placeholder(1)} order by sheet_id`, [`${ownerId}:${crew.id}`]);
      expect(assignments.rows).toHaveLength(2);
      expect(Object.keys(assignments.rows[0])).not.toContain("image_data");
      expect(JSON.stringify(assignments.rows)).not.toContain(bytes);

      for (const referenced of [ids.boat, ids.crew, ids.sheet, ids.shared]) await expect(db.deleteStoredImage(referenced)).rejects.toMatchObject({ code: "referenced_image" });

      const foreign = root.forUser(foreignOwnerId);
      await foreign.createStoredImage(ids.foreign, stored(ids.foreign));
      root.forUser(ownerId);
      await expect(db.upsertBoat({ ...createdBoat!, revision: createdBoat!.revision, imageId: ids.foreign })).rejects.toMatchObject({ code: "missing_image", message: "Stored image not found." });
      await expect(db.upsertBoat({ ...createdBoat!, revision: createdBoat!.revision, imageId: randomUUID() })).rejects.toMatchObject({ code: "missing_image", message: "Stored image not found." });

      await db.createStoredImage(ids.shared, stored(ids.shared)).catch(() => undefined);
      const boatSharingOld = await db.upsertBoat({ ...createdBoat!, revision: createdBoat!.revision, imageId: ids.shared });
      expect(await db.readStoredImage(ids.boat)).toBeUndefined();
      const updatedFirst = await db.upsertLogSheet({ ...firstSheet!, revision: firstSheet!.revision, imageId: ids.shared });
      expect(await db.readStoredImage(ids.sheet)).toBeUndefined();
      const boatReplaced = await db.upsertBoat({ ...boatSharingOld!, revision: boatSharingOld!.revision, imageId: ids.replacement });
      expect(await db.readStoredImage(ids.shared)).toBeDefined();
      await db.upsertLogSheet({ ...updatedFirst!, revision: updatedFirst!.revision, imageId: ids.replacement });
      expect(await db.readStoredImage(ids.shared)).toBeDefined();
      await db.upsertLogSheet({ ...secondSheet!, revision: secondSheet!.revision, imageId: ids.replacement });
      expect(await db.readStoredImage(ids.shared)).toBeUndefined();
      expect(boatReplaced).toMatchObject({ imageId: ids.replacement });

      await expect(db.deleteStoredImage(ids.unattached)).resolves.toBe(true);
      await expect(db.readStoredImage(ids.unattached)).resolves.toBeUndefined();
      await root.close?.();
    });
  });
}
