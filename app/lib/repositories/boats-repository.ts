import type { Boat, BoatRow } from "../../models/logbook";
import type { QueryableDatabase } from "../db/logbook-database";

export class BoatsRepository {
  constructor(private db: QueryableDatabase) {}

  async findAll() {
    return (await this.db.query<BoatRow>("select * from boats order by name")).rows;
  }

  async deleteAll() {
    await this.db.query("delete from boats");
  }

  async insert(boat: Boat) {
    await this.db.query(
      `insert into boats (id, name, type, registration, flag_state, home_port, owner, dimensions, yacht_data) values (${this.values(9)})`,
      [boat.id, boat.name, boat.type, boat.registration, boat.flagState, boat.homePort, boat.owner, boat.dimensions, JSON.stringify(boat.yachtData)],
    );
  }

  private values(count: number) {
    return Array.from({ length: count }, (_, index) => this.db.placeholder(index + 1)).join(", ");
  }
}
