import { defaultMainEngine, type Boat, type BoatEngine, type BoatRow, type StoredImage } from "../../models/logbook";
import type { QueryableDatabase } from "../db/logbook-database";

export class BoatsRepository {
  constructor(private db: QueryableDatabase) {}

  async findAll(ownerId: string) {
    const boats = (await this.db.query<BoatRow>(`select boats.*, stored_images.data as image_data, stored_images.mime_type as image_mime_type, stored_images.width as image_width, stored_images.height as image_height from boats left join stored_images on stored_images.id = boats.image_id and stored_images.owner_id = boats.owner_id where boats.owner_id = ${this.db.placeholder(1)} order by name`, [ownerId])).rows;
    const engines = (await this.db.query<EngineRow>(`select engines.* from engines join boats on boats.id = engines.boat_id where boats.owner_id = ${this.db.placeholder(1)} order by engines.boat_id, engines.sort_order`, [ownerId])).rows;
    return boats.map((boat) => {
      const boatEngines = engines.filter((engine) => engine.boat_id === boat.id).map(engineFromRow);
      return boatEngines.length ? { ...boat, engines: boatEngines } : boat;
    });
  }

  async findByScopedId(id: string) {
    const boat = (await this.db.query<BoatRow>(`select boats.*, stored_images.data as image_data, stored_images.mime_type as image_mime_type, stored_images.width as image_width, stored_images.height as image_height from boats left join stored_images on stored_images.id = boats.image_id and stored_images.owner_id = boats.owner_id where boats.id = ${this.db.placeholder(1)} limit 1`, [id])).rows[0];
    if (!boat) return undefined;
    const engines = (await this.db.query<EngineRow>(`select * from engines where boat_id = ${this.db.placeholder(1)} order by sort_order`, [id])).rows;
    return { ...boat, engines: engines.map(engineFromRow) };
  }

  async findById(id: string, ownerId: string) {
    return this.findByScopedId(scopedId(ownerId, id));
  }

  async isReferenced(id: string, ownerId: string) {
    const result = await this.db.query<{ id: string }>(`select id from log_sheets where boat_id = ${this.db.placeholder(1)} and owner_id = ${this.db.placeholder(2)} limit 1`, [scopedId(ownerId, id), ownerId]);
    return result.rows.length > 0;
  }

  async upsert(boat: Boat, ownerId: string) {
    const id = scopedId(ownerId, boat.id);
    const existing = await this.findById(boat.id, ownerId);
    const values = [boat.archived ? 1 : 0, boat.name, boat.type, boat.registration, boat.flagState, boat.homePort, boat.owner, boat.dimensions, boat.logfactor, JSON.stringify(boat.yachtData), JSON.stringify(boat.deviationTable), JSON.stringify(boat.windDriftTable ?? []), boat.imageId ?? boat.image?.id ?? null];
    if (existing) {
      const expected = boat.revision ?? Number(existing.revision);
      const assignments = ["archived", "name", "type", "registration", "flag_state", "home_port", "owner", "dimensions", "logfactor", "yacht_data", "deviation_table", "wind_drift_table", "image_id"].map((column, index) => `${column} = ${this.db.placeholder(index + 1)}`);
      const updated = await this.db.query<{ revision: number }>(`update boats set ${assignments.join(", ")}, revision = revision + 1, updated_at = ${this.now()} where id = ${this.db.placeholder(14)} and owner_id = ${this.db.placeholder(15)} and revision = ${this.db.placeholder(16)} returning revision`, [...values, id, ownerId, expected]);
      if (!updated.rows.length) throw Object.assign(new Error("The boat was changed by another request."), { code: "revision_conflict" });
    } else await this.db.query(`insert into boats (id, archived, name, type, registration, flag_state, home_port, owner, dimensions, logfactor, yacht_data, deviation_table, wind_drift_table, image_id, owner_id) values (${this.values(15)})`, [id, ...values, ownerId]);
    await this.db.query(`delete from engines where boat_id = ${this.db.placeholder(1)}`, [id]);
    for (const [sortOrder, engine] of (boat.engines?.length ? boat.engines : [defaultMainEngine()]).entries()) {
      await this.db.query(`insert into engines (id, boat_id, sort_order, name, short_label, role, archived, manufacturer, model, serial_number) values (${this.values(10)})`, [`${id}:${engine.id}`, id, sortOrder, engine.name, engine.label, engine.role, engine.archived ? 1 : 0, engine.manufacturer ?? "", engine.model ?? "", engine.serialNumber ?? ""]);
    }
  }

