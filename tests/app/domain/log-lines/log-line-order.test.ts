import { describe, expect, it } from "vitest";
import { sortLogLinesByTime } from "../../../../app/domain/log-lines/log-line-order";
import type { LogLine } from "../../../../app/models/logbook";

describe("sortLogLinesByTime", () => {
  it("places a newly saved line into chronological order", () => {
    const lines = [line("late", "2026-08-17T16:00:00Z"), line("early", "2026-08-17T08:00:00Z"), line("middle", "2026-08-17T12:00:00Z")];

    expect(sortLogLinesByTime(lines).map(({ id }) => id)).toEqual(["early", "middle", "late"]);
    expect(lines.map(({ id }) => id)).toEqual(["late", "early", "middle"]);
  });

  it("supports time-only values and keeps invalid values at the bottom", () => {
    const lines = [line("unknown", ""), line("afternoon", "14:30"), line("morning", "08:15")];

    expect(sortLogLinesByTime(lines).map(({ id }) => id)).toEqual(["morning", "afternoon", "unknown"]);
  });
});

function line(id: string, time: string) {
  return { id, time } as LogLine;
}
