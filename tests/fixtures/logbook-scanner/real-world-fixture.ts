import { readFileSync } from "node:fs";
import path from "node:path";

export type FixtureLine = Record<string, string | number | null | undefined>;

// Explicit allowlist: persistence IDs, sharing, warning history and audit data never become OCR expectations.
const lineColumns = {
  time: "time", latitude: "latitude", longitude: "longitude",
  weather: "weather", weather_remark: "weatherRemark", temperature: "temperature", temperature_unit: "temperatureUnit",
  barometer: "barometer", wind_direction: "windDirection", wind_strength: "windStrength", wind_unit: "windUnit",
  waves: "waves", tide: "tide", moon: "moon", compass_course: "compassCourse", deviation: "deviation",
  magnetic_course: "magneticCourse", variation: "variation", true_course: "trueCourse", wind_drift: "windDrift",
  course_through_water: "courseThroughWater", current_drift: "currentDrift", course_over_ground: "courseOverGround",
  speed_kn: "speedKn", log_nm: "logNm", sail_miles: "sailMiles", motor_miles: "motorMiles",
} as const;
const textFields = new Set(["time", "weather", "weatherRemark", "temperatureUnit", "windDirection", "windUnit", "moon"]);

export function loadRealWorldFixture(directory: string, base: string) {
  const read = (suffix: string) => JSON.parse(readFileSync(path.join(directory, `${base}_${suffix}.json`), "utf8"));
  const sheets = read("log_sheet") as Array<{ id: string; title: string; route: string }>;
  const rows = read("log_lines") as Array<Record<string, unknown> & { sheet_id: string; sort_order: number }>;
  const overrides = read("source_overrides") as { allRows: FixtureLine; rows: FixtureLine[] };
  if (sheets.length !== 1 || !rows.length || rows.some(row => row.sheet_id !== sheets[0].id)) throw new Error(`Mismatched exported sheet: ${base}`);
  rows.sort((a, b) => a.sort_order - b.sort_order);
  if (rows.some((row, index) => row.sort_order !== index) || overrides.rows.length !== rows.length) throw new Error(`Mismatched exported row order: ${base}`);
  const lines = rows.map((row, index) => {
    const line: FixtureLine = Object.fromEntries(Object.entries(lineColumns).map(([column, field]) => {
      const value = row[column];
      if (field === "time") return [field, String(value).slice(11, 16)];
      if (textFields.has(field)) return [field, value == null ? "" : String(value)];
      const number = value == null || value === "" ? null : Number(value);
      if (number !== null && !Number.isFinite(number)) throw new Error(`Invalid ${column} in ${base}`);
      return [field, number];
    }));
    return { ...line, ...overrides.allRows, ...overrides.rows[index] };
  });
  return { title: sheets[0].title, dateText: base.slice(0, 10), route: JSON.parse(sheets[0].route) as { from: string; to: string; departed: string; arrived: string }, lines };
}
