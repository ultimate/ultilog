import { describe, expect, it } from "vitest";
import { DEMO_LOGBOOK_TEMPLATE, DEMO_TEMPLATE_VERSION, DEMO_WEATHER_PROVENANCE } from "../../../../app/lib/demo/demo-template";

describe("immutable demo logbook template", () => {
  it("contains two boats, five reusable crew members, and two four-day cruises", () => {
    expect(DEMO_TEMPLATE_VERSION).toBe(1);
    expect(DEMO_LOGBOOK_TEMPLATE.boats.map((boat) => boat.type).sort()).toEqual(["Motor", "Sail"]);
    expect(DEMO_LOGBOOK_TEMPLATE.crewMembers).toHaveLength(5);
    expect(DEMO_LOGBOOK_TEMPLATE.sheets).toHaveLength(8);

    for (const boat of DEMO_LOGBOOK_TEMPLATE.boats) {
      const sheets = DEMO_LOGBOOK_TEMPLATE.sheets.filter((sheet) => sheet.boatId === boat.id);
      expect(sheets).toHaveLength(4);
      expect(sheets.every((sheet) => sheet.lines.length >= 3)).toBe(true);
    }
  });

  it("only references template boats and crew and mixes crew between sheets", () => {
    const boatIds = new Set(DEMO_LOGBOOK_TEMPLATE.boats.map((boat) => boat.id));
    const crewIds = new Set(DEMO_LOGBOOK_TEMPLATE.crewMembers.map((member) => member.id));
    const crewCombinations = new Set<string>();

    for (const sheet of DEMO_LOGBOOK_TEMPLATE.sheets) {
      expect(boatIds.has(sheet.boatId)).toBe(true);
      expect(sheet.crew.every((member) => crewIds.has(member.id))).toBe(true);
      crewCombinations.add(sheet.crew.map((member) => member.id).sort().join(","));
    }

    expect(crewCombinations.size).toBeGreaterThan(2);
  });

  it("deep-freezes the template and documents weather provenance", () => {
    expect(Object.isFrozen(DEMO_LOGBOOK_TEMPLATE)).toBe(true);
    expect(Object.isFrozen(DEMO_LOGBOOK_TEMPLATE.sheets)).toBe(true);
    expect(Object.isFrozen(DEMO_LOGBOOK_TEMPLATE.sheets[0].lines[0])).toBe(true);
    expect(DEMO_WEATHER_PROVENANCE.url).toContain("historical-weather-api");
    expect(DEMO_LOGBOOK_TEMPLATE.sheets.every((sheet) => sheet.verificationNote?.includes("not certified ship observations"))).toBe(true);
  });
});
