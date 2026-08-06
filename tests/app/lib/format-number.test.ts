import { describe, expect, it } from "vitest";
import { formatMiles } from "../../../app/lib/format-number";

describe("formatMiles", () => {
  it("rounds floating-point noise to hundredths", () => {
    expect(formatMiles(97.19999999999999, "en-US")).toBe("97.2");
    expect(formatMiles(12.345, "en-US")).toBe("12.35");
  });

  it("keeps locale-aware grouping without unnecessary zeroes", () => {
    expect(formatMiles(1234, "en-US")).toBe("1,234");
    expect(formatMiles(1234.5, "de-CH")).toBe("1'234.5");
  });
});
