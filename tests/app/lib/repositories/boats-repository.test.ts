import { describe, expect, it } from "vitest";
import { sampleBoats } from "../../../fixtures/logbook";
import type { BoatRow } from "../../../../app/models/logbook";
import type { QueryableDatabase, QueryResult } from "../../../../app/lib/db/logbook-database";
import { BoatsRepository, imageFromRow } from "../../../../app/lib/repositories/boats-repository";

type QueryCall = { sql: string; values?: unknown[] };

class MockDatabase implements QueryableDatabase {
  calls: QueryCall[] = [];

  constructor(private resultRows: Record<string, unknown[]> = {}) {}

  placeholder(index: number) {
    return `$${index}`;
  }

  async query<Row>(sql: string, values?: unknown[]): Promise<QueryResult<Row>> {
    this.calls.push({ sql, values });
    const [key] = Object.keys(this.resultRows).filter((candidate) => sql.includes(candidate));
    return { rows: (key ? this.resultRows[key] : []) as Row[] };
  }
}

const boat = sampleBoats[0];

describe("BoatsRepository", () => {
  it("finds all boat rows", async () => {
    const row: BoatRow = { ...boat, flag_state: boat.flagState, home_port: boat.homePort, yacht_data: boat.yachtData, deviation_table: boat.deviationTable };
    const db = new MockDatabase({ boats: [row] });

    await expect(new BoatsRepository(db).findAll("repository-user")).resolves.toEqual([row]);
    expect(db.calls[0].sql).toContain("from boats left join stored_images");
    expect(db.calls[0].sql).toContain("where boats.owner_id = $1 order by name");
    expect(db.calls[0].values).toEqual(["repository-user"]);
  });

  it("deletes all boat rows", async () => {
    const db = new MockDatabase();

    await new BoatsRepository(db).deleteAll("repository-user");
    expect(db.calls).toEqual([{ sql: "delete from boats where owner_id = $1", values: ["repository-user"] }]);
  });

  it("inserts a boat with serialized yacht data", async () => {
    const db = new MockDatabase();

    await new BoatsRepository(db).insert(boat, "repository-user");

    expect(db.calls[0].sql).toContain("insert into boats");
    expect(db.calls[0].sql).toContain("image_id, owner_id");
    expect(db.calls[0].values).toEqual([`repository-user:${boat.id}`, boat.archived ? 1 : 0, boat.name, boat.type, boat.registration, boat.flagState, boat.homePort, boat.owner, boat.dimensions, boat.logfactor, JSON.stringify(boat.yachtData), JSON.stringify(boat.deviationTable), JSON.stringify(boat.windDriftTable ?? []), null, "repository-user"]);
  });

  it("inserts boat image metadata when present", async () => {
    const db = new MockDatabase();
    const image = { id: "boat-image", data: "base64-boat", mimeType: "image/png", width: 640, height: 480 };

    await new BoatsRepository(db).insert({ ...boat, image }, "repository-user");

    expect(db.calls[0].values?.slice(13, 15)).toEqual([image.id, "repository-user"]);
  });

  it("maps loaded boat image metadata back to an image payload", () => {
    const image = { data: "base64-boat", mimeType: "image/png", width: 640, height: 480 };
    const row: BoatRow = { ...boat, flag_state: boat.flagState, home_port: boat.homePort, yacht_data: boat.yachtData, deviation_table: boat.deviationTable, image_data: image.data, image_mime_type: image.mimeType, image_width: image.width, image_height: image.height };

    expect(imageFromRow(row)).toEqual(image);
  });

});
