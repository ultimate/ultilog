import type { LogLine, LogLineRow } from "../../models/logbook";
import type { QueryableDatabase } from "../db/logbook-database";
import { expectedRevision, scopedId } from "./boats-repository";

export class LogLinesRepository {
  constructor(private db: QueryableDatabase) {}

  async findAll(ownerId: string) {
    const rows = (await this.db.query<LogLineRow>(`select log_lines.* from log_lines join log_sheets on log_sheets.id = log_lines.sheet_id where log_sheets.owner_id = ${this.db.placeholder(1)} order by log_lines.sheet_id, sort_order`, [ownerId])).rows;
    const hours = (await this.db.query<EngineHoursRow>(`select h.*, e.boat_id from log_line_engine_hours h join engines e on e.id = h.engine_id join log_sheets s on s.id = h.sheet_id where s.owner_id = ${this.db.placeholder(1)}`, [ownerId])).rows;
    return attachEngineHours(rows, hours);
  }

  async findForSheet(sheetScopedId: string) {
    const rows = (await this.db.query<LogLineRow>(`select * from log_lines where sheet_id = ${this.db.placeholder(1)} order by sort_order`, [sheetScopedId])).rows;
    const hours = (await this.db.query<EngineHoursRow>(`select h.*, e.boat_id from log_line_engine_hours h join engines e on e.id = h.engine_id where h.sheet_id = ${this.db.placeholder(1)}`, [sheetScopedId])).rows;
    return attachEngineHours(rows, hours);
  }

  async deleteAll(ownerId: string) {
    await this.db.query(`delete from log_lines where sheet_id in (select id from log_sheets where owner_id = ${this.db.placeholder(1)})`, [ownerId]);
  }

  async replaceForSheet(sheetId: string, lines: LogLine[], ownerId: string) {
    const scopedSheetId = scopedId(ownerId, sheetId);
    await this.db.query(`delete from log_lines where sheet_id = ${this.db.placeholder(1)} and exists (select 1 from log_sheets where id = ${this.db.placeholder(1)} and owner_id = ${this.db.placeholder(2)})`, [scopedSheetId, ownerId]);
    await this.insertMany(lines.map((line, sortOrder) => ({ sheetId, sortOrder, line })), ownerId);
  }

  async insert(sheetId: string, sortOrder: number, line: LogLine, ownerId: string) {
    await this.insertMany([{ sheetId, sortOrder, line }], ownerId);
  }

  async create(sheetId: string, line: LogLine, ownerId: string) {
    const scopedSheetId = scopedId(ownerId, sheetId);
    const existing = await this.findOwnedLine(scopedSheetId, line.id, ownerId);
    if (existing) throw new Error("A line with this id already exists.");
    const result = await this.db.query<{ sort_order: number }>(`select coalesce(max(sort_order), -1) + 1 as sort_order from log_lines where sheet_id = ${this.db.placeholder(1)} and exists (select 1 from log_sheets where id = ${this.db.placeholder(1)} and owner_id = ${this.db.placeholder(2)})`, [scopedSheetId, ownerId]);
    if (!result.rows.length) return undefined;
    await this.insert(sheetId, Number(result.rows[0].sort_order), line, ownerId);
    const stored = (await this.findForSheet(scopedSheetId)).find(row => row.id === line.id);
    return stored ? LogSheetsLine(stored) : undefined;
  }

  async update(sheetId: string, lineId: string, line: LogLine, ownerId: string) {
    const scopedSheetId = scopedId(ownerId, sheetId);
    const current = await this.findOwnedLine(scopedSheetId, lineId, ownerId);
    if (!current) return undefined;
    const revision = expectedRevision(line.revision);
    const columns = ["time", "position_name", "latitude", "longitude", "log_nm", "compass_course", "waves", "barometer", "weather", "weather_remark", "temperature", "temperature_unit", "sails", "engine", "wind_direction", "wind_strength", "wind_unit", "sea_unit", "tide", "tide_unit", "moon", "deviation", "magnetic_course", "variation", "true_course", "wind_drift", "course_through_water", "current_drift", "course_over_ground", "speed_kn", "sail_miles", "sail_note", "motor_miles", "motor_hours", "motor_note", "remarks"];
    const values = lineValues(line);
    const assignments = columns.map((column, index) => `${column} = ${this.db.placeholder(index + 1)}`);
    const updated = await this.db.query<{ revision: number; created_at: string | Date; updated_at: string | Date }>(
      `update log_lines set ${assignments.join(", ")}, revision = revision + 1, updated_at = ${this.now()} where sheet_id = ${this.db.placeholder(values.length + 1)} and id = ${this.db.placeholder(values.length + 2)} and revision = ${this.db.placeholder(values.length + 3)} and exists (select 1 from log_sheets where id = log_lines.sheet_id and owner_id = ${this.db.placeholder(values.length + 4)}) returning revision, created_at, updated_at`,
      [...values, scopedSheetId, lineId, revision, ownerId],
    );
    if (!updated.rows.length) throw Object.assign(new Error("The log line was changed by another request."), { code: "revision_conflict" });
    await this.db.query(`delete from log_line_engine_hours where sheet_id = ${this.db.placeholder(1)} and line_sort_order = ${this.db.placeholder(2)}`, [scopedSheetId, Number(current.sort_order)]);
    await this.insertEngineHours(sheetId, Number(current.sort_order), line, ownerId);
    const stored = (await this.findForSheet(scopedSheetId)).find(row => row.id === lineId);
    return stored ? LogSheetsLine(stored) : undefined;
  }

