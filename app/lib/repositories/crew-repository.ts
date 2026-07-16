import type { CrewMember, CrewMemberRow, SheetCrewMember } from "../../models/logbook";
import type { QueryableDatabase } from "../db/logbook-database";
import { decryptCrewField, encryptCrewField, isEncryptedCrewFieldValue } from "../crypto/crew-encryption";
import { imageValues, scopedId } from "./boats-repository";

export class CrewRepository {
  constructor(private db: QueryableDatabase) {}

  async findProfiles(ownerId = "legacy-user") {
    return (await this.db.query<CrewMemberRow>(`
      select id as crew_member_id, name, nationality, role, address, certificate, is_primary, image_data, image_mime_type, image_width, image_height
      from crew_members
      where owner_id = ${this.db.placeholder(1)}
      order by is_primary desc
    `, [ownerId])).rows.map((row) => this.decryptCrewRow(row, ownerId)).sort((left, right) => Number(right.is_primary ?? 0) - Number(left.is_primary ?? 0) || left.name.localeCompare(right.name));
  }

  async findAll(ownerId = "legacy-user") {
    return (await this.db.query<CrewMemberRow>(`
      select
        sheet_crew_members.sheet_id,
        sheet_crew_members.crew_member_id,
        sheet_crew_members.sort_order,
        crew_members.id,
        crew_members.name,
        crew_members.nationality,
        crew_members.role,
        crew_members.address,
        crew_members.certificate,
        crew_members.is_primary,
        crew_members.image_data,
        crew_members.image_mime_type,
        crew_members.image_width,
        crew_members.image_height,
        sheet_crew_members.embarkation_datetime,
        sheet_crew_members.embarkation_position,
        sheet_crew_members.disembarkation_datetime,
        sheet_crew_members.disembarkation_position
      from sheet_crew_members
      join log_sheets on log_sheets.id = sheet_crew_members.sheet_id
      join crew_members on crew_members.id = sheet_crew_members.crew_member_id
      where log_sheets.owner_id = ${this.db.placeholder(1)}
      order by sheet_crew_members.sheet_id, sheet_crew_members.sort_order
    `, [ownerId])).rows.map((row) => this.decryptCrewRow(row, ownerId));
  }

  async findForSheet(sheetScopedId: string, ownerId = "legacy-user") {
    return (await this.db.query<CrewMemberRow>(`
      select
        sheet_crew_members.sheet_id,
        sheet_crew_members.crew_member_id,
        sheet_crew_members.sort_order,
        crew_members.id,
        crew_members.name,
        crew_members.nationality,
        crew_members.role,
        crew_members.address,
        crew_members.certificate,
        crew_members.is_primary,
        crew_members.image_data,
        crew_members.image_mime_type,
        crew_members.image_width,
        crew_members.image_height,
        sheet_crew_members.embarkation_datetime,
        sheet_crew_members.embarkation_position,
        sheet_crew_members.disembarkation_datetime,
        sheet_crew_members.disembarkation_position
      from sheet_crew_members
      join crew_members on crew_members.id = sheet_crew_members.crew_member_id
      where sheet_crew_members.sheet_id = ${this.db.placeholder(1)}
      order by sheet_crew_members.sort_order
    `, [sheetScopedId])).rows.map((row) => this.decryptCrewRow(row, ownerId));
  }

  async deleteAll(ownerId = "legacy-user") {
    await this.db.query(`delete from sheet_crew_members where sheet_id in (select id from log_sheets where owner_id = ${this.db.placeholder(1)})`, [ownerId]);
    await this.db.query(`delete from crew_members where owner_id = ${this.db.placeholder(1)}`, [ownerId]);
  }

