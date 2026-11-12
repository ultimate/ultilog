import { describe, expect, it } from "vitest";
import { courseFields, courseSourcesFor, isCourseFieldSources } from "../../app/models/course-field-sources";
import { lineToForm } from "../../app/components/logbook/forms";
import { lineFormToLogLine } from "../../app/domain/log-lines/log-line-form";
import { validateLogLine } from "../../app/lib/validation/log-line";
import { validatePersistedLogbook } from "../../app/lib/validation/logbook";
import { sampleBoats, sampleLogSheets } from "../fixtures/logbook";

describe("required course sources", () => {
  it("classifies zero as populated, marks extracted values scanned, and leaves empty fields automatic", () => {
    expect(courseSourcesFor({ compassCourse: 0, deviation: null, variation: "" }, "scanned")).toMatchObject({ compassCourse: "scanned", deviation: "calculated", variation: "calculated" });
    expect(Object.keys(courseSourcesFor({}))).toEqual([...courseFields]);
  });
  it("validates complete maps only", () => {
    expect(isCourseFieldSources(courseSourcesFor({}))).toBe(true);
    for (const value of [null, [], {}, { ...courseSourcesFor({}), deviation: "scanner" }, { ...courseSourcesFor({}), extra: "input" }, { ...courseSourcesFor({}), deviation: { toString: null } }]) expect(isCourseFieldSources(value)).toBe(false);
  });
  it("retains protected and automatic sources through form conversion and focused validation", () => {
    const line = { ...sampleLogSheets[0].lines[0], time: "2026-11-11T10:00:00Z", courseFieldSources: { ...sampleLogSheets[0].lines[0].courseFieldSources, deviation: "scanned" as const, magneticCourse: "calculated" as const } };
    const converted = lineFormToLogLine(lineToForm(line));
    expect(converted.courseFieldSources).toEqual(line.courseFieldSources);
    expect(validateLogLine(converted).courseFieldSources).toEqual(line.courseFieldSources);
    expect(() => validateLogLine({ ...converted, courseFieldSources: undefined })).toThrow();
    expect(() => validateLogLine({ ...converted, courseFieldSources: {} })).toThrow();
  });
  it("normalizes legacy JSON imports without guessing scanner origin and preserves modern exports", () => {
    const sheet = structuredClone(sampleLogSheets[0]);
    const book = { boats: structuredClone(sampleBoats), sheets: [{ ...sheet, source: "scanner" }], crewMembers: sheet.crew };
    for (const line of book.sheets[0].lines) delete (line as Partial<typeof line>).courseFieldSources;
    const normalized = validatePersistedLogbook(book);
    expect(normalized.sheets[0].lines[0].courseFieldSources).toEqual(courseSourcesFor(sheet.lines[0]));
    const modern = structuredClone(normalized);
    modern.sheets[0].lines[0].courseFieldSources.deviation = "scanned";
    expect(validatePersistedLogbook(modern).sheets[0].lines[0].courseFieldSources.deviation).toBe("scanned");
  });
});
