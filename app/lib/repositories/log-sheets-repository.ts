import type { Boat, BoatRow, CrewMemberRow, LogLineRow, LogSheet, LogSheetRow, PersistedLogbook, StoredLogSheet } from "../../models/logbook";
import type { QueryableDatabase } from "../db/logbook-database";
import { scopedId, unscopedId } from "./boats-repository";

export class LogSheetsRepository {
  constructor(private db: QueryableDatabase) {}

  async findAll(ownerId = "legacy-user") {
    return (await this.db.query<LogSheetRow>(`select * from log_sheets where owner_id = ${this.db.placeholder(1)} order by date_range desc, title`, [ownerId])).rows;
  }

  async deleteAll(ownerId = "legacy-user") {
    await this.db.query(`delete from log_sheets where owner_id = ${this.db.placeholder(1)}`, [ownerId]);
  }

  async insert(sheet: LogSheet) {
    const ownerId = (this.db as { ownerId?: string }).ownerId ?? "legacy-user";
    await this.db.query(
      `insert into log_sheets (id, title, date_range, status, boat_id, skipper, route, weather_briefing, day_summary, remarks, watch_plan, technical_checks, owner_id) values (${this.values(13)})`,
      [scopedId(ownerId, sheet.id), sheet.title, sheet.dateRange, sheet.status, scopedId(ownerId, sheet.boatId), JSON.stringify(sheet.skipper), JSON.stringify(sheet.route), JSON.stringify(sheet.weatherBriefing), JSON.stringify(sheet.daySummary), JSON.stringify(sheet.remarks), JSON.stringify(sheet.watchPlan), JSON.stringify(sheet.technicalChecks), ownerId],
    );
  }

  static toLogbook(boatRows: BoatRow[], sheetRows: LogSheetRow[], crewRows: CrewMemberRow[], lineRows: LogLineRow[]): PersistedLogbook {
    const crewBySheet = groupBy(crewRows, (crew) => crew.sheet_id);
    const linesBySheet = groupBy(lineRows, (line) => line.sheet_id);
    const boats: Boat[] = boatRows.map((boat) => ({
      id: unscopedId(boat.id),
      name: boat.name,
      type: boat.type,
      registration: boat.registration,
      flagState: boat.flag_state,
      homePort: boat.home_port,
      owner: boat.owner,
      dimensions: boat.dimensions,
      yachtData: parseJson<Record<string, string>>(boat.yacht_data),
    }));
    const sheets: LogSheet[] = sheetRows.map((sheet) => ({
      ...mapStoredSheet(sheet),
      crew: (crewBySheet.get(sheet.id) ?? []).map(({ sheet_id, crew_member_id, sort_order, ...crew }) => crew),
      lines: (linesBySheet.get(sheet.id) ?? []).map(({ sheet_id, sort_order, log_nm, magnetic_course, sea_state, ...line }) => ({
        ...line,
        logNm: log_nm,
        magneticCourse: magnetic_course,
        seaState: sea_state,
      })),
    }));
    return { boats, sheets };
  }

  private values(count: number) {
    return Array.from({ length: count }, (_, index) => this.db.placeholder(index + 1)).join(", ");
  }
}

function parseJson<T>(value: unknown): T {
  return typeof value === "string" ? JSON.parse(value) as T : value as T;
}

function groupBy<T>(items: T[], keyFor: (item: T) => string) {
  return items.reduce((groups, item) => {
    const key = keyFor(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
    return groups;
  }, new Map<string, T[]>());
}

function mapStoredSheet(sheet: LogSheetRow): StoredLogSheet {
  return {
    id: unscopedId(sheet.id),
    title: sheet.title,
    dateRange: sheet.date_range,
    status: sheet.status,
    boatId: unscopedId(sheet.boat_id),
    skipper: parseJson<LogSheet["skipper"]>(sheet.skipper),
    route: parseJson<LogSheet["route"]>(sheet.route),
    weatherBriefing: parseJson<LogSheet["weatherBriefing"]>(sheet.weather_briefing),
    daySummary: parseJson<LogSheet["daySummary"]>(sheet.day_summary),
    remarks: parseJson<string[]>(sheet.remarks),
    watchPlan: parseJson<string[]>(sheet.watch_plan),
    technicalChecks: parseJson<string[]>(sheet.technical_checks),
  };
}
