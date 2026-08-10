import type { LogLine, LogLineRow } from "../../models/logbook";
import type { QueryableDatabase } from "../db/logbook-database";
import { scopedId } from "./boats-repository";

export class LogLinesRepository {
  constructor(private db: QueryableDatabase) {}

  async findAll(ownerId: string) {
    const rows = (await this.db.query<LogLineRow>(`select log_lines.* from log_lines join log_sheets on log_sheets.id = log_lines.sheet_id where log_sheets.owner_id = ${this.db.placeholder(1)} order by log_lines.sheet_id, time, sort_order`, [ownerId])).rows;
    const hours = (await this.db.query<EngineHoursRow>(`select h.*, e.boat_id from log_line_engine_hours h join engines e on e.id = h.engine_id join log_sheets s on s.id = h.sheet_id where s.owner_id = ${this.db.placeholder(1)}`, [ownerId])).rows;
    return attachEngineHours(rows, hours);
  }

  async findForSheet(sheetScopedId: string) {
    const rows = (await this.db.query<LogLineRow>(`select * from log_lines where sheet_id = ${this.db.placeholder(1)} order by time, sort_order`, [sheetScopedId])).rows;
    const hours = (await this.db.query<EngineHoursRow>(`select h.*, e.boat_id from log_line_engine_hours h join engines e on e.id = h.engine_id where h.sheet_id = ${this.db.placeholder(1)}`, [sheetScopedId])).rows;
    return attachEngineHours(rows, hours);
  }

  async deleteAll(ownerId: string) {
    await this.db.query(`delete from log_lines where sheet_id in (select id from log_sheets where owner_id = ${this.db.placeholder(1)})`, [ownerId]);
  }

  async insert(sheetId: string, sortOrder: number, line: LogLine, ownerId: string) {
    await this.insertMany([{ sheetId, sortOrder, line }], ownerId);
  }

  async insertMany(entries: { sheetId: string; sortOrder: number; line: LogLine }[], ownerId: string) {
    if (!entries.length) return;
    const columns = ["sheet_id", "id", "sort_order", "time", "position_name", "latitude", "longitude", "log_nm", "compass_course", "waves", "barometer", "weather", "weather_remark", "temperature", "temperature_unit", "sails", "engine", "wind_direction", "wind_strength", "wind_unit", "sea_unit", "tide", "tide_unit", "moon", "deviation", "magnetic_course", "variation", "true_course", "wind_drift", "course_through_water", "current_drift", "course_over_ground", "speed_kn", "sail_miles", "sail_note", "motor_miles", "motor_hours", "motor_note", "remarks"];
    const values = entries.flatMap(({ sheetId, sortOrder, line }) => [scopedId(ownerId, sheetId), line.id, sortOrder, line.time, line.position, line.latitude, line.longitude, line.logNm, line.compassCourse, line.waves, line.barometer, line.weather, line.weatherRemark, line.temperature, line.temperatureUnit, line.sailNote, line.motorNote, line.windDirection, line.windStrength, line.windUnit, line.seaUnit, line.tide, line.tideUnit, line.moon, line.deviation, line.magneticCourse, line.variation, line.trueCourse, line.windDrift, line.courseThroughWater, line.currentDrift, line.courseOverGround, line.speedKn, line.sailMiles, line.sailNote, line.motorMiles, line.motorHours, line.motorNote, line.remarks]);
    const rows = entries.map((_, rowIndex) => `(${this.values(columns.length, (rowIndex * columns.length) + 1)})`).join(", ");
    await this.db.query(
      `insert into log_lines (${columns.join(", ")}) values ${rows}`,
      values,
    );
    for (const { sheetId, sortOrder, line } of entries) {
      const engineHours = line.engineHours ?? {};
      for (const [engineId, rawHours] of Object.entries(engineHours)) {
        const hours = Math.max(0, Number(rawHours) || 0);
        if (!hours) continue;
        await this.db.query(
          `insert into log_line_engine_hours (sheet_id, line_sort_order, engine_id, runtime_hours) select ${this.db.placeholder(1)}, ${this.db.placeholder(2)}, engines.id, ${this.db.placeholder(3)} from engines join log_sheets on log_sheets.boat_id = engines.boat_id where log_sheets.id = ${this.db.placeholder(1)} and engines.id = engines.boat_id || ':' || ${this.db.placeholder(4)}`,
          [scopedId(ownerId, sheetId), sortOrder, hours, engineId],
        );
      }
    }
  }

  private values(count: number, start = 1) {
    return Array.from({ length: count }, (_, index) => this.db.placeholder(start + index)).join(", ");
  }
}

type EngineHoursRow = { sheet_id: string; line_sort_order: number; engine_id: string; runtime_hours: number; boat_id: string };

function attachEngineHours(rows: LogLineRow[], hours: EngineHoursRow[]) {
  return rows.map((row) => {
    const engineHours = Object.fromEntries(hours.filter((item) => item.sheet_id === row.sheet_id && Number(item.line_sort_order) === Number(row.sort_order)).map((item) => [item.engine_id.slice(item.boat_id.length + 1), Number(item.runtime_hours)]));
    return Object.keys(engineHours).length ? { ...row, engineHours } : row;
  });
}
