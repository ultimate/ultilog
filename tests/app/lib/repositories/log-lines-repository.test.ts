import { describe, expect, it } from "vitest";
import { sampleLogSheets } from "../../../../resources/sample-data/logbook";
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

    await expect(new LogLinesRepository(db).findAll()).resolves.toEqual([row]);
    expect(db.calls[0].sql).toContain("from log_lines join log_sheets");
    expect(db.calls[0].sql).toContain("where log_sheets.owner_id = $1");
    expect(db.calls[0].values).toEqual(["legacy-user"]);
  });

  it("deletes all log line rows", async () => {
    const db = new MockDatabase();

    await new LogLinesRepository(db).deleteAll();
    expect(db.calls).toEqual([{ sql: "delete from log_lines where sheet_id in (select id from log_sheets where owner_id = $1)", values: ["legacy-user"] }]);
  });

  it("inserts a log line", async () => {
    const db = new MockDatabase();

    await new LogLinesRepository(db).insert(sheet.id, 0, line);

    expect(db.calls[0].sql).toContain("insert into log_lines");
    expect(db.calls[0].values).toEqual([`legacy-user:${sheet.id}`, 0, line.time, line.position, line.latitude, line.longitude, line.logNm, line.compassCourse, line.waves, line.barometer, line.weather, line.weatherRemark, line.temperature, line.sailNote, line.motorNote, line.windDirection, line.windStrength, line.windUnit, line.seaUnit, line.tide, line.tideUnit, line.moon, line.deviation, line.magneticCourse, line.variation, line.trueCourse, line.windDrift, line.courseThroughWater, line.currentDrift, line.courseOverGround, line.speedKn, line.sailSm, line.sailNote, line.motorSm, line.motorHours, line.motorNote, line.remarks]);
  });
});

function logLineRow(): LogLineRow {
  const { position, weatherRemark, logNm, windDirection, windStrength, windUnit, waves, seaUnit, tideUnit, compassCourse, magneticCourse, trueCourse, windDrift, courseThroughWater, currentDrift, courseOverGround, speedKn, sailSm, sailNote, motorSm, motorHours, motorNote, ...rest } = line;
  return { ...rest, sheet_id: sheet.id, sort_order: 0, position_name: position, weather_remark: weatherRemark, log_nm: logNm, wind_direction: windDirection, wind_strength: windStrength, wind_unit: windUnit, waves, sea_unit: seaUnit, tide_unit: tideUnit, compass_course: compassCourse, magnetic_course: magneticCourse, true_course: trueCourse, wind_drift: windDrift, course_through_water: courseThroughWater, current_drift: currentDrift, course_over_ground: courseOverGround, speed_kn: speedKn, sail_sm: sailSm, sail_note: sailNote, motor_sm: motorSm, motor_hours: motorHours, motor_note: motorNote };
}