  async delete(sheetId: string, lineId: string, ownerId: string) {
    const scopedSheetId = scopedId(ownerId, sheetId);
    const current = await this.findOwnedLine(scopedSheetId, lineId, ownerId);
    if (!current) return undefined;
    await this.db.query(`delete from log_lines where sheet_id = ${this.db.placeholder(1)} and id = ${this.db.placeholder(2)}`, [scopedSheetId, lineId]);
    return current;
  }

  async reorder(sheetId: string, lineIds: string[], ownerId: string) {
    const scopedSheetId = scopedId(ownerId, sheetId);
    const lines = await this.findForSheet(scopedSheetId);
    if (lines.length !== lineIds.length || lines.some(row => !lineIds.includes(row.id))) return undefined;
    // Move through unique temporary positions after detaching the legacy sort-order FK.
    await this.db.query(`delete from log_line_engine_hours where sheet_id = ${this.db.placeholder(1)}`, [scopedSheetId]);
    for (const [index, id] of lineIds.entries()) await this.db.query(`update log_lines set sort_order = ${this.db.placeholder(1)} where sheet_id = ${this.db.placeholder(2)} and id = ${this.db.placeholder(3)}`, [lineIds.length + index, scopedSheetId, id]);
    for (const [index, id] of lineIds.entries()) await this.db.query(`update log_lines set sort_order = ${this.db.placeholder(1)} where sheet_id = ${this.db.placeholder(2)} and id = ${this.db.placeholder(3)}`, [index, scopedSheetId, id]);
    for (const [index, id] of lineIds.entries()) await this.insertEngineHours(sheetId, index, LogSheetsLine(lines.find(line => line.id === id)!), ownerId);
    return lineIds;
  }

  private async findOwnedLine(sheetScopedId: string, lineId: string, ownerId: string) {
    return (await this.db.query<LogLineRow>(`select log_lines.* from log_lines join log_sheets on log_sheets.id = log_lines.sheet_id where log_lines.sheet_id = ${this.db.placeholder(1)} and log_lines.id = ${this.db.placeholder(2)} and log_sheets.owner_id = ${this.db.placeholder(3)} limit 1`, [sheetScopedId, lineId, ownerId])).rows[0];
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
      await this.insertEngineHours(sheetId, sortOrder, line, ownerId);
    }
  }

  private async insertEngineHours(sheetId: string, sortOrder: number, line: LogLine, ownerId: string) {
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

  private values(count: number, start = 1) {
    return Array.from({ length: count }, (_, index) => this.db.placeholder(start + index)).join(", ");
  }

  private now() { return this.db.placeholder(1) === "$1" ? "current_timestamp" : "strftime('%Y-%m-%dT%H:%M:%fZ','now')"; }
}

function lineValues(line: LogLine) {
  return [line.time, line.position, line.latitude, line.longitude, line.logNm, line.compassCourse, line.waves, line.barometer, line.weather, line.weatherRemark, line.temperature, line.temperatureUnit, line.sailNote, line.motorNote, line.windDirection, line.windStrength, line.windUnit, line.seaUnit, line.tide, line.tideUnit, line.moon, line.deviation, line.magneticCourse, line.variation, line.trueCourse, line.windDrift, line.courseThroughWater, line.currentDrift, line.courseOverGround, line.speedKn, line.sailMiles, line.sailNote, line.motorMiles, line.motorHours, line.motorNote, line.remarks];
}

function LogSheetsLine(row: LogLineRow & { engineHours?: Record<string, number> }): LogLine {
  const { sheet_id, sort_order, position_name, weather_remark, temperature_unit, log_nm, wind_direction, wind_strength, wind_unit, sea_unit, tide_unit, compass_course, magnetic_course, true_course, wind_drift, course_through_water, current_drift, course_over_ground, speed_kn, sail_miles, sail_note, motor_miles, motor_hours, motor_note, ...rest } = row;
  return { ...rest, position: position_name, weatherRemark: weather_remark, temperatureUnit: temperature_unit, logNm: Number(log_nm), windDirection: wind_direction, windStrength: Number(wind_strength), windUnit: wind_unit, seaUnit: sea_unit, tideUnit: tide_unit, compassCourse: Number(compass_course), magneticCourse: Number(magnetic_course), trueCourse: Number(true_course), windDrift: Number(wind_drift), courseThroughWater: Number(course_through_water), currentDrift: Number(current_drift), courseOverGround: Number(course_over_ground), speedKn: Number(speed_kn), sailMiles: Number(sail_miles), sailNote: sail_note, motorMiles: Number(motor_miles), motorHours: Number(motor_hours), motorNote: motor_note } as LogLine;
}

type EngineHoursRow = { sheet_id: string; line_sort_order: number; engine_id: string; runtime_hours: number; boat_id: string };

function attachEngineHours(rows: LogLineRow[], hours: EngineHoursRow[]) {
  return rows.map((row) => {
    const engineHours = Object.fromEntries(hours.filter((item) => item.sheet_id === row.sheet_id && Number(item.line_sort_order) === Number(row.sort_order)).map((item) => [item.engine_id.slice(item.boat_id.length + 1), Number(item.runtime_hours)]));
    return Object.keys(engineHours).length ? { ...row, engineHours } : row;
  });
}
