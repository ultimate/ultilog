import { describe, expect, it } from "vitest";
import { embedThemeDefaults, embedThemeStyle, parseEmbedTheme } from "../../../../app/domain/logbook/embed-theme";

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

  it("applies the theme to both generations of design tokens", () => {
    const style = embedThemeStyle({ background: "#101820", surface: "#fefefe", text: "#223344", accent: "#aabbcc" }) as Record<string, string>;

    expect(style).toMatchObject({
      "--app-bg": "#101820",
      "--background": "#101820",
      "--surface": "#fefefe",
      "--surface-strong": "#fefefe",
      "--card": "#fefefe",
      "--text": "#223344",
      "--foreground": "#223344",
      "--blue": "#aabbcc",
      "--primary": "#aabbcc",
    });
    expect(style["--subtle"]).toContain("#223344");
    expect(style["--line"]).toContain("#fefefe");
    expect(style["--blue-soft"]).toContain("#aabbcc");
  });
});
