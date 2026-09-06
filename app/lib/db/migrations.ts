import type { QueryableDatabase } from "./logbook-database";
import { normalizeIsoDate } from "../iso-date";
import { countryCodeForFlagValue } from "../flags";
import { randomUUID } from "node:crypto";
import type { ScannerWarning } from "../../models/logbook";
import { normalizeScannerWarning } from "../logbook-scanner/normalize-warning";
import { DEFAULT_TECHNICAL_CHECK_STATUS, TECHNICAL_CHECK_STATUSES } from "../../domain/logbook/technical-log";
import { defaultWindDriftTable, type WindDriftTable } from "../../models/boat";

type RouteRow = { id: string; route: unknown };
type TimedRow = { sheet_id: string; sort_order: number; time: string };
type CrewAssignmentRow = { sheet_id: string; crew_member_id: string; sort_order: number; embarkation_datetime: string; disembarkation_datetime: string };
type LegacyLogSheetDateRow = { id: string; date_range: string; route: unknown };
type LegacyBoatEngineRow = { boat_id: string; yacht_data: unknown; engine_id: string; model: string };
type LegacyBoatFlagRow = { id: string; flag_state: string };
type ScannerWarningsRow = { id: string; scanner_warnings: unknown };
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
  if (id === "043_structure_scanner_warnings" || id === "044_localize_scanner_warnings") {
    await structureScannerWarnings(db);
    return;
  }
  if (id === "045_remove_legacy_storage_formats") {
    await normalizeLegacyStorageFormats(db);
    return;
  }
  if (id === "040_normalize_boat_flag_state") {
    await normalizeBoatFlagStates(db);
    return;
  }
  if (id === "037_resource_concurrency") {
    await addResourceConcurrencyColumns(db);
    return;
  }
  if (id === "021_iso_datetime_offsets") {
    await normalizeStoredDateTimes(db);
    return;
  }

  if (id === "030_move_legacy_boat_engine") {
    await moveLegacyBoatEngine(db);
    return;
  }

  if (id === "031_remove_log_sheet_date_range") {
    await removeLegacyLogSheetDateRange(db);
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

type LegacyStorageBoatRow = { id: string; wind_drift_table: unknown };
type LegacyStorageSheetRow = { id: string; technical_checks: unknown; share_privacy: string; share_master_data: unknown; share_picture: unknown; share_loglines: unknown; share_metrics: unknown; share_technical_log: unknown; share_skipper: unknown; share_crew: unknown };

/** Permanently resolves the last columns that admitted more than one storage shape. */
export async function normalizeLegacyStorageFormats(db: QueryableDatabase) {
  const postgres = db.placeholder(1) === "$1";
  const boats = await db.query<LegacyStorageBoatRow>("select id, wind_drift_table from boats");
  for (const boat of boats.rows) {
    const parsed = parseStoredJson(boat.wind_drift_table, `Boat ${boat.id} has malformed wind drift data.`);
    const normalized = strictWindDriftTable(parsed, boat.id);
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      await db.query(`update boats set wind_drift_table = ${db.placeholder(1)} where id = ${db.placeholder(2)}`, [JSON.stringify(normalized), boat.id]);
    }
  }

  const shareColumns = ["share_master_data", "share_picture", "share_loglines", "share_metrics", "share_technical_log", "share_skipper", "share_crew"] as const;
  const sheets = await db.query<LegacyStorageSheetRow>(`select id, technical_checks, share_privacy, ${shareColumns.join(", ")} from log_sheets`);
  for (const sheet of sheets.rows) {
    const checks = parseStoredJson(sheet.technical_checks, `Log sheet ${sheet.id} has malformed technical checks.`);
    if (!Array.isArray(checks)) throw new Error(`Log sheet ${sheet.id} has malformed technical checks.`);
    const normalizedChecks = checks.map((check) => {
      if (typeof check === "string" && check.trim()) return { status: DEFAULT_TECHNICAL_CHECK_STATUS, text: check.trim() };
      if (check && typeof check === "object" && !Array.isArray(check) && typeof (check as { status?: unknown }).status === "string" && (TECHNICAL_CHECK_STATUSES as readonly string[]).includes((check as { status: string }).status) && typeof (check as { text?: unknown }).text === "string" && (check as { text: string }).text.trim()) return check;
      throw new Error(`Log sheet ${sheet.id} has malformed technical checks.`);
    });
    const assignments: string[] = [];
    const values: unknown[] = [];
    if (JSON.stringify(checks) !== JSON.stringify(normalizedChecks)) {
      values.push(JSON.stringify(normalizedChecks)); assignments.push(`technical_checks = ${db.placeholder(values.length)}`);
    }
    for (const column of shareColumns) {
      if (!postgres) {
        const privacy = strictPrivacy(sheet[column], sheet.share_privacy);
        if (sheet[column] !== privacy) { values.push(privacy); assignments.push(`${column} = ${db.placeholder(values.length)}`); }
      }
    }
    if (assignments.length) { values.push(sheet.id); await db.query(`update log_sheets set ${assignments.join(", ")} where id = ${db.placeholder(values.length)}`, values); }
  }

  if (postgres) {
    for (const column of shareColumns) {
      await db.query(`alter table log_sheets alter column ${column} drop default`);
      await db.query(`alter table log_sheets alter column ${column} type text using (case when ${column}::text = '2' then 'registered' when ${column}::text = '1' then case when share_privacy = 'registered' then 'registered' else 'public' end when ${column}::text in ('public', 'registered', 'private') then ${column}::text else 'private' end)`);
      await db.query(`alter table log_sheets alter column ${column} set default 'private'`);
      await db.query(`alter table log_sheets add constraint log_sheets_${column}_privacy check (${column} in ('private', 'registered', 'public'))`);
    }
  }
}

