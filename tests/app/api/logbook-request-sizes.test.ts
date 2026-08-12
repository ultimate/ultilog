import { describe, expect, it } from "vitest";
import { ENTITY_REQUEST_LIMITS } from "../../../app/lib/validation/request-limits";
import { sampleBoats, sampleLogSheets } from "../../fixtures/logbook";

const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), "utf8");

describe("focused mutation request sizes", () => {
  it("keeps representative boat and sheet payloads far below their endpoint limits", () => {
    const boatSizes = sampleBoats.map(bytes);
    const sheetSizes = sampleLogSheets.map(bytes);
    expect(Math.max(...boatSizes)).toBeLessThan(ENTITY_REQUEST_LIMITS.boat / 100);
    expect(Math.max(...sheetSizes)).toBeLessThan(ENTITY_REQUEST_LIMITS.sheet / 100);
  });

  it("documents a representative crew payload size", () => {
    const crew = sampleLogSheets[0].crew[0];
    expect(bytes(crew)).toBeLessThan(ENTITY_REQUEST_LIMITS.crewMember / 100);
  });
});
