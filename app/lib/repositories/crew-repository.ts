import type { CrewMember, CrewMemberRow } from "../../models/logbook";
import type { QueryableDatabase } from "../db/logbook-database";

export class CrewRepository {
  constructor(private db: QueryableDatabase) {}

  async findAll() {
    return (await this.db.query<CrewMemberRow>("select * from crew_members order by sheet_id, sort_order")).rows;
  }

  async deleteAll() {
    await this.db.query("delete from crew_members");
  }

  async insert(sheetId: string, sortOrder: number, crew: CrewMember) {
    await this.db.query(
      `insert into crew_members (sheet_id, sort_order, name, nationality, role, embarkation, disembarkation) values (${this.values(7)})`,
      [sheetId, sortOrder, crew.name, crew.nationality, crew.role, crew.embarkation, crew.disembarkation],
    );
  }

  private values(count: number) {
    return Array.from({ length: count }, (_, index) => this.db.placeholder(index + 1)).join(", ");
  }
}
