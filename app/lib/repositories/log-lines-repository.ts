import type { LogLine, LogLineRow } from "../../models/logbook";
import type { QueryableDatabase } from "../db/logbook-database";

export class LogLinesRepository {
  constructor(private db: QueryableDatabase) {}

  async findAll() {
    return (await this.db.query<LogLineRow>("select sheet_id, sort_order, time, position_name as position, latitude, longitude, log_nm, course, magnetic_course, sea_state, barometer, wind, weather, sails, engine, remarks from log_lines order by sheet_id, sort_order")).rows;
  }

  async deleteAll() {
    await this.db.query("delete from log_lines");
  }

  async insert(sheetId: string, sortOrder: number, line: LogLine) {
    await this.db.query(
      `insert into log_lines (sheet_id, sort_order, time, position_name, latitude, longitude, log_nm, course, magnetic_course, sea_state, barometer, wind, weather, sails, engine, remarks) values (${this.values(16)})`,
      [sheetId, sortOrder, line.time, line.position, line.latitude, line.longitude, line.logNm, line.course, line.magneticCourse, line.seaState, line.barometer, line.wind, line.weather, line.sails, line.engine, line.remarks],
    );
  }

  private values(count: number) {
    return Array.from({ length: count }, (_, index) => this.db.placeholder(index + 1)).join(", ");
  }
}