function parseStoredJson(value: unknown, message: string): unknown {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { throw new Error(message); }
}

function strictPrivacy(value: unknown, formerOverallPrivacy: string) {
  if (value === "private" || value === "registered" || value === "public") return value;
  if (value === 2 || value === "2") return "registered";
  if (value === 1 || value === "1" || value === true) return formerOverallPrivacy === "registered" ? "registered" : "public";
  if (value === 0 || value === "0" || value === false) return "private";
  throw new Error(`Unsupported log-sheet sharing value: ${String(value)}.`);
}

function strictWindDriftTable(value: unknown, boatId: string): WindDriftTable {
  const fallback = defaultWindDriftTable();
  const candidate = Array.isArray(value) ? { windSpeedLimits: fallback.windSpeedLimits, rows: value } : value;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error(`Boat ${boatId} has malformed wind drift data.`);
  const table = candidate as Partial<WindDriftTable>;
  if (!table.windSpeedLimits || !Array.isArray(table.rows)) throw new Error(`Boat ${boatId} has malformed wind drift data.`);
  return table as WindDriftTable;
}

export async function structureScannerWarnings(db: QueryableDatabase) {
  const rows = await db.query<ScannerWarningsRow>("select id, scanner_warnings from log_sheets where scanner_warnings is not null");
  for (const row of rows.rows) {
    const warnings = parseScannerWarnings(row.scanner_warnings, row.id);
    if (!warnings.changed) continue;
    await db.query(`update log_sheets set scanner_warnings = ${db.placeholder(1)} where id = ${db.placeholder(2)}`, [JSON.stringify(warnings.value), row.id]);
  }
}

