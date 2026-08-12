import type { PersistedLogbook } from "../../models/logbook";
import { StoredImageValidationError, validateStoredImage } from "./stored-image";

export const LOGBOOK_LIMITS = {
  requestBytes: 8 * 1024 * 1024,
  boats: 100,
  crewMembers: 500,
  sheets: 1000,
  enginesPerBoat: 20,
  logLines: 50_000,
  string: 10_000,
  aggregateString: 2 * 1024 * 1024,
} as const;

export class LogbookValidationError extends Error {
  constructor(message: string, readonly kind: "structure" | "limit" = "structure") { super(message); }
}

export function requireRevision(value: unknown) {
  const revision = value && typeof value === "object" && !Array.isArray(value) ? (value as { revision?: unknown }).revision : undefined;
  if (!Number.isSafeInteger(revision) || Number(revision) <= 0) {
    throw Object.assign(new LogbookValidationError("revision must be a positive integer."), { code: "invalid_revision" });
  }
}

const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const string = (v: unknown) => typeof v === "string";
const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const boolean = (v: unknown) => typeof v === "boolean";
const optional = (v: unknown, check: (x: unknown) => boolean) => v === undefined || check(v);
const strings = (v: unknown) => Array.isArray(v) && v.every(string);
const stringRecord = (v: unknown) => record(v) && Object.entries(v).every(([k, x]) => string(k) && string(x));
const numberRecord = (v: unknown) => record(v) && Object.entries(v).every(([k, x]) => string(k) && finite(x));
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw new LogbookValidationError(message); }
function count(array: unknown, max: number, name: string): asserts array is unknown[] {
  assert(Array.isArray(array), `${name} must be an array.`);
  if (array.length > max) throw new LogbookValidationError(`Too many ${name}.`, "limit");
}
function image(value: unknown, path: string) { if (value === undefined) return; try { validateStoredImage(value); } catch (e) { throw new LogbookValidationError(`${path}: ${e instanceof StoredImageValidationError ? e.message : "Invalid image."}`, e instanceof StoredImageValidationError && e.message.includes("byte limit") ? "limit" : "structure"); } }

const crewFields = (v: Record<string, unknown>) => string(v.id) && string(v.name) && string(v.nationality) && string(v.role)
  && ["address", "certificate", "dateOfBirth", "placeOfBirth", "gender", "identityDocumentType", "identityDocumentNumber", "identityDocumentIssuingDate", "identityDocumentExpiryDate"].every(k => optional(v[k], string))
  && optional(v.isPrimary, boolean);

function validateCrew(v: unknown, path: string, sheet = false) {
  assert(record(v) && crewFields(v), `${path} is malformed.`);
  if (sheet) assert(["embarkationDateTime", "embarkationPosition", "disembarkationDateTime", "disembarkationPosition"].every(k => string(v[k])), `${path} assignment is malformed.`);
  image(v.image, `${path}.image`);
  assert(optional(v.imageId, string), `${path}.imageId must be a string.`);
}

const lineStringFields = ["time", "position", "weather", "weatherRemark", "temperatureUnit", "windDirection", "windUnit", "seaUnit", "tideUnit", "moon", "sailNote", "motorNote", "remarks"];
const lineNumberFields = ["latitude", "longitude", "temperature", "barometer", "windStrength", "waves", "tide", "compassCourse", "deviation", "magneticCourse", "variation", "trueCourse", "windDrift", "courseThroughWater", "currentDrift", "courseOverGround", "speedKn", "logNm", "sailMiles", "motorMiles", "motorHours"];
export function validateLine(v: unknown, path = "line") {
  assert(record(v) && lineStringFields.every(k => string(v[k])) && lineNumberFields.every(k => finite(v[k])) && optional(v.engineHours, numberRecord), `${path} is malformed.`);
}

