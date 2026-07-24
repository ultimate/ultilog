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
  const options = { position, date, variationLookup: context.variationLookup, windDirection: optionalNumber(nextForm.windDirection), windDriftTable };
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
  return (courseInputFieldNames.includes(field as CourseFieldName) || field === "windDirection" || field === "latitude" || field === "longitude" || field === "time") && hasAnyCourseInput(form);
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
  const rows = (boat.windDriftTable ?? []).map((row) => {
    const values = Object.fromEntries(Object.entries(row.values).map(([key, value]) => [key, optionalNumber(value)]));
    return [row.angle, values];
  });
  return rows.some(([, values]) => Object.values(values).some((value) => value !== undefined)) ? Object.fromEntries(rows) as WindDriftTable : undefined;
}
