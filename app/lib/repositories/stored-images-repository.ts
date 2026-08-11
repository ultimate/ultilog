import type { QueryableDatabase } from "../db/logbook-database";
import type { StoredImage } from "../../models/stored-image";

type StoredImageRow = { id: string; data: string; mime_type: string; width: number; height: number };

/** All access is owner scoped; callers can never attach or read another owner's bytes. */
export class StoredImagesRepository {
  constructor(private db: QueryableDatabase) {}

  async create(id: string, ownerId: string, image: Omit<StoredImage, "id">) {
    await this.db.query(`insert into stored_images (id, owner_id, data, mime_type, width, height) values (${this.values(6)})`, [id, ownerId, image.data, image.mimeType, image.width, image.height]);
    return { id, ...image };
  }

  async findById(id: string, ownerId: string) {
    const row = (await this.db.query<StoredImageRow>(`select id, data, mime_type, width, height from stored_images where id = ${this.db.placeholder(1)} and owner_id = ${this.db.placeholder(2)} limit 1`, [id, ownerId])).rows[0];
    return row ? { id: row.id, data: row.data, mimeType: row.mime_type, width: Number(row.width), height: Number(row.height) } : undefined;
  }

  async assertOwned(id: string | undefined, ownerId: string) {
    if (id && !await this.findById(id, ownerId)) throw Object.assign(new Error("Stored image not found."), { code: "missing_image" });
  }

  async isReferenced(id: string, ownerId: string) {
    const result = await this.db.query<{ referenced: number }>(`select 1 as referenced from stored_images where id = ${this.db.placeholder(1)} and owner_id = ${this.db.placeholder(2)} and (exists(select 1 from boats where image_id = stored_images.id) or exists(select 1 from crew_members where image_id = stored_images.id) or exists(select 1 from log_sheets where image_id = stored_images.id)) limit 1`, [id, ownerId]);
    return Boolean(result.rows.length);
  }

  async deleteIfOrphaned(id: string | undefined, ownerId: string) {
    if (!id || await this.isReferenced(id, ownerId)) return false;
    const found = await this.findById(id, ownerId);
    if (!found) return false;
    await this.db.query(`delete from stored_images where id = ${this.db.placeholder(1)} and owner_id = ${this.db.placeholder(2)} and not exists(select 1 from boats where image_id = stored_images.id) and not exists(select 1 from crew_members where image_id = stored_images.id) and not exists(select 1 from log_sheets where image_id = stored_images.id)`, [id, ownerId]);
    return true;
  }

  async delete(id: string, ownerId: string) {
    if (await this.isReferenced(id, ownerId)) throw Object.assign(new Error("Stored image is still referenced."), { code: "referenced_image" });
    return this.deleteIfOrphaned(id, ownerId);
  }

  private values(count: number) { return Array.from({ length: count }, (_, i) => this.db.placeholder(i + 1)).join(", "); }
}
