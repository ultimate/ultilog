import { describe, expect, it } from "vitest";
import { formatScannerWarning } from "../../../app/lib/logbook-scanner/format-warning";
import { t } from "../../../app/lib/i18n/translations";

const translate = (locale: "en" | "de" | "fr" | "it") => (key: Parameters<typeof t>[1]) => t(locale, key);

describe("scanner warning localization", () => {
  it.each(["de", "fr", "it"] as const)("localizes coded warnings in %s", locale => {
    const warning = { id: "warning", code: "missingFields" as const, row: 2, fields: ["latitude" as const] };
    expect(formatScannerWarning(warning, translate(locale))).not.toBe(formatScannerWarning(warning, translate("en")));
    expect(formatScannerWarning(warning, translate(locale))).toContain("2");
  });

  it("retains provider fallback text for unclassified diagnostics", () => {
    expect(formatScannerWarning({ id: "warning", code: "scannerGenerated", fallbackMessage: "Check handwriting." }, translate("de"))).toBe("Check handwriting.");
  });
});
