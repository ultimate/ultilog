import { describe, expect, it } from "vitest";
import { embedThemeDefaults, parseEmbedTheme } from "../../../../app/domain/logbook/embed-theme";

describe("shared logbook embed theme", () => {
  it("accepts the four supported URL colors", () => {
    expect(parseEmbedTheme({ bg: "#112233", surface: "#abcdef", text: "#010203", accent: "#AABBCC" })).toEqual({
      background: "#112233", surface: "#abcdef", text: "#010203", accent: "#AABBCC",
    });
  });

  it("rejects values that could inject CSS", () => {
    expect(parseEmbedTheme({ bg: "red", surface: "#fff", text: "#123456;display:none", accent: ["#654321", "#000000"] })).toEqual({
      ...embedThemeDefaults,
      accent: "#654321",
    });
  });
});
