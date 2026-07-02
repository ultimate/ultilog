import { describe, expect, it } from "vitest";
import { decimalToDmsParts, dmsPartsToDecimal, parseCoordinate } from "../../../../app/domain/nautical/coordinates";

describe("coordinate helpers", () => {
  it("round-trips DMS input parts through decimal storage", () => {
    const decimal = dmsPartsToDecimal({ degrees: "38", minutes: "57", seconds: "21.60" });

    expect(decimal).toBeCloseTo(38.956, 6);
    expect(decimalToDmsParts(decimal)).toEqual({ degrees: "38", minutes: "57", seconds: "21.60" });
  });

  it("preserves negative coordinates when converting DMS parts", () => {
    expect(dmsPartsToDecimal({ degrees: "-20", minutes: "45", seconds: "14.40" })).toBeCloseTo(-20.754, 6);
    expect(parseCoordinate("20° 45' 14.40\" W")).toBeCloseTo(-20.754, 6);
  });

  it("normalizes minute and second rollover through decimal storage", () => {
    expect(decimalToDmsParts(dmsPartsToDecimal({ degrees: "38", minutes: "59", seconds: "60" }))).toEqual({ degrees: "39", minutes: "0", seconds: "0.00" });
    expect(decimalToDmsParts(dmsPartsToDecimal({ degrees: "38", minutes: "60", seconds: "0" }))).toEqual({ degrees: "39", minutes: "0", seconds: "0.00" });
    expect(decimalToDmsParts(dmsPartsToDecimal({ degrees: "38", minutes: "0", seconds: "-1" }))).toEqual({ degrees: "37", minutes: "59", seconds: "59.00" });
  });
});
