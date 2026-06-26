import type { CrewMember, CrewMemberRow } from "../../models/logbook";
import type { QueryableDatabase } from "../db/logbook-database";

export class CrewRepository {
  constructor(private db: QueryableDatabase) {}

  async findAll() {
    return (await this.db.query<CrewMemberRow>(`
      select
        sheet_crew_members.sheet_id,
        sheet_crew_members.crew_member_id,
        sheet_crew_members.sort_order,
        crew_members.name,
        crew_members.nationality,
        crew_members.role,
        sheet_crew_members.embarkation,
        sheet_crew_members.disembarkation
      from sheet_crew_members
      join crew_members on crew_members.id = sheet_crew_members.crew_member_id
      order by sheet_crew_members.sheet_id, sheet_crew_members.sort_order
    `)).rows;
  }

  async deleteAll() {
    await this.db.query("delete from sheet_crew_members");
    await this.db.query("delete from crew_members");
  }

  async insert(sheetId: string, sortOrder: number, crew: CrewMember) {
    const crewMemberId = crewMemberReference(crew);
    await this.db.query(
      `insert into crew_members (id, name, nationality, role) values (${this.values(4)}) on conflict(id) do update set name = excluded.name, nationality = excluded.nationality, role = excluded.role`,
      [crewMemberId, crew.name, crew.nationality, crew.role],
    );
    await this.db.query(
      `insert into sheet_crew_members (sheet_id, crew_member_id, sort_order, embarkation, disembarkation) values (${this.values(5)})`,
      [sheetId, crewMemberId, sortOrder, crew.embarkation, crew.disembarkation],
    );
  }

  private values(count: number) {
    return Array.from({ length: count }, (_, index) => this.db.placeholder(index + 1)).join(", ");
  }
}

function crewMemberReference(crew: Pick<CrewMember, "name" | "nationality">) {
  return `${slug(crew.name)}-${slug(crew.nationality)}`;
}

function slug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "crew";
}