  async insertProfile(crew: CrewMember, ownerId = "legacy-user") {
    const crewMemberId = scopedId(ownerId, crew.id);
    await this.db.query(
      `insert into crew_members (id, name, nationality, role, address, certificate, is_primary, image_data, image_mime_type, image_width, image_height, owner_id) values (${this.values(12)}) on conflict(id) do update set name = excluded.name, nationality = excluded.nationality, role = excluded.role, address = excluded.address, certificate = excluded.certificate, is_primary = excluded.is_primary, image_data = excluded.image_data, image_mime_type = excluded.image_mime_type, image_width = excluded.image_width, image_height = excluded.image_height`,
      [
        crewMemberId,
        encryptCrewField(ownerId, crewMemberId, "name", this.plainCrewField(ownerId, crewMemberId, "name", crew.name)),
        encryptCrewField(ownerId, crewMemberId, "nationality", this.plainCrewField(ownerId, crewMemberId, "nationality", crew.nationality)),
        encryptCrewField(ownerId, crewMemberId, "role", this.plainCrewField(ownerId, crewMemberId, "role", crew.role)),
        encryptCrewField(ownerId, crewMemberId, "address", this.plainCrewField(ownerId, crewMemberId, "address", crew.address ?? "")),
        encryptCrewField(ownerId, crewMemberId, "certificate", this.plainCrewField(ownerId, crewMemberId, "certificate", crew.certificate ?? "")),
        crew.isPrimary ? 1 : 0,
        ...this.encryptedImageValues(ownerId, crewMemberId, crew.image),
        ownerId,
      ],
    );
  }


  async ensurePrimaryProfile(ownerId = "legacy-user") {
    const existingPrimary = await this.db.query<{ id: string }>(
      `select id from crew_members where owner_id = ${this.db.placeholder(1)} and is_primary = 1 limit 1`,
      [ownerId],
    );
    if (existingPrimary.rows.length) return;

    const primaryId = scopedId(ownerId, "me");
    const existingPersonalProfile = await this.db.query<{ id: string }>(
      `select id from crew_members where id = ${this.db.placeholder(1)} limit 1`,
      [primaryId],
    );
    if (existingPersonalProfile.rows.length) {
      await this.db.query(`update crew_members set is_primary = 1 where id = ${this.db.placeholder(1)}`, [primaryId]);
      return;
    }

    const user = await this.db.query<{ name: string }>(`select name from users where id = ${this.db.placeholder(1)} limit 1`, [ownerId]);
    await this.insertProfile({
      id: "me",
      name: user.rows[0]?.name ?? "Me",
      nationality: "",
      role: "Owner",
      address: "",
      certificate: "",
      isPrimary: true,
    }, ownerId);
  }

  async insert(sheetId: string, sortOrder: number, crew: SheetCrewMember, ownerId = "legacy-user") {
    const crewMemberId = scopedId(ownerId, crew.id);
    await this.insertProfile(crew, ownerId);
    await this.db.query(
      `insert into sheet_crew_members (sheet_id, crew_member_id, sort_order, embarkation, disembarkation, embarkation_datetime, embarkation_position, disembarkation_datetime, disembarkation_position) values (${this.values(9)})`,
      [scopedId(ownerId, sheetId), crewMemberId, sortOrder, crew.embarkationPosition, crew.disembarkationPosition, crew.embarkationDateTime, crew.embarkationPosition, crew.disembarkationDateTime, crew.disembarkationPosition],
    );
  }

  private decryptCrewRow<Row extends Pick<CrewMemberRow, "crew_member_id" | "name" | "nationality" | "role" | "address" | "certificate" | "image_data">>(row: Row, ownerId: string): Row {
    return {
      ...row,
      name: decryptCrewField(ownerId, row.crew_member_id, "name", row.name),
      nationality: decryptCrewField(ownerId, row.crew_member_id, "nationality", row.nationality),
      role: decryptCrewField(ownerId, row.crew_member_id, "role", row.role),
      address: decryptCrewField(ownerId, row.crew_member_id, "address", row.address ?? ""),
      certificate: decryptCrewField(ownerId, row.crew_member_id, "certificate", row.certificate ?? ""),
      image_data: this.decryptImageData(ownerId, row.crew_member_id, row.image_data),
    };
  }

  private encryptedImageValues(ownerId: string, crewMemberId: string, image: CrewMember["image"]): [string | null, string | null, number | null, number | null] {
    const [data, mimeType, width, height] = imageValues(image);
    return [data ? encryptCrewField(ownerId, crewMemberId, "image_data", this.plainCrewField(ownerId, crewMemberId, "image_data", data)) : null, mimeType, width, height];
  }

  private decryptImageData(ownerId: string, crewMemberId: string, value?: string | null) {
    return value ? decryptCrewField(ownerId, crewMemberId, "image_data", value) : value;
  }

  private plainCrewField(ownerId: string, crewMemberId: string, fieldName: string, value: string) {
    return isEncryptedCrewFieldValue(value) ? decryptCrewField(ownerId, crewMemberId, fieldName, value) : value;
  }

  private values(count: number) {
    return Array.from({ length: count }, (_, index) => this.db.placeholder(index + 1)).join(", ");
  }
}
