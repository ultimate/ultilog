import { describe, expect, it } from "vitest";
import { coordinateToInput, decimalToDdmParts, decimalToDmsParts, ddmPartsToDecimal, dmsPartsToDecimal, normalizeCoordinate, parseCoordinate } from "../../../../app/domain/nautical/coordinates";

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

  it("parses nautical DDM coordinates with leading hemisphere letters", () => {
    expect(parseCoordinate("N49°27.3346'")).toBeCloseTo(49.4555767, 6);
    expect(parseCoordinate("W2°32.0386'")).toBeCloseTo(-2.5339767, 6);
  });

  it("round-trips and displays DDM coordinates", () => {
    const decimal = ddmPartsToDecimal({ degrees: "-2", minutes: "32.0386" });

    expect(decimal).toBeCloseTo(-2.5339767, 6);
    expect(decimalToDdmParts(decimal)).toEqual({ degrees: "-2", minutes: "32.0386" });
    expect(coordinateToInput(decimal, "lon", "ddm")).toBe("2° 32.0386' W");
    expect(ddmPartsToDecimal({ degrees: "-0", minutes: "30.0000" })).toBe(-0.5);
  });

  it("normalizes minute and second rollover through decimal storage", () => {
    expect(decimalToDmsParts(dmsPartsToDecimal({ degrees: "38", minutes: "59", seconds: "60" }))).toEqual({ degrees: "39", minutes: "0", seconds: "0.00" });
    expect(decimalToDmsParts(dmsPartsToDecimal({ degrees: "38", minutes: "59", seconds: "59.999" }))).toEqual({ degrees: "39", minutes: "0", seconds: "0.00" });
    expect(decimalToDmsParts(dmsPartsToDecimal({ degrees: "38", minutes: "60", seconds: "0" }))).toEqual({ degrees: "39", minutes: "0", seconds: "0.00" });
    expect(decimalToDmsParts(dmsPartsToDecimal({ degrees: "38", minutes: "0", seconds: "-1" }))).toEqual({ degrees: "37", minutes: "59", seconds: "59.00" });
  });

  it("limits latitude and rolls longitude", () => {
    expect(normalizeCoordinate(90.1, "lat")).toBe(90);
    expect(normalizeCoordinate(-90.1, "lat")).toBe(-90);
    expect(normalizeCoordinate(180.1, "lon")).toBeCloseTo(-179.9, 6);
    expect(normalizeCoordinate(-180.1, "lon")).toBeCloseTo(179.9, 6);
  });

  it("rounds decimal coordinate display to five fractional digits", () => {
    expect(coordinateToInput(38.9561234, "lat", "decimal")).toBe("38.95612");
  });
});
