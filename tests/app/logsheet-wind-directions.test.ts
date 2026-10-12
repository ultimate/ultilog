import { describe, expect, it } from "vitest";
import { compassDirections, translatedWindDirection } from "../../app/components/logbook/wind-directions";
import { t, type Locale } from "../../app/lib/i18n/translations";

describe("localized wind directions", () => {
  it.each(["en", "de", "fr", "it"] as Locale[])("translates every compass direction in %s", locale => {
    for (const direction of compassDirections) expect(translatedWindDirection(direction, key => t(locale, key))).toBeTruthy();
  });
  it("uses local east and west abbreviations and preserves unknown values", () => {
    expect(translatedWindDirection("NNE", key => t("de", key))).toBe("NNO");
    expect(translatedWindDirection("WNW", key => t("fr", key))).toBe("ONO");
    expect(translatedWindDirection("SW", key => t("it", key))).toBe("SO");
    expect(translatedWindDirection("225", key => t("de", key))).toBe("225");
    expect(translatedWindDirection("", key => t("de", key))).toBe("");
  });
});
