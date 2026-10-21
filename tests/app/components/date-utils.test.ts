import { describe, expect, it } from "vitest";
import { sheetListDate } from "../../../app/components/logbook/date-utils";

describe("sheet list calendar dates", () => {
  it.each([
    ["2027-01-01T00:00:00+14:00", "2026-12-31"],
    ["2026-03-01T00:00:00-12:00", "2026-02-28"],
    ["2024-03-01T00:00:00.000Z", "2024-02-29"],
    ["2026-05-02, 00:00", "2026-05-01"],
    ["2026-05-02T00:00", "2026-05-01"],
    ["2026-05-02T00:01:00Z", "2026-05-02"],
    ["2026-05-02T00:00:01Z", "2026-05-02"],
    ["2026-05-02T00:00:00.001Z", "2026-05-02"],
    ["2026-05-02", "2026-05-02"],
    ["", ""],
  ])("displays end %s as %s", (stamp, expected) => {
    expect(sheetListDate(stamp, true)).toBe(expected);
  });

  it("keeps midnight start dates on their stored calendar day", () => {
    expect(sheetListDate("2026-05-02T00:00:00+14:00")).toBe("2026-05-02");
  });
});
