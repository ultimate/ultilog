import { courseFields, type CourseField } from "../../models/course-field-sources";
import { parseDecimalInput } from "../../lib/log-input";
import type { Boat, LineForm, LineFormField } from "../../models/logbook";
import { calculateCourseConversion, type CourseConversionInput, type CourseConversionLookupOptions, type DeviationTable, type WindDriftTable } from "../nautical/course-conversion";
import { normalizeCoordinate, parseCoordinate, type CoordinateAxis } from "../nautical/coordinates";

export type LogLineFormUpdate = {
  field: LineFormField;
  value: string;
};

export type LogLineFormUpdateContext = {
  boat?: Pick<Boat, "deviationTable" | "windDriftTable">;
  variationLookup?: CourseConversionLookupOptions["variationLookup"];
  lookupVariation?: boolean;
};


const coordinateAxes: Partial<Record<LineFormField, CoordinateAxis>> = { latitude: "lat", longitude: "lon" };

export function updateLogLineFormForInput(form: LineForm, update: LogLineFormUpdate, context: LogLineFormUpdateContext = {}) {
  const nextForm = applyLogLineInput(form, update);
  return shouldRecalculateCourses(update.field) ? recalculateLogLineCourses(nextForm, context) : nextForm;
}

/** Apply input and provenance synchronously, before any async lookup starts. */
export function applyLogLineInput(form: LineForm, update: LogLineFormUpdate): LineForm {
  const next = applyFieldUpdate(form, update);
  if (courseFields.includes(update.field as CourseField)) {
    next.courseFieldSources = { ...form.courseFieldSources, [update.field]: update.value.trim() ? "input" : "calculated" };
  }
  return next;
}

/** Compare user edits independently of automatic cache refreshes and object identity. */
export function logLineInputKey(form: LineForm): string {
  const inputs = Object.entries(form).filter(([field]) => field !== "courseFieldSources" && field !== "engineHours" && !(courseFields.includes(field as CourseField) && form.courseFieldSources[field as CourseField] === "calculated"));
  return JSON.stringify([inputs.sort(([left], [right]) => left.localeCompare(right)), Object.entries(form.engineHours ?? {}).sort(([left], [right]) => left.localeCompare(right)), courseFields.map(field => form.courseFieldSources[field])]);
}

/** Calculated cache values and unrelated text cannot invalidate an in-flight calculation. */
export function courseCalculationKey(form: LineForm, boat?: LogLineFormUpdateContext["boat"]): string {
  return JSON.stringify([courseFields.map(field => [form.courseFieldSources[field], form.courseFieldSources[field] === "calculated" ? "" : form[field]]), form.latitude, form.longitude, form.time, form.windDirection, form.windStrength, form.windUnit, boat?.deviationTable, boat?.windDriftTable]);
}

export function recalculateLogLineCourses(form: LineForm, context: LogLineFormUpdateContext & { lookupVariation: false }): LineForm;
export function recalculateLogLineCourses(form: LineForm, context?: LogLineFormUpdateContext): LineForm | Promise<LineForm>;
export function recalculateLogLineCourses(form: LineForm, context: LogLineFormUpdateContext = {}): LineForm | Promise<LineForm> {
  const input: CourseConversionInput = {};
  for (const field of courseFields) {
    if (form.courseFieldSources[field] !== "calculated") input[field] = optionalNumber(form[field]);
  }
  const deviationTable = context.boat ? deviationTableFromBoat(context.boat) : undefined;
  const windDriftTable = context.boat ? windDriftTableFromBoat(context.boat) : undefined;
  const latitude = parseCoordinate(form.latitude);
  const longitude = parseCoordinate(form.longitude);
  const position = context.lookupVariation !== false && form.latitude.trim() && form.longitude.trim() && Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude } : undefined;
  const options = { position, date: form.time ? new Date(form.time) : undefined, variationLookup: context.variationLookup, windDirection: parseWindDirection(form.windDirection), windSpeedKnots: windSpeedKnotsFromForm(form), windDriftTable };
  // With no fixed course input there is no basis for a new course chain.
  const hasInput = courseFields.some(field => input[field] !== undefined);
  const conversion = hasInput ? calculateCourseConversion(input, deviationTable, options) : {};
  const merge = (result: CourseConversionInput): LineForm => {
    const next = { ...form, courseFieldSources: { ...form.courseFieldSources } };
    for (const field of courseFields) {
      if (form.courseFieldSources[field] === "calculated") next[field] = result[field] === undefined ? "" : String(Math.round(result[field]!));
    }
    return next;
  };
  return conversion instanceof Promise
    ? conversion.then(merge, () => merge(calculateCourseConversion(input, deviationTable, { ...options, position: undefined }) as CourseConversionInput))
    : merge(conversion);
}

