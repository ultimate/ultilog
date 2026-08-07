import { describe, expect, it } from "vitest";
import { calculateSmartNavigationFields, previousSheetLogMiles } from "../../../../app/domain/log-lines/smart-line";
import type { LogLine, LogSheet } from "../../../../app/models/logbook";

const line = (values: Partial<LogLine> = {}) => ({
  time: "2026-08-07T10:00:00+00:00", latitude: 54, longitude: 10, logNm: 12,
  engineHours: {}, motorHours: 0,
  ...values,
}) as LogLine;

const sheet = (values: Partial<LogSheet> = {}) => ({
  id: "sheet", boatId: "boat", route: { from: "", to: "", departed: "2026-08-07T00:00:00+00:00", arrived: "" }, lines: [],
  ...values,
}) as LogSheet;

describe("smart log-line defaults", () => {
  it("derives cumulative miles, COG, and average speed from the previous position", () => {
    const fields = calculateSmartNavigationFields(
      [line()],
      { latitude: 55, longitude: 10 },
      "2026-08-07T20:00:00+00:00",
    );

    expect(fields).toEqual({ logNm: "72", courseOverGround: "0", speedKn: "6" });
  });

  it("takes the log counter from the final line of the previous sheet for the same boat", () => {
    const previous = sheet({ id: "previous", route: { from: "", to: "", departed: "2026-08-06T00:00:00Z", arrived: "" }, lines: [line({ logNm: 123.4 })] });
    expect(previousSheetLogMiles([previous], sheet())).toBe("123.4");
  });

  it("does not carry counters into a sheet that already has lines", () => {
    expect(previousSheetLogMiles([], sheet({ lines: [line()] }))).toBe("");
  });
});
