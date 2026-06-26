import type { LogLine, LogLineRow } from "../../models/logbook";
import type { QueryableDatabase } from "../db/logbook-database";
import { scopedId } from "./boats-repository";

export class LogLinesRepository {
  constructor(private db: QueryableDatabase) {}

  async findAll(ownerId = "legacy-user") {
    return (await this.db.query<LogLineRow>(`select log_lines.sheet_id, log_lines.sort_order, log_lines.time, log_lines.position_name as position, log_lines.latitude, log_lines.longitude, log_lines.log_nm, log_lines.course, log_lines.magnetic_course, log_lines.sea_state, log_lines.barometer, log_lines.wind, log_lines.weather, log_lines.sails, log_lines.engine, log_lines.remarks from log_lines join log_sheets on log_sheets.id = log_lines.sheet_id where log_sheets.owner_id = ${this.db.placeholder(1)} order by log_lines.sheet_id, sort_order`, [ownerId])).rows;
  }

  async deleteAll(ownerId = "legacy-user") {
    await this.db.query(`delete from log_lines where sheet_id in (select id from log_sheets where owner_id = ${this.db.placeholder(1)})`, [ownerId]);
  }

  async insert(sheetId: string, sortOrder: number, line: LogLine, ownerId = "legacy-user") {
    await this.db.query(
      `insert into log_lines (sheet_id, sort_order, time, position_name, latitude, longitude, log_nm, course, magnetic_course, sea_state, barometer, wind, weather, sails, engine, remarks) values (${this.values(16)})`,
      [scopedId(ownerId, sheetId), sortOrder, line.time, line.position, line.latitude, line.longitude, line.logNm, line.course, line.magneticCourse, line.seaState, line.barometer, line.wind, line.weather, line.sails, line.engine, line.remarks],
    );
  }

  private values(count: number) {
    return Array.from({ length: count }, (_, index) => this.db.placeholder(index + 1)).join(", ");
  }
}
