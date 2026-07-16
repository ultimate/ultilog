import { describe, expect, it } from "vitest";
import { calculateMoonPhase, createLocalAstronomyProvider, createMeteoService } from "../../app/domain/meteo";

describe("local astronomy meteo provider", () => {
  it("calculates known moon phases from the snapshot timestamp", () => {
    expect(calculateMoonPhase(new Date("2000-01-06T18:14:00Z"))).toMatchObject({
      phase: "new moon",
      illuminationPercent: 0,
    });
    expect(calculateMoonPhase(new Date("2000-01-21T12:00:00Z"))).toMatchObject({
      phase: "full moon",
      illuminationPercent: 100,
    });
  });

  it("returns moon phase and illumination with calculated provenance", async () => {
    const timestamp = new Date("2026-07-16T12:00:00Z");
    const service = createMeteoService({ providers: [createLocalAstronomyProvider()] });

    const snapshot = await service.getSnapshot({ latitude: 54.1, longitude: 10.2, timestamp });

    expect(snapshot.astronomy?.moonPhase).toMatchObject({
      value: "new moon",
      unit: "text",
      provenance: {
        provider: "local-astronomy",
        providerLabel: "Local astronomy calculation",
        sourceType: "calculated",
        validAt: timestamp,
        quality: "medium",
      },
    });
    expect(snapshot.astronomy?.moonIlluminationPercent).toMatchObject({
      value: 3,
      unit: "%",
      provenance: { provider: "local-astronomy", sourceType: "calculated" },
    });
    expect(snapshot.sources).toHaveLength(1);
    expect(snapshot.sources[0]).toMatchObject({
      provider: "local-astronomy",
      sourceType: "calculated",
      latitude: 54.1,
      longitude: 10.2,
      validAt: timestamp,
    });
  });
});
