import type { QueryableDatabase } from "./logbook-database";

type RouteRow = { id: string; route: unknown };
type TimedRow = { sheet_id: string; sort_order: number; time: string };
type CrewAssignmentRow = { sheet_id: string; crew_member_id: string; sort_order: number; embarkation_datetime: string; disembarkation_datetime: string };
type LegacyBoatEngineRow = { boat_id: string; yacht_data: unknown; engine_id: string; model: string };
import { readMigrations } from "./schema";

export async function runMigrations(db: QueryableDatabase) {
  await db.query(`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at text not null default current_timestamp
    )
  `);

  const appliedRows = await db.query<{ id: string }>("select id from schema_migrations order by id");
  const applied = new Set(appliedRows.rows.map((row) => row.id));

  for (const migration of await readMigrations()) {
    if (applied.has(migration.id)) continue;
    await applyMigration(db, migration.id, migration.sql);
    await db.query(`insert into schema_migrations (id) values (${db.placeholder(1)})`, [migration.id]);
  }
}

async function applyMigration(db: QueryableDatabase, id: string, sql: string) {
  if (id === "021_iso_datetime_offsets") {
    await normalizeStoredDateTimes(db);
    return;
  }

  if (id === "030_move_legacy_boat_engine") {
    await moveLegacyBoatEngine(db);
    return;
  }

  if (id !== "009_log_line_column_types") {
    await db.query(sql);
    return;
  }

  for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
    try {
      await db.query(statement);
    } catch (error) {
      if (!isDuplicateColumnError(error)) throw error;
    }
  }
}

async function moveLegacyBoatEngine(db: QueryableDatabase) {
  const rows = await db.query<LegacyBoatEngineRow>(`
    select boats.id as boat_id, boats.yacht_data, engines.id as engine_id, engines.model
    from boats
    join engines on engines.boat_id = boats.id
    where engines.sort_order = 0
  `);

  for (const row of rows.rows) {
    const yachtData = parseYachtData(row.yacht_data);
    const legacyEngine = typeof yachtData.Engine === "string" ? yachtData.Engine.trim() : "";
    delete yachtData.Engine;
    if (legacyEngine && legacyEngine !== "—" && !row.model.trim()) {
      await db.query(`update engines set model = ${db.placeholder(1)} where id = ${db.placeholder(2)}`, [legacyEngine, row.engine_id]);
    }
    await db.query(`update boats set yacht_data = ${db.placeholder(1)} where id = ${db.placeholder(2)}`, [JSON.stringify(yachtData), row.boat_id]);
  }
}

function parseYachtData(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return { ...value as Record<string, unknown> };
  if (typeof value !== "string") return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function isDuplicateColumnError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate column|already exists|column .* exists/i.test(message);
}


async function normalizeStoredDateTimes(db: QueryableDatabase) {
  const sheetRows = await db.query<RouteRow>("select id, route from log_sheets");
  for (const row of sheetRows.rows) {
    const route = parseRoute(row.route);
    const nextRoute = {
      ...route,
      departed: normalizeDateTimeStamp(route.departed),
      arrived: normalizeDateTimeStamp(route.arrived),
    };
    if (nextRoute.departed === route.departed && nextRoute.arrived === route.arrived) continue;
    await db.query(`update log_sheets set route = ${db.placeholder(1)} where id = ${db.placeholder(2)}`, [JSON.stringify(nextRoute), row.id]);
  }

  const lineRows = await db.query<TimedRow>("select sheet_id, sort_order, time from log_lines");
  for (const row of lineRows.rows) {
    const normalized = normalizeDateTimeStamp(row.time);
    if (normalized === row.time) continue;
    await db.query(`update log_lines set time = ${db.placeholder(1)} where sheet_id = ${db.placeholder(2)} and sort_order = ${db.placeholder(3)}`, [normalized, row.sheet_id, row.sort_order]);
  }

  const crewRows = await db.query<CrewAssignmentRow>("select sheet_id, crew_member_id, sort_order, embarkation_datetime, disembarkation_datetime from sheet_crew_members");
  for (const row of crewRows.rows) {
    const embarkation = normalizeDateTimeStamp(row.embarkation_datetime);
    const disembarkation = normalizeDateTimeStamp(row.disembarkation_datetime);
    if (embarkation === row.embarkation_datetime && disembarkation === row.disembarkation_datetime) continue;
    await db.query(`update sheet_crew_members set embarkation_datetime = ${db.placeholder(1)}, disembarkation_datetime = ${db.placeholder(2)} where sheet_id = ${db.placeholder(3)} and crew_member_id = ${db.placeholder(4)} and sort_order = ${db.placeholder(5)}`, [embarkation, disembarkation, row.sheet_id, row.crew_member_id, row.sort_order]);
  }
}

function parseRoute(value: unknown) {
  if (typeof value !== "string") return { from: "", to: "", departed: "", arrived: "" };
  try {
    const parsed = JSON.parse(value) as Partial<Record<"from" | "to" | "departed" | "arrived", unknown>>;
    return {
      from: typeof parsed.from === "string" ? parsed.from : "",
      to: typeof parsed.to === "string" ? parsed.to : "",
      departed: typeof parsed.departed === "string" ? parsed.departed : "",
      arrived: typeof parsed.arrived === "string" ? parsed.arrived : "",
    };
  } catch {
    return { from: "", to: "", departed: "", arrived: "" };
  }
}

function normalizeDateTimeStamp(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /(?:Z|[+-]\d{2}:\d{2})$/.test(trimmed)) return trimmed;

  const isoDateTime = trimmed.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?/);
  if (isoDateTime) return `${isoDateTime[1]}T${isoDateTime[2]}:00+00:00`;

  const routeStamp = trimmed.match(/^(\d{4}-\d{2}-\d{2}),\s*(\d{2}:\d{2})/);
  if (routeStamp) return `${routeStamp[1]}T${routeStamp[2]}:00+00:00`;

  const dateOnly = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dateOnly) return `${dateOnly[1]}T00:00:00+00:00`;

  return trimmed;
}
