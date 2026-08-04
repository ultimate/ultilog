import { describe, expect, it } from "vitest";
import { sampleLogSheets } from "../../../fixtures/logbook";
import type { LogLineRow } from "../../../../app/models/logbook";
import type { QueryableDatabase, QueryResult } from "../../../../app/lib/db/logbook-database";
import { LogLinesRepository } from "../../../../app/lib/repositories/log-lines-repository";

type QueryCall = { sql: string; values?: unknown[] };

class MockDatabase implements QueryableDatabase {
  calls: QueryCall[] = [];

  constructor(private resultRows: Record<string, unknown[]> = {}) {}

  placeholder(index: number) {
    return `$${index}`;
  }

  async query<Row>(sql: string, values?: unknown[]): Promise<QueryResult<Row>> {
    this.calls.push({ sql, values });
    const [key] = Object.keys(this.resultRows).filter((candidate) => sql.includes(candidate));
    return { rows: (key ? this.resultRows[key] : []) as Row[] };
  }
}

const sheet = sampleLogSheets[0];
const line = sheet.lines[0];

describe("LogLinesRepository", () => {
  it("finds all log line rows", async () => {
    const row: LogLineRow = logLineRow();
    const db = new MockDatabase({ log_lines: [row] });

    await expect(new LogLinesRepository(db).findAll("repository-user")).resolves.toEqual([row]);
    expect(db.calls[0].sql).toContain("from log_lines join log_sheets");
    expect(db.calls[0].sql).toContain("where log_sheets.owner_id = $1");
    expect(db.calls[0].values).toEqual(["repository-user"]);
  });

  it("deletes all log line rows", async () => {
    const db = new MockDatabase();

    await new LogLinesRepository(db).deleteAll("repository-user");
    expect(db.calls).toEqual([{ sql: "delete from log_lines where sheet_id in (select id from log_sheets where owner_id = $1)", values: ["repository-user"] }]);
  });

  it("inserts a log line", async () => {
    const db = new MockDatabase();

    await new LogLinesRepository(db).insert(sheet.id, 0, line, "repository-user");

    expect(db.calls[0].sql).toContain("insert into log_lines");
    expect(db.calls[0].values).toEqual([`repository-user:${sheet.id}`, 0, line.time, line.position, line.latitude, line.longitude, line.logNm, line.compassCourse, line.waves, line.barometer, line.weather, line.weatherRemark, line.temperature, line.temperatureUnit, line.sailNote, line.motorNote, line.windDirection, line.windStrength, line.windUnit, line.seaUnit, line.tide, line.tideUnit, line.moon, line.deviation, line.magneticCourse, line.variation, line.trueCourse, line.windDrift, line.courseThroughWater, line.currentDrift, line.courseOverGround, line.speedKn, line.sailMiles, line.sailNote, line.motorMiles, line.motorHours, line.motorNote, line.remarks]);
  });

  it("inserts multiple log lines with one database round trip", async () => {
    const db = new MockDatabase();
    const secondLine = sheet.lines[1];

    await new LogLinesRepository(db).insertMany([
      { sheetId: sheet.id, sortOrder: 0, line },
      { sheetId: sheet.id, sortOrder: 1, line: secondLine },
    ], "repository-user");

    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].sql).toContain("$38), ($39");
    expect(db.calls[0].values).toHaveLength(76);
    expect(db.calls[0].values?.[38]).toBe(`repository-user:${sheet.id}`);
  });
});

function logLineRow(): LogLineRow {
  const { position, weatherRemark, temperatureUnit, logNm, windDirection, windStrength, windUnit, waves, seaUnit, tideUnit, compassCourse, magneticCourse, trueCourse, windDrift, courseThroughWater, currentDrift, courseOverGround, speedKn, sailMiles, sailNote, motorMiles, motorHours, motorNote, ...rest } = line;
  return { ...rest, sheet_id: sheet.id, sort_order: 0, position_name: position, weather_remark: weatherRemark, temperature_unit: temperatureUnit, log_nm: logNm, wind_direction: windDirection, wind_strength: windStrength, wind_unit: windUnit, waves, sea_unit: seaUnit, tide_unit: tideUnit, compass_course: compassCourse, magnetic_course: magneticCourse, true_course: trueCourse, wind_drift: windDrift, course_through_water: courseThroughWater, current_drift: currentDrift, course_over_ground: courseOverGround, speed_kn: speedKn, sail_miles: sailMiles, sail_note: sailNote, motor_miles: motorMiles, motor_hours: motorHours, motor_note: motorNote };
}
