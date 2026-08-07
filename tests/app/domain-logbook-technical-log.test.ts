import { describe, expect, it } from "vitest";
import { createTechnicalChecks, normalizeTechnicalCheck, standardTechnicalLogTemplate, TECHNICAL_CHECK_STATUSES } from "../../app/domain/logbook/technical-log";

describe("technical log templates", () => {
  it("provides a translated, immutable standard checklist", () => {
    expect(standardTechnicalLogTemplate("en")).toEqual(expect.arrayContaining(["Engine oil", "Rigs"]));
    expect(standardTechnicalLogTemplate("de")).toContain("Motoröl");
    expect(standardTechnicalLogTemplate("fr")).toContain("Gréement");
    expect(standardTechnicalLogTemplate("it")).toContain("Sartiame");
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
  });
});
