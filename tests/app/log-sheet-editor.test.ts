import { describe, expect, it } from "vitest";
import { parseDecimalInput, parseHourInput, formatEngineHours } from "../../app/lib/log-input";
import { defaultLineForm, lineToForm } from "../../app/components/logbook/forms";
import { lineFormToLogLine } from "../../app/domain/log-lines/log-line-form";
import { calculateLogSheetMetrics } from "../../app/domain/logbook/sheet-metrics";
import { validateLogLine } from "../../app/lib/validation/log-line";
import { normalizeLogLinesForMap } from "../../app/components/logbook/map-normalization";
import { parsePreferenceDateTime } from "../../app/components/logbook/PreferenceDateTimeInput";
import { dateFormats, timeFormats, formatStoredDateTime } from "../../app/lib/date-time-format";
import { dateTimeLocalFromStamp, isoDateTimeWithTimezone, timezoneOffsetFromStamp } from "../../app/components/logbook/date-utils";

const form = { ...defaultLineForm, id: "line", time: "2026-10-24T10:30:00+05:45", latitude: "0", longitude: "0" };

describe("log sheet numeric editing", () => {
  it("round-trips blank and zero independently, including engine runtimes", () => {
    const line = lineFormToLogLine({ ...form, temperature: "0", compassCourse: "0", engineHours: { port: "00:00", starboard: "" } });
    expect(line).toMatchObject({ temperature: 0, compassCourse: 0, speedKn: null, logNm: null, barometer: null, engineHours: { port: 0 } });
    const draft = lineToForm(line);
    expect(draft).toMatchObject({ temperature: "0", speedKn: "", logNm: "", engineHours: { port: "00:00" } });
    expect(lineFormToLogLine(draft)).toEqual(line);
    expect(validateLogLine(line)).toEqual(line);
    expect(() => validateLogLine({ ...line, engineHours: { port: -1 } })).toThrow();
  });

  it("round-trips a line without engine readings", () => {
    const line = lineFormToLogLine(form);
    expect(line.engineHours).toEqual({});
    const zeroPressure = lineFormToLogLine({ ...form, barometer: "0" });
    expect(lineFormToLogLine(lineToForm(zeroPressure)).barometer).toBe(0);
    expect(lineFormToLogLine(lineToForm(line))).toEqual(line);
  });

  it.each(["1,5", "1.5", " 1,5 "])("accepts decimal input %s", text => expect(parseDecimalInput(text)).toBe(1.5));
  it.each(["1,234.5", "1.234,5", "1 234", "3no", "Infinity", "NaN"])("rejects malformed or grouped input %s", text => expect(() => parseDecimalInput(text)).toThrow());
  it("accepts decimal comma in coordinates and preserves explicit zero", () => {
    expect(lineFormToLogLine({ ...form, latitude: "47,5", longitude: "8,25" })).toMatchObject({ latitude: 47.5, longitude: 8.25 });
    expect(lineFormToLogLine(form)).toMatchObject({ latitude: 0, longitude: 0 });
  });
  it.each(["01:30", "1.5", "1,5"])("accepts hour input %s", text => expect(parseHourInput(text)).toBe(1.5));
  it("supports meter readings over 24 hours and minute precision", () => {
    expect(parseHourInput("1250:01")).toBeCloseTo(1250 + 1 / 60);
    expect(formatEngineHours(parseHourInput("1250:01"))).toBe("1250:01");
    expect(formatEngineHours(1.999999999)).toBe("02:00");
  });
  it.each(["1:60", "1:3", "-1:30", "-1", "1:30:00"])("rejects invalid duration %s", text => expect(() => parseHourInput(text)).toThrow());
  it("requires date, time, timezone and both coordinates for manual saves", () => {
    const line = lineFormToLogLine(form);
    for (const patch of [{ time: "" }, { time: "10:30" }, { time: "2026-10-24T10:30" }, { time: "2026-02-30T10:30:00Z" }, { time: "2026-10-24T24:00:00Z" }, { latitude: null }, { longitude: null }]) {
      expect(() => validateLogLine({ ...line, ...patch })).toThrow();
    }
    expect(() => lineFormToLogLine({ ...form, latitude: "unknown" })).toThrow();
    const incomplete = lineFormToLogLine({ ...form, latitude: "unknown", longitude: "" }, { scannerDraft: true });
    expect(incomplete).toMatchObject({ latitude: null, longitude: null });
    expect(normalizeLogLinesForMap([incomplete])).toEqual({ points: [], bounds: null });
  });
  it("does not inflate cumulative distance when a reading is missing", () => {
    const line = lineFormToLogLine(form);
    const metrics = calculateLogSheetMetrics([
      { ...line, time: "09:00", logNm: 10 },
      { ...line, time: "10:00", logNm: null },
      { ...line, time: "11:00", logNm: 15 },
    ]);
    expect(metrics.totalMiles).toBe(15);
  });
  it("uses the maximum in each interval, rather than the maximum engine total", () => {
    const line = lineFormToLogLine(form);
    const metrics = calculateLogSheetMetrics([
      { ...line, time: "09:00", engineHours: { port: 1, starboard: 0.5 } },
      { ...line, time: "10:00", engineHours: { port: 0.5, starboard: 1 } },
    ]);
    expect(metrics.motorHours).toBe(2);
    expect(metrics.engineHours).toEqual({ port: 1.5, starboard: 1.5 });
  });
});

describe("preference-aware date editors", () => {
  for (const locale of ["en", "de", "fr", "it"]) {
    for (const dateFormat of dateFormats) {
      for (const timeFormat of timeFormats) {
        it(`round-trips ${locale} ${dateFormat} ${timeFormat}`, () => {
          const stamp = "2026-10-24T13:45:27+05:45";
          const text = formatStoredDateTime(stamp, dateFormat, timeFormat, locale);
          const parsed = parsePreferenceDateTime(text, dateFormat, timeFormat, locale);
          expect(parsed).toBe(timeFormat.includes("ss") ? "2026-10-24T13:45:27" : "2026-10-24T13:45");
          const saved = isoDateTimeWithTimezone(parsed!, timezoneOffsetFromStamp(stamp));
          expect(saved.endsWith("+05:45")).toBe(true);
          expect(dateTimeLocalFromStamp(saved)).toContain("2026-10-24T13:45");
        });
      }
    }
  }
  it("rejects invalid dates and times", () => {
    for (const text of ["31/02/2026, 10:30", "24/10/2026, 25:00", "24/10/2026, 10:65", "24/10/2026, 10:"]) {
      expect(parsePreferenceDateTime(text, "dd/MM/yyyy", "HH:mm", "en")).toBeUndefined();
    }
  });
});
