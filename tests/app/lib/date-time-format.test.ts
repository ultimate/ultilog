import { describe, expect, it } from "vitest";
import { dateFormats, parseFormattedDate, formatStoredDate, formatStoredDateRange, formatStoredDateTime, formatStoredTime } from "../../../app/lib/date-time-format";

describe("date and time display formatting", () => {
  it("offers common numeric and localized month date layouts", () => {
    expect(formatStoredDate("2026-08-07", "dd/MM/yyyy")).toBe("07/08/2026");
    expect(formatStoredDate("2026-08-07", "MM/dd/yyyy")).toBe("08/07/2026");
    expect(formatStoredDate("2026-08-07", "dd.MM.yyyy")).toBe("07.08.2026");
    expect(formatStoredDate("2026-08-07", "d MMM yyyy", "de")).toBe("7 Aug 2026");
  });

  it("formats 12 and 24 hour times while retaining stored wall-clock values", () => {
    expect(formatStoredTime("2026-08-07T19:05:09+05:30", "HH:mm")).toBe("19:05");
    expect(formatStoredTime("2026-08-07T19:05:09+05:30", "h:mm:ss a")).toBe("7:05:09 PM");
    expect(formatStoredDateTime("2026-08-07T19:05:09-04:00", "MMM d, yyyy", "h:mm a")).toBe("Aug 7, 2026, 7:05 PM");
  });

  it("builds display ranges from route start and end dates", () => {
    expect(formatStoredDateRange("2026-08-04T08:00:00+02:00", "2026-08-06T18:00:00+02:00", "dd.MM.yyyy")).toBe("04.08.2026 – 06.08.2026");
    expect(formatStoredDateRange("2026-08-04T08:00:00+02:00", "2026-08-04T18:00:00+02:00", "dd.MM.yyyy")).toBe("04.08.2026");
  });

  it("leaves invalid non-ISO values unchanged", () => {
    expect(formatStoredDate("Summer cruise", "yyyy-MM-dd")).toBe("Summer cruise");
    expect(formatStoredTime("time open", "HH:mm")).toBe("time open");
  });
});

describe("configured date input", () => {
  for (const locale of ["en", "de", "fr", "it"]) {
    it(`round trips every configured format and month in ${locale}`, () => {
      for (const format of dateFormats) {
        for (let month = 1; month <= 12; month++) {
          const iso = `2026-${String(month).padStart(2, "0")}-07`;
          expect(parseFormattedDate(formatStoredDate(iso, format, locale), format, locale)).toBe(iso);
        }
      }
    });
  }
  it("does not guess ambiguous dates or accept impossible dates", () => {
    expect(parseFormattedDate("05/06/2026", "dd/MM/yyyy")).toBe("2026-06-05");
    expect(parseFormattedDate("05/06/2026", "MM/dd/yyyy")).toBe("2026-05-06");
    expect(parseFormattedDate("31.02.2026", "dd.MM.yyyy")).toBeUndefined();
    expect(parseFormattedDate("07/08/2026", "dd.MM.yyyy")).toBeUndefined();
  });
});
