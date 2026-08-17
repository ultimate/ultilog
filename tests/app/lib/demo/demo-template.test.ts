import { describe, expect, it } from "vitest";
import { DEMO_LOGBOOK_TEMPLATE, DEMO_ROUTE_PROVENANCE, DEMO_TEMPLATE_VERSION, DEMO_WEATHER_PROVENANCE } from "../../../../app/lib/demo/demo-template";

describe("immutable demo logbook template", () => {
  it("contains two boats, five reusable crew members, and two four-day cruises", () => {
    expect(DEMO_TEMPLATE_VERSION).toBe(3);
    expect(DEMO_LOGBOOK_TEMPLATE.boats.map((boat) => boat.type).sort()).toEqual(["Motor", "Sail"]);
    expect(DEMO_LOGBOOK_TEMPLATE.crewMembers).toHaveLength(5);
    expect(DEMO_LOGBOOK_TEMPLATE.sheets).toHaveLength(8);

    for (const boat of DEMO_LOGBOOK_TEMPLATE.boats) {
      const sheets = DEMO_LOGBOOK_TEMPLATE.sheets.filter((sheet) => sheet.boatId === boat.id);
      expect(sheets).toHaveLength(4);
      expect(sheets.every((sheet) => sheet.lines.length >= 5 && sheet.lines.length <= 10)).toBe(true);
      expect(sheets.every((sheet) => sheet.lines.slice(0, -1).every((line) => line.speedKn > 0) && sheet.lines.at(-1)?.speedKn === 0)).toBe(true);
    }
  });

  it("records runtime separately for every engine", () => {
    for (const sheet of DEMO_LOGBOOK_TEMPLATE.sheets) {
      const boat = DEMO_LOGBOOK_TEMPLATE.boats.find((candidate) => candidate.id === sheet.boatId)!;
      for (const line of sheet.lines) {
        const hours = Object.values(line.engineHours ?? {});
        expect(line.motorHours).toBe(hours.reduce((total, value) => total + value, 0));
        if (line.motorHours > 0) expect(Object.keys(line.engineHours ?? {}).sort()).toEqual(boat.engines?.map((engine) => engine.id).sort());
      }
    }
  });

  it("uses form-compatible yacht data and illustrative shifted deviation curves", () => {
    const sailboat = DEMO_LOGBOOK_TEMPLATE.boats.find((boat) => boat.type === "Sail")!;
    expect(sailboat.homePort).toBe("Basel");

    for (const boat of DEMO_LOGBOOK_TEMPLATE.boats) {
      expect(Object.keys(boat.yachtData).sort()).toEqual(["MMSI", "Manufacturer", "Safety"]);
      expect(boat.engines?.length).toBeGreaterThan(0);
      const deviations = boat.deviationTable.map((row) => Number(row.deviation));
      expect(Math.min(...deviations)).toBeLessThanOrEqual(-14);
      expect(Math.max(...deviations)).toBeGreaterThanOrEqual(14);
      expect(new Set(deviations).size).toBeGreaterThan(10);
    }

    expect(DEMO_LOGBOOK_TEMPLATE.boats[0].deviationTable).not.toEqual(DEMO_LOGBOOK_TEMPLATE.boats[1].deviationTable);
  });

  it("provides complete wind drift tables for both boats", () => {
    for (const boat of DEMO_LOGBOOK_TEMPLATE.boats) {
      expect(boat).toHaveProperty("windDriftTable.windSpeedLimits.fullSail", "0");
      expect(boat).toHaveProperty("windDriftTable.rows", [
        expect.objectContaining({ angle: "closeHauled" }),
        expect.objectContaining({ angle: "beamReach" }),
        expect.objectContaining({ angle: "broadReach" }),
      ]);
    }

    expect(Reflect.get(DEMO_LOGBOOK_TEMPLATE.boats[0], "windDriftTable")).not.toEqual(Reflect.get(DEMO_LOGBOOK_TEMPLATE.boats[1], "windDriftTable"));
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

  it("documents the coastline audit and uses leg-specific courses", () => {
    expect(DEMO_ROUTE_PROVENANCE.source).toContain("1:10m Land");
    expect(DEMO_ROUTE_PROVENANCE.note).toContain("straight connection");

    for (const sheet of DEMO_LOGBOOK_TEMPLATE.sheets) {
      const underwayCourses = sheet.lines.slice(0, -1).map((line) => line.trueCourse);
      expect(new Set(underwayCourses).size).toBeGreaterThan(1);
      expect(sheet.lines.every((line) => Number.isFinite(line.latitude) && Number.isFinite(line.longitude))).toBe(true);
    }
  });
});