function parseScannerWarnings(value: unknown, sheetId: string): { value: ScannerWarning[]; changed: boolean } {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { throw new Error(`Log sheet ${sheetId} has malformed scanner warnings.`); }
  }
  if (!Array.isArray(parsed)) throw new Error(`Log sheet ${sheetId} has malformed scanner warnings.`);

  const seenIds = new Set<string>();
  const warnings = parsed.map((warning): ScannerWarning => {
    const normalized = normalizeScannerWarning(warning);
    if (!normalized) throw new Error(`Log sheet ${sheetId} has malformed scanner warnings.`);
    if (normalized.id.trim().length === 0 || seenIds.has(normalized.id)) {
      do normalized.id = randomUUID(); while (seenIds.has(normalized.id));
    }
    seenIds.add(normalized.id);
    return normalized;
  });
  return { value: warnings, changed: JSON.stringify(warnings) !== JSON.stringify(parsed) };
}

export async function normalizeBoatFlagStates(db: QueryableDatabase) {
  const rows = await db.query<LegacyBoatFlagRow>("select id, flag_state from boats");
  for (const row of rows.rows) {
    const countryCode = countryCodeForFlagValue(row.flag_state);
    if (countryCode === row.flag_state) continue;
    await db.query(`update boats set flag_state = ${db.placeholder(1)} where id = ${db.placeholder(2)}`, [countryCode, row.id]);
  }

  if (db.placeholder(1) === "$1") {
    await db.query("alter table boats alter column flag_state type varchar(2)");
    await db.query("alter table boats add constraint boats_flag_state_iso_code check (flag_state = '' or (char_length(flag_state) = 2 and flag_state = upper(flag_state)))");
  }
}

async function addResourceConcurrencyColumns(db: QueryableDatabase) {
  const postgres = db.placeholder(1) === "$1";
  const timestampType = postgres ? "timestamptz" : "text";
  const now = postgres ? "current_timestamp" : "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
  const captured = (await db.query<{ now: string }>(`select ${now} as now`)).rows[0]?.now ?? "1970-01-01T00:00:00.000Z";
  for (const table of ["boats", "crew_members", "log_sheets", "log_lines"]) {
    await db.query(`alter table ${table} add column revision integer not null default 1`);
    const sqliteDefault = `'${String(captured).replaceAll("'", "''")}'`;
    await db.query(`alter table ${table} add column created_at ${timestampType}${postgres ? "" : ` not null default ${sqliteDefault}`}`);
    await db.query(`alter table ${table} add column updated_at ${timestampType}${postgres ? "" : ` not null default ${sqliteDefault}`}`);
    await db.query(`update ${table} set created_at = ${db.placeholder(1)}, updated_at = ${db.placeholder(2)} where created_at is null or updated_at is null`, [captured, captured]);
    if (postgres) await db.query(`alter table ${table} alter column created_at set default current_timestamp, alter column created_at set not null, alter column updated_at set default current_timestamp, alter column updated_at set not null`);
    else {
      await db.query(`create trigger ${table}_concurrency_insert after insert on ${table} begin update ${table} set created_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') where rowid = new.rowid; end`);
      await db.query(`create trigger ${table}_concurrency_update after update on ${table} when new.updated_at = old.updated_at begin update ${table} set updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') where rowid = new.rowid; end`);
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

export async function removeLegacyLogSheetDateRange(db: QueryableDatabase) {
  const result = await db.query<LegacyLogSheetDateRow>("select id, date_range, route from log_sheets");
  for (const row of result.rows) {
    const route = parseRoute(row.route);
    const date = normalizeIsoDate(row.date_range);
    if (!date && (!route.departed || !route.arrived)) throw new Error(`Log sheet ${row.id} has no date that can be migrated to its route.`);
    const nextRoute = {
      ...route,
      departed: route.departed || `${date}T00:00:00+00:00`,
      arrived: route.arrived || `${date}T00:00:00+00:00`,
    };
    if (nextRoute.departed !== route.departed || nextRoute.arrived !== route.arrived) {
      await db.query(`update log_sheets set route = ${db.placeholder(1)} where id = ${db.placeholder(2)}`, [JSON.stringify(nextRoute), row.id]);
    }
  }
  await db.query("alter table log_sheets drop column date_range");
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
