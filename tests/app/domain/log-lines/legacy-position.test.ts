import { describe, expect, it } from "vitest";
import { appendNamedPosition } from "../../../../app/domain/log-lines/legacy-position";
import { validatePersistedLogbook } from "../../../../app/lib/validation/logbook";
import { sampleBoats, sampleLogSheets } from "../../../fixtures/logbook";

const legacy = () => ({ boats: sampleBoats, crewMembers: [], sheets: [{ ...sampleLogSheets[0], crew: [], lines: [{ ...sampleLogSheets[0].lines[0], position: "Harbor", remarks: "Moored" }], scannerWarnings: [
  { id: "obsolete", code: "missingFields", row: 1, fields: ["position"] },
  { id: "mixed", code: "missingFields", row: 1, fields: ["position", "longitude"] },
] }] });

describe("legacy named row locations", () => {
  it("preserves a name and existing remarks without duplicating or changing coordinates", () => {
    const input = legacy();
    const normalized = validatePersistedLogbook(input);
    const line = normalized.sheets[0].lines[0];
    expect(line).toMatchObject({ remarks: "Moored\nHarbor", latitude: input.sheets[0].lines[0].latitude, longitude: input.sheets[0].lines[0].longitude });
    expect(line).not.toHaveProperty("position");
    expect(normalized.sheets[0].scannerWarnings).toEqual([{ id: "mixed", code: "missingFields", row: 1, fields: ["longitude"] }]);
    expect(validatePersistedLogbook(normalized)).toEqual(normalized);
  });
  it("keeps empty and already preserved names from producing extra remarks", () => {
    expect(appendNamedPosition("", " Harbor ")).toBe("Harbor");
    expect(appendNamedPosition("Moored\nHarbor", "Harbor")).toBe("Moored\nHarbor");
    expect(appendNamedPosition("Moored", "  ")).toBe("Moored");
  });
});
