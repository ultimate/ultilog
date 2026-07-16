import type { Boat, BoatRow, StoredImage } from "../../models/logbook";
import type { QueryableDatabase } from "../db/logbook-database";

export class BoatsRepository {
  constructor(private db: QueryableDatabase) {}

  async findAll(ownerId = "legacy-user") {
    return (await this.db.query<BoatRow>(`select * from boats where owner_id = ${this.db.placeholder(1)} order by name`, [ownerId])).rows;
  }

  async findByScopedId(id: string) {
    return (await this.db.query<BoatRow>(`select * from boats where id = ${this.db.placeholder(1)} limit 1`, [id])).rows[0];
  }

  async deleteAll(ownerId = "legacy-user") {
    await this.db.query(`delete from boats where owner_id = ${this.db.placeholder(1)}`, [ownerId]);
  }

  async insert(boat: Boat, ownerId = "legacy-user") {
    await this.db.query(
      `insert into boats (id, name, type, registration, flag_state, home_port, owner, dimensions, logfactor, yacht_data, deviation_table, image_data, image_mime_type, image_width, image_height, owner_id) values (${this.values(16)})`,
      [scopedId(ownerId, boat.id), boat.name, boat.type, boat.registration, boat.flagState, boat.homePort, boat.owner, boat.dimensions, boat.logfactor, JSON.stringify(boat.yachtData), JSON.stringify(boat.deviationTable), ...imageValues(boat.image), ownerId],
    );
  }

  private values(count: number) {
    return Array.from({ length: count }, (_, index) => this.db.placeholder(index + 1)).join(", ");
  }
}

export function imageValues(image?: StoredImage): [string | null, string | null, number | null, number | null] {
  return image ? [image.data, image.mimeType, image.width, image.height] : [null, null, null, null];
}

export function imageFromRow(row: { image_data?: string | null; image_mime_type?: string | null; image_width?: number | null; image_height?: number | null }): StoredImage | undefined {
  if (!row.image_data || !row.image_mime_type || row.image_width == null || row.image_height == null) return undefined;
  return { data: row.image_data, mimeType: row.image_mime_type, width: Number(row.image_width), height: Number(row.image_height) };
}

export function scopedId(ownerId: string, id: string) {
  return `${ownerId}:${id}`;
}

export function unscopedId(id: string) {
  return id.includes(":") ? id.slice(id.indexOf(":") + 1) : id;
}