  async delete(id: string, ownerId: string) {
    await this.db.query(`delete from boats where id = ${this.db.placeholder(1)} and owner_id = ${this.db.placeholder(2)}`, [scopedId(ownerId, id), ownerId]);
  }

  async deleteAll(ownerId: string) {
    await this.db.query(`delete from boats where owner_id = ${this.db.placeholder(1)}`, [ownerId]);
  }

  async insert(boat: Boat, ownerId: string) {
    await this.db.query(
      `insert into boats (id, archived, name, type, registration, flag_state, home_port, owner, dimensions, logfactor, yacht_data, deviation_table, wind_drift_table, image_id, owner_id) values (${this.values(15)})`,
      [scopedId(ownerId, boat.id), boat.archived ? 1 : 0, boat.name, boat.type, boat.registration, boat.flagState, boat.homePort, boat.owner, boat.dimensions, boat.logfactor, JSON.stringify(boat.yachtData), JSON.stringify(boat.deviationTable), JSON.stringify(boat.windDriftTable ?? []), boat.imageId ?? boat.image?.id ?? null, ownerId],
    );
    // Replacements normally cascade through boats, but explicitly clear equipment
    // rows as well so legacy SQLite databases with foreign keys previously disabled
    // cannot retain stale engine sort positions.
    await this.db.query(`delete from engines where boat_id = ${this.db.placeholder(1)}`, [scopedId(ownerId, boat.id)]);
    for (const [sortOrder, engine] of (boat.engines?.length ? boat.engines : [defaultMainEngine()]).entries()) {
      await this.db.query(
        `insert into engines (id, boat_id, sort_order, name, short_label, role, archived, manufacturer, model, serial_number) values (${this.values(10)})`,
        [`${scopedId(ownerId, boat.id)}:${engine.id}`, scopedId(ownerId, boat.id), sortOrder, engine.name, engine.label, engine.role, engine.archived ? 1 : 0, engine.manufacturer ?? "", engine.model ?? "", engine.serialNumber ?? ""],
      );
    }
  }

  private values(count: number) {
    return Array.from({ length: count }, (_, index) => this.db.placeholder(index + 1)).join(", ");
  }
  private now() { return this.db.placeholder(1) === "$1" ? "current_timestamp" : "strftime('%Y-%m-%dT%H:%M:%fZ','now')"; }
}

type EngineRow = { id: string; boat_id: string; name: string; short_label: string; role: BoatEngine["role"]; archived: number | boolean; manufacturer: string; model: string; serial_number: string };

function engineFromRow(row: EngineRow): BoatEngine {
  return { id: row.id.slice(row.boat_id.length + 1), name: row.name, label: row.short_label, role: row.role, archived: Boolean(row.archived), manufacturer: row.manufacturer, model: row.model, serialNumber: row.serial_number };
}

export function imageValues(image?: StoredImage): [string | null, string | null, number | null, number | null] {
  return image ? [image.data, image.mimeType, image.width, image.height] : [null, null, null, null];
}

export function imageFromRow(row: { image_id?: string | null; image_data?: string | null; image_mime_type?: string | null; image_width?: number | null; image_height?: number | null }): StoredImage | undefined {
  if (!row.image_data || !row.image_mime_type || row.image_width == null || row.image_height == null) return undefined;
  return { id: row.image_id ?? undefined, data: row.image_data, mimeType: row.image_mime_type, width: Number(row.image_width), height: Number(row.image_height) };
}

export function scopedId(ownerId: string, id: string) {
  return `${ownerId}:${id}`;
}

export function unscopedId(id: string) {
  return id.includes(":") ? id.slice(id.indexOf(":") + 1) : id;
}
