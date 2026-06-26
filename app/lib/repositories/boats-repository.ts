import type { Boat, BoatRow } from "../../models/logbook";
import type { QueryableDatabase } from "../db/logbook-database";

export class BoatsRepository {
  constructor(private db: QueryableDatabase) {}

  async findAll(ownerId = "legacy-user") {
    return (await this.db.query<BoatRow>(`select * from boats where owner_id = ${this.db.placeholder(1)} order by name`, [ownerId])).rows;
  }

  async deleteAll(ownerId = "legacy-user") {
    await this.db.query(`delete from boats where owner_id = ${this.db.placeholder(1)}`, [ownerId]);
  }

  async insert(boat: Boat) {
    await this.db.query(
      `insert into boats (id, name, type, registration, flag_state, home_port, owner, dimensions, yacht_data, owner_id) values (${this.values(10)})`,
      [boat.id, boat.name, boat.type, boat.registration, boat.flagState, boat.homePort, boat.owner, boat.dimensions, JSON.stringify(boat.yachtData), (this.db as { ownerId?: string }).ownerId ?? "legacy-user"],
    );
  }

  private values(count: number) {
    return Array.from({ length: count }, (_, index) => this.db.placeholder(index + 1)).join(", ");
  }
}
