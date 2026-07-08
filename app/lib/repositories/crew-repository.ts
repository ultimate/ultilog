import type { CrewMember, CrewMemberRow, SheetCrewMember } from "../../models/logbook";
import type { QueryableDatabase } from "../db/logbook-database";
import { decryptCrewField, encryptCrewField, isEncryptedCrewFieldValue } from "../crypto/crew-encryption";
import { scopedId } from "./boats-repository";

export class CrewRepository {
  constructor(private db: QueryableDatabase) {}

  async findProfiles(ownerId = "legacy-user") {
    return (await this.db.query<CrewMemberRow>(`
      select id as crew_member_id, name, nationality, role, address, certificate, is_primary
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

  async deleteAll(ownerId = "legacy-user") {
    await this.db.query(`delete from sheet_crew_members where sheet_id in (select id from log_sheets where owner_id = ${this.db.placeholder(1)})`, [ownerId]);
    await this.db.query(`delete from crew_members where owner_id = ${this.db.placeholder(1)}`, [ownerId]);
  }

  async insertProfile(crew: CrewMember, ownerId = "legacy-user") {
    const crewMemberId = scopedId(ownerId, crew.id);
    await this.db.query(
      `insert into crew_members (id, name, nationality, role, address, certificate, is_primary, owner_id) values (${this.values(8)}) on conflict(id) do update set name = excluded.name, nationality = excluded.nationality, role = excluded.role, address = excluded.address, certificate = excluded.certificate, is_primary = excluded.is_primary`,
      [crewMemberId, encryptCrewField(ownerId, crewMemberId, "name", this.plainCrewField(ownerId, crewMemberId, "name", crew.name)), encryptCrewField(ownerId, crewMemberId, "nationality", this.plainCrewField(ownerId, crewMemberId, "nationality", crew.nationality)), encryptCrewField(ownerId, crewMemberId, "role", this.plainCrewField(ownerId, crewMemberId, "role", crew.role)), encryptCrewField(ownerId, crewMemberId, "address", this.plainCrewField(ownerId, crewMemberId, "address", crew.address ?? "")), encryptCrewField(ownerId, crewMemberId, "certificate", this.plainCrewField(ownerId, crewMemberId, "certificate", crew.certificate ?? "")), crew.isPrimary ? 1 : 0, ownerId],
    );
  }

  async insert(sheetId: string, sortOrder: number, crew: SheetCrewMember, ownerId = "legacy-user") {
    const crewMemberId = scopedId(ownerId, crew.id);
    await this.insertProfile(crew, ownerId);
    await this.db.query(
      `insert into sheet_crew_members (sheet_id, crew_member_id, sort_order, embarkation, disembarkation, embarkation_datetime, embarkation_position, disembarkation_datetime, disembarkation_position) values (${this.values(9)})`,
      [scopedId(ownerId, sheetId), crewMemberId, sortOrder, crew.embarkationPosition, crew.disembarkationPosition, crew.embarkationDateTime, crew.embarkationPosition, crew.disembarkationDateTime, crew.disembarkationPosition],
    );
  }

  private decryptCrewRow<Row extends Pick<CrewMemberRow, "crew_member_id" | "name" | "nationality" | "role" | "address" | "certificate">>(row: Row, ownerId: string): Row {
    return {
      ...row,
      name: decryptCrewField(ownerId, row.crew_member_id, "name", row.name),
      nationality: decryptCrewField(ownerId, row.crew_member_id, "nationality", row.nationality),
      role: decryptCrewField(ownerId, row.crew_member_id, "role", row.role),
      address: decryptCrewField(ownerId, row.crew_member_id, "address", row.address ?? ""),
      certificate: decryptCrewField(ownerId, row.crew_member_id, "certificate", row.certificate ?? ""),
    };
  }

  private plainCrewField(ownerId: string, crewMemberId: string, fieldName: string, value: string) {
    return isEncryptedCrewFieldValue(value) ? decryptCrewField(ownerId, crewMemberId, fieldName, value) : value;
  }

  private values(count: number) {
    return Array.from({ length: count }, (_, index) => this.db.placeholder(index + 1)).join(", ");
  }
}