export function validatePersistedLogbook(value: unknown): PersistedLogbook {
  assert(record(value), "Logbook must be an object.");
  count(value.boats, LOGBOOK_LIMITS.boats, "boats"); count(value.crewMembers, LOGBOOK_LIMITS.crewMembers, "crew members"); count(value.sheets, LOGBOOK_LIMITS.sheets, "sheets");
  value.boats.forEach((boat, i) => {
    assert(record(boat) && ["id", "name", "registration", "flagState", "homePort", "owner", "dimensions"].every(k => string(boat[k])) && ["Sail", "Motor"].includes(boat.type as string) && finite(boat.logfactor) && stringRecord(boat.yachtData) && Array.isArray(boat.deviationTable) && optional(boat.archived, boolean), `boats[${i}] is malformed.`);
    assert(boat.deviationTable.every(row => record(row) && finite(row.heading) && string(row.deviation)), `boats[${i}].deviationTable is malformed.`);
    count(boat.engines ?? [], LOGBOOK_LIMITS.enginesPerBoat, "engines");
    (boat.engines as unknown[] | undefined)?.forEach((engine, j) => assert(record(engine) && ["id", "name", "label"].every(k => string(engine[k])) && ["propulsion", "generator", "auxiliary"].includes(engine.role as string) && optional(engine.archived, boolean) && ["manufacturer", "model", "serialNumber"].every(k => optional(engine[k], string)), `boats[${i}].engines[${j}] is malformed.`));
    if (boat.windDriftTable !== undefined) assert(record(boat.windDriftTable) && stringRecord(boat.windDriftTable.windSpeedLimits) && Array.isArray(boat.windDriftTable.rows) && boat.windDriftTable.rows.every(row => record(row) && ["closeHauled", "beamReach", "broadReach"].includes(row.angle as string) && stringRecord(row.values)), `boats[${i}].windDriftTable is malformed.`);
    image(boat.image, `boats[${i}].image`);
    assert(optional(boat.imageId, string), `boats[${i}].imageId must be a string.`);
  });
  value.crewMembers.forEach((crew, i) => validateCrew(crew, `crewMembers[${i}]`));
  let totalLines = 0, totalSheetCrew = 0;
  value.sheets.forEach((sheet, i) => {
    assert(record(sheet) && ["id", "title", "boatId"].every(k => string(sheet[k])) && ["Draft", "Locked"].includes(sheet.status as string) && record(sheet.route) && ["from", "to", "departed", "arrived"].every(k => string((sheet.route as Record<string, unknown>)[k])) && Array.isArray(sheet.crew) && strings(sheet.watchPlan) && Array.isArray(sheet.technicalChecks) && Array.isArray(sheet.lines), `sheets[${i}] is malformed.`);
    sheet.crew.forEach((crew, j) => validateCrew(crew, `sheets[${i}].crew[${j}]`, true));
    totalSheetCrew += sheet.crew.length;
    if (totalSheetCrew > LOGBOOK_LIMITS.crewMembers) throw new LogbookValidationError("Too many crew members.", "limit");
    assert(sheet.technicalChecks.every(check => record(check) && string(check.status) && string(check.text)), `sheets[${i}].technicalChecks is malformed.`);
    sheet.lines.forEach((line, j) => validateLine(line, `sheets[${i}].lines[${j}]`)); totalLines += sheet.lines.length;
    if (totalLines > LOGBOOK_LIMITS.logLines) throw new LogbookValidationError("Too many log lines.", "limit");
    if (sheet.share !== undefined) assert(record(sheet.share) && ["masterData", "picture", "logLines", "metrics", "technicalLog", "skipper", "crew"].every(k => ["private", "registered", "public"].includes((sheet.share as Record<string, unknown>)[k] as string)), `sheets[${i}].share is malformed.`);
    if (sheet.metrics !== undefined) assert(record(sheet.metrics) && Object.entries(sheet.metrics).every(([, x]) => x === null || finite(x) || numberRecord(x)), `sheets[${i}].metrics is malformed.`);
    assert(optional(sheet.source, x => x === "manual" || x === "scanner") && optional(sheet.verificationNote, string) && optional(sheet.scannerWarnings, strings), `sheets[${i}] optional values are malformed.`);
    image(sheet.image, `sheets[${i}].image`);
    assert(optional(sheet.imageId, string), `sheets[${i}].imageId must be a string.`);
  });
  let aggregate = 0;
  const walk = (v: unknown): void => { if (typeof v === "string") { if (v.length > LOGBOOK_LIMITS.string) throw new LogbookValidationError("A string exceeds the length limit.", "limit"); aggregate += v.length; } else if (Array.isArray(v)) v.forEach(walk); else if (record(v)) Object.entries(v).forEach(([k, x]) => { walk(k); walk(x); }); };
  walk(value);
  if (aggregate > LOGBOOK_LIMITS.aggregateString) throw new LogbookValidationError("Aggregate string data exceeds the length limit.", "limit");
  return value as PersistedLogbook;
}
