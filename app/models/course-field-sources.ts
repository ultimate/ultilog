import type { LogLine } from "./log-line";

export const courseFields = ["compassCourse", "deviation", "magneticCourse", "variation", "trueCourse", "windDrift", "courseThroughWater", "currentDrift", "courseOverGround"] as const;
export type CourseField = typeof courseFields[number];
export type CourseFieldSource = "input" | "scanned" | "calculated";
export type CourseFieldSources = Record<CourseField, CourseFieldSource>;

/** Conservative normalization for legacy imports and scanner extraction. Zero is populated. */
export function courseSourcesFor(values: Partial<Record<CourseField, unknown>>, populatedSource: CourseFieldSource = "input"): CourseFieldSources {
  return Object.fromEntries(courseFields.map(field => [field, (typeof values[field] === "number" || (typeof values[field] === "string" && values[field].trim() !== "")) ? populatedSource : "calculated"])) as CourseFieldSources;
}

export function isCourseFieldSources(value: unknown): value is CourseFieldSources {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const sources = value as Record<string, unknown>;
  return Object.keys(sources).length === courseFields.length && courseFields.every(field => (sources[field] === "input" || sources[field] === "scanned" || sources[field] === "calculated"));
}

/** Construct a line from an authoritative external source, including legacy/demo fixtures. */
export function withCourseSources(line: Omit<LogLine, "courseFieldSources">, source: CourseFieldSource = "input"): LogLine {
  return { ...line, courseFieldSources: courseSourcesFor(line, source) };
}
