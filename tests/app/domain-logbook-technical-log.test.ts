import { describe, expect, it } from "vitest";
import { createTechnicalChecks, normalizeStandardTechnicalCheckIds, normalizeTechnicalCheck, standardTechnicalLogTemplate, TECHNICAL_CHECK_STATUSES } from "../../app/domain/logbook/technical-log";

describe("technical log templates", () => {
  it("provides a translated, immutable standard checklist", () => {
    expect(standardTechnicalLogTemplate("en").map(({ text }) => text)).toEqual(expect.arrayContaining(["Engine oil", "Rigs"]));
    expect(standardTechnicalLogTemplate("de").map(({ text }) => text)).toContain("Motoröl");
    expect(standardTechnicalLogTemplate("fr").map(({ text }) => text)).toContain("Gréement");
    expect(standardTechnicalLogTemplate("it").map(({ text }) => text)).toContain("Sartiame");
  });

  it("supports partial and empty standard-check selections using stable ids", () => {
    expect(createTechnicalChecks("de", ["Custom"], ["engineOil"])).toEqual([
      { status: "⌛", text: "Motoröl" },
      { status: "⌛", text: "Custom" },
    ]);
    expect(createTechnicalChecks("en", ["Custom"], [])).toEqual([{ status: "⌛", text: "Custom" }]);
    expect(normalizeStandardTechnicalCheckIds(["rigs", "unknown", "rigs"], [])).toEqual(["rigs"]);
  });

  it("prefills standard and custom lines with the waiting status", () => {
    const checks = createTechnicalChecks("en", ["Generator belt"]);
    expect(checks.at(-1)).toEqual({ status: "⌛", text: "Generator belt" });
    expect(checks).toHaveLength(8);
  });

  it("normalizes legacy strings and rejects unsupported statuses", () => {
    expect(normalizeTechnicalCheck("Engine oil")).toEqual({ status: "⌛", text: "Engine oil" });
    expect(normalizeTechnicalCheck({ status: "unknown", text: "Fuel" })).toEqual({ status: "⌛", text: "Fuel" });
    expect(TECHNICAL_CHECK_STATUSES).toContain("✅");
    expect(TECHNICAL_CHECK_STATUSES.slice(0, 2)).toEqual(["⌛", "✅"]);
  });
});
