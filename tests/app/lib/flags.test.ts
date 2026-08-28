import { describe, expect, it } from "vitest";
import { countryCodeForFlagValue, flagEmoji, flagGroups, flagOptionEmoji } from "../../../app/lib/flags";

describe("flag helpers", () => {
  it("groups supported flag options by continent", () => {
    expect(flagGroups.map((group) => group.continent)).toEqual([
      "Africa",
      "Americas",
      "Asia",
      "Europe",
      "Oceania",
      "Antarctica",
      "Other",
    ]);
    expect(flagGroups.find((group) => group.continent === "Europe")?.flags).toContainEqual({ code: "CH", name: "Switzerland" });
    expect(flagGroups.find((group) => group.continent === "Other")?.flags).toContainEqual({ code: "pirate", name: "Pirate", emoji: "🏴‍☠️" });
  });

  it("converts country codes to regional indicator emoji", () => {
    expect(flagEmoji("ch")).toBe("🇨🇭");
    expect(flagEmoji("US")).toBe("🇺🇸");
  });

  it("normalizes legacy boat flag representations to ISO codes", () => {
    expect(countryCodeForFlagValue("CH")).toBe("CH");
    expect(countryCodeForFlagValue("ch")).toBe("CH");
    expect(countryCodeForFlagValue("Switzerland")).toBe("CH");
    expect(countryCodeForFlagValue("🇨🇭")).toBe("CH");
    expect(countryCodeForFlagValue("unknown")).toBe("");
  });

  it("prefers explicit emoji overrides for non-country flags", () => {
    expect(flagOptionEmoji({ code: "pirate", name: "Pirate", emoji: "🏴‍☠️" })).toBe("🏴‍☠️");
    expect(flagOptionEmoji({ code: "GB", name: "United Kingdom" })).toBe("🇬🇧");
  });
});
