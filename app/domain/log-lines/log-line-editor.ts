import type { Boat, LineForm } from "../../models/logbook";
import { calculateCourseConversion, type CourseConversionInput, type CourseConversionLookupOptions, type DeviationTable, type WindDriftTable } from "../nautical/course-conversion";
import { normalizeCoordinate, parseCoordinate, type CoordinateAxis } from "../nautical/coordinates";

type CourseFieldName = typeof courseInputFieldNames[number];

export type LogLineFormUpdate = {
  field: keyof LineForm;
  value: string;
};

export type LogLineFormUpdateContext = {
  boat?: Pick<Boat, "deviationTable" | "windDriftTable">;
  variationLookup?: CourseConversionLookupOptions["variationLookup"];
};

const courseInputFieldNames = ["compassCourse", "deviation", "magneticCourse", "variation", "trueCourse", "windDrift", "courseThroughWater", "currentDrift", "courseOverGround"] as const;
const coordinateAxes: Partial<Record<keyof LineForm, CoordinateAxis>> = { latitude: "lat", longitude: "lon" };

export function updateLogLineFormForInput(form: LineForm, update: LogLineFormUpdate, context: LogLineFormUpdateContext = {}) {
  const nextForm = applyFieldUpdate(form, update);
  if (!shouldRecalculateCourses(update.field, nextForm)) return nextForm;

  const deviationTable = context.boat ? deviationTableFromBoat(context.boat) : undefined;
  const windDriftTable = context.boat ? windDriftTableFromBoat(context.boat) : undefined;
  const input = courseInputFromForm(nextForm, Boolean(deviationTable), Boolean(windDriftTable));
  const position = nextForm.latitude.trim() || nextForm.longitude.trim()
    ? { latitude: parseCoordinate(nextForm.latitude), longitude: parseCoordinate(nextForm.longitude) }
    : undefined;
  const date = nextForm.time ? new Date(nextForm.time) : undefined;
  const options = { position, date, variationLookup: context.variationLookup, windDirection: parseWindDirection(nextForm.windDirection), windSpeedKnots: windSpeedKnotsFromForm(nextForm), windDriftTable };
  const conversion = calculateCourseConversion(input, deviationTable, options);

  if (conversion instanceof Promise) {
    return conversion.then((result) => ({ ...nextForm, ...courseFormFromConversion(result) }));
  }

  return { ...nextForm, ...courseFormFromConversion(conversion) };
}

function applyFieldUpdate(form: LineForm, { field, value }: LogLineFormUpdate): LineForm {
  const axis = coordinateAxes[field];
  if (!axis) return { ...form, [field]: value };
  if (!value.trim()) return { ...form, [field]: "" };
  return { ...form, [field]: String(normalizeCoordinate(parseCoordinate(value), axis)) };
}

function shouldRecalculateCourses(field: keyof LineForm, form: LineForm) {
  return (courseInputFieldNames.includes(field as CourseFieldName) || field === "windDirection" || field === "windStrength" || field === "windUnit" || field === "latitude" || field === "longitude" || field === "time") && hasAnyCourseInput(form);
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
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function hasAnyCourseInput(form: LineForm) {
  return courseInputFieldNames.some((field) => form[field].trim());
}

function courseInputFromForm(form: LineForm, forceDeviationFromTable = false, forceWindDriftFromTable = false): CourseConversionInput {
  return {
    compassCourse: optionalNumber(form.compassCourse),
    deviation: forceDeviationFromTable ? undefined : optionalNumber(form.deviation),
    magneticCourse: optionalNumber(form.magneticCourse),
    variation: optionalNumber(form.variation),
    trueCourse: optionalNumber(form.trueCourse),
    windDrift: forceWindDriftFromTable ? undefined : optionalNumber(form.windDrift),
    courseThroughWater: optionalNumber(form.courseThroughWater),
    currentDrift: optionalNumber(form.currentDrift),
    courseOverGround: optionalNumber(form.courseOverGround),
  };
}

function courseFormFromConversion(conversion: CourseConversionInput): Partial<LineForm> {
  const updates: Partial<LineForm> = {};
  setCourseFormValue(updates, "compassCourse", conversion.compassCourse);
  setCourseFormValue(updates, "deviation", conversion.deviation);
  setCourseFormValue(updates, "magneticCourse", conversion.magneticCourse);
  setCourseFormValue(updates, "variation", conversion.variation);
  setCourseFormValue(updates, "trueCourse", conversion.trueCourse);
  setCourseFormValue(updates, "windDrift", conversion.windDrift);
  setCourseFormValue(updates, "courseThroughWater", conversion.courseThroughWater);
  setCourseFormValue(updates, "currentDrift", conversion.currentDrift);
  setCourseFormValue(updates, "courseOverGround", conversion.courseOverGround);
  return updates;
}

function setCourseFormValue(updates: Partial<LineForm>, field: keyof LineForm, value: number | undefined) {
  if (value !== undefined) updates[field] = String(Math.round(value));
}

function deviationTableFromBoat(boat: Pick<Boat, "deviationTable">): DeviationTable | undefined {
  const entries = boat.deviationTable
    .map((row) => [row.heading, optionalNumber(row.deviation)] as const)
    .filter((entry): entry is readonly [number, number] => entry[1] !== undefined);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function windDriftTableFromBoat(boat: Pick<Boat, "windDriftTable">): WindDriftTable | undefined {
  if (!boat.windDriftTable) return undefined;
  const rows = boat.windDriftTable.rows.map((row) => {
    const values = Object.fromEntries(Object.entries(row.values).map(([key, value]) => [key, optionalNumber(value)]));
    return [row.angle, values];
  });
  const windSpeedLimits = Object.fromEntries(Object.entries(boat.windDriftTable.windSpeedLimits).map(([key, value]) => [key, optionalNumber(value) ?? 0]));
  return rows.some(([, values]) => Object.values(values).some((value) => value !== undefined))
    ? { windSpeedLimits, rows: Object.fromEntries(rows) } as WindDriftTable
    : undefined;
}
