import type { CrewMember, CrewMemberRow, SheetCrewMember } from "../../models/logbook";
import type { QueryableDatabase } from "../db/logbook-database";
import { scopedId } from "./boats-repository";

export class CrewRepository {
  constructor(private db: QueryableDatabase) {}

  async findProfiles(ownerId = "legacy-user") {
    return (await this.db.query<CrewMemberRow>(`
      select id as crew_member_id, name, nationality, role, address, certificate, is_primary
      from crew_members
      where owner_id = ${this.db.placeholder(1)}
      order by is_primary desc, name
    `, [ownerId])).rows;
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
        sheet_crew_members.embarkation,
        sheet_crew_members.disembarkation
      from sheet_crew_members
      join log_sheets on log_sheets.id = sheet_crew_members.sheet_id
      join crew_members on crew_members.id = sheet_crew_members.crew_member_id
      where log_sheets.owner_id = ${this.db.placeholder(1)}
      order by sheet_crew_members.sheet_id, sheet_crew_members.sort_order
    `, [ownerId])).rows;
  }

  async deleteAll(ownerId = "legacy-user") {
    await this.db.query(`delete from sheet_crew_members where sheet_id in (select id from log_sheets where owner_id = ${this.db.placeholder(1)})`, [ownerId]);
    await this.db.query(`delete from crew_members where owner_id = ${this.db.placeholder(1)}`, [ownerId]);
  }

  async insertProfile(crew: CrewMember, ownerId = "legacy-user") {
    await this.db.query(
      `insert into crew_members (id, name, nationality, role, address, certificate, is_primary, owner_id) values (${this.values(8)}) on conflict(id) do update set name = excluded.name, nationality = excluded.nationality, role = excluded.role, address = excluded.address, certificate = excluded.certificate, is_primary = excluded.is_primary`,
      [scopedId(ownerId, crew.id), crew.name, crew.nationality, crew.role, crew.address ?? "", crew.certificate ?? "", crew.isPrimary ? 1 : 0, ownerId],
    );
  }

  async insert(sheetId: string, sortOrder: number, crew: SheetCrewMember, ownerId = "legacy-user") {
    const crewMemberId = scopedId(ownerId, crew.id);
    await this.insertProfile(crew, ownerId);
    await this.db.query(
      `insert into sheet_crew_members (sheet_id, crew_member_id, sort_order, embarkation, disembarkation) values (${this.values(5)})`,
      [scopedId(ownerId, sheetId), crewMemberId, sortOrder, crew.embarkation, crew.disembarkation],
    );
  }

  private values(count: number) {
    return Array.from({ length: count }, (_, index) => this.db.placeholder(index + 1)).join(", ");
  }
}