function applyFieldUpdate(form: LineForm, { field, value }: LogLineFormUpdate): LineForm {
  const axis = coordinateAxes[field];
  if (!axis) return { ...form, [field]: value };
  if (!value.trim()) return { ...form, [field]: "" };
  const parsed = parseCoordinate(value);
  return { ...form, [field]: Number.isFinite(parsed) ? String(normalizeCoordinate(parsed, axis)) : value };
}

function shouldRecalculateCourses(field: keyof LineForm) {
  return courseFields.includes(field as CourseField) || ["windDirection", "windStrength", "windUnit", "latitude", "longitude", "time"].includes(field);
}

const cardinalWindDirections: Record<string, number> = {
  N: 0,
  NNE: 22.5,
  NE: 45,
  ENE: 67.5,
  E: 90,
  ESE: 112.5,
  SE: 135,
  SSE: 157.5,
  S: 180,
  SSW: 202.5,
  SW: 225,
  WSW: 247.5,
  W: 270,
  WNW: 292.5,
  NW: 315,
  NNW: 337.5,
};

function parseWindDirection(value: string) {
  const numeric = optionalNumber(value);
  if (numeric !== undefined) return numeric;
  return cardinalWindDirections[value.trim().toUpperCase()];
}

function windSpeedKnotsFromForm(form: LineForm) {
  const speed = optionalNumber(form.windStrength);
  if (speed === undefined) return undefined;
  switch (form.windUnit) {
    case "kn":
      return speed;
    case "bft":
      return beaufortToKnots(speed);
    case "m/s":
      return speed * 1.9438444924406048;
    case "km/h":
      return speed / 1.852;
    case "mp/h":
      return speed / 1.1507794480235425;
    default:
      return speed;
  }
}

function beaufortToKnots(beaufort: number) {
  const lowerLimits = [0, 1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64];
  return lowerLimits[Math.max(0, Math.min(12, Math.round(beaufort)))] ?? 0;
}

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  try { return parseDecimalInput(value) ?? undefined; } catch { return undefined; }
}

function deviationTableFromBoat(boat: Pick<Boat, "deviationTable">): DeviationTable | undefined {
  const entries = boat.deviationTable
    .map((row) => [row.heading, optionalNumber(row.deviation)] as const)
    .filter((entry): entry is readonly [number, number] => entry[1] !== undefined);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function windDriftTableFromBoat(boat: Pick<Boat, "windDriftTable">): WindDriftTable | undefined {
  // Older boats store an empty array when no drift table was configured.
  if (!boat.windDriftTable || !Array.isArray(boat.windDriftTable.rows)) return undefined;
  const rows = boat.windDriftTable.rows.map((row) => {
    const values = Object.fromEntries(Object.entries(row.values).map(([key, value]) => [key, optionalNumber(value)]));
    return [row.angle, values];
  });
  const windSpeedLimits = Object.fromEntries(Object.entries(boat.windDriftTable.windSpeedLimits).map(([key, value]) => [key, optionalNumber(value) ?? 0]));
  return rows.some(([, values]) => Object.values(values).some((value) => value !== undefined))
    ? { windSpeedLimits, rows: Object.fromEntries(rows) } as WindDriftTable
    : undefined;
}
