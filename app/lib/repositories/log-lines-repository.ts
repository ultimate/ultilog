import type { LogLine, LogLineRow } from "../../models/logbook";
import type { QueryableDatabase } from "../db/logbook-database";
import { scopedId } from "./boats-repository";

export class LogLinesRepository {
  constructor(private db: QueryableDatabase) {}

  async findAll(ownerId = "legacy-user") {
    return (await this.db.query<LogLineRow>(`select log_lines.* from log_lines join log_sheets on log_sheets.id = log_lines.sheet_id where log_sheets.owner_id = ${this.db.placeholder(1)} order by log_lines.sheet_id, time, sort_order`, [ownerId])).rows;
  }

  async findForSheet(sheetScopedId: string) {
    return (await this.db.query<LogLineRow>(`select * from log_lines where sheet_id = ${this.db.placeholder(1)} order by time, sort_order`, [sheetScopedId])).rows;
  }

  async deleteAll(ownerId = "legacy-user") {
    await this.db.query(`delete from log_lines where sheet_id in (select id from log_sheets where owner_id = ${this.db.placeholder(1)})`, [ownerId]);
  }

  async insert(sheetId: string, sortOrder: number, line: LogLine, ownerId = "legacy-user") {
    const columns = ["sheet_id", "sort_order", "time", "position_name", "latitude", "longitude", "log_nm", "compass_course", "waves", "barometer", "weather", "weather_remark", "temperature", "temperature_unit", "sails", "engine", "wind_direction", "wind_strength", "wind_unit", "sea_unit", "tide", "tide_unit", "moon", "deviation", "magnetic_course", "variation", "true_course", "wind_drift", "course_through_water", "current_drift", "course_over_ground", "speed_kn", "sail_miles", "sail_note", "motor_miles", "motor_hours", "motor_note", "remarks"];
    await this.db.query(
      `insert into log_lines (${columns.join(", ")}) values (${this.values(columns.length)})`,
      [scopedId(ownerId, sheetId), sortOrder, line.time, line.position, line.latitude, line.longitude, line.logNm, line.compassCourse, line.waves, line.barometer, line.weather, line.weatherRemark, line.temperature, line.temperatureUnit, line.sailNote, line.motorNote, line.windDirection, line.windStrength, line.windUnit, line.seaUnit, line.tide, line.tideUnit, line.moon, line.deviation, line.magneticCourse, line.variation, line.trueCourse, line.windDrift, line.courseThroughWater, line.currentDrift, line.courseOverGround, line.speedKn, line.sailMiles, line.sailNote, line.motorMiles, line.motorHours, line.motorNote, line.remarks],
    );
  }

  private values(count: number) {
    return Array.from({ length: count }, (_, index) => this.db.placeholder(index + 1)).join(", ");
  }
}
