import { describe, expect, it } from "vitest";
import { createFreeMeteoProviders, createFreeMeteoService, defaultFreeMeteoProviderOrder, defaultFreeMeteoRequestOptions } from "../../app/domain/meteo";

describe("free meteo service configuration", () => {
  it("builds free providers in the default priority order", () => {
    const providers = createFreeMeteoProviders({ metarStationIds: ["KSFO"] });

    expect(defaultFreeMeteoProviderOrder).toEqual([
      "noaa-ndbc",
      "noaa-coops",
      "metar",
      "local-astronomy",
      "open-meteo",
    ]);
    expect(providers.map((provider) => provider.name)).toEqual(defaultFreeMeteoProviderOrder);
  });

  it("allows provider subsets for scoped deployments and tests", () => {
    const providers = createFreeMeteoProviders({ enabledProviders: ["local-astronomy", "open-meteo"] });

    expect(providers.map((provider) => provider.name)).toEqual(["local-astronomy", "open-meteo"]);
  });

  it("applies default request thresholds before calling providers", async () => {
    const service = createFreeMeteoService({
      enabledProviders: ["local-astronomy"],
      maxObservationAgeMinutes: 45,
      maxStationDistanceNm: 12,
      allowFallbackEstimate: false,
    });

    const snapshot = await service.getSnapshot({
      latitude: 54.1,
      longitude: 10.2,
      timestamp: new Date("2026-07-16T12:00:00Z"),
    });

    expect(defaultFreeMeteoRequestOptions).toEqual({
      maxObservationAgeMinutes: 120,
      maxStationDistanceNm: 50,
      allowFallbackEstimate: true,
    });
    expect(snapshot.astronomy?.moonPhase?.provenance).toMatchObject({
      provider: "local-astronomy",
      sourceType: "calculated",
    });
  });

  it("keeps observed-only mode from enabling fallback estimates", async () => {
    const service = createFreeMeteoService({ enabledProviders: ["open-meteo"] });

    await expect(service.getSnapshot({
      latitude: 54.1,
      longitude: 10.2,
      timestamp: new Date("2026-07-16T12:00:00Z"),
      mode: "observed-only",
    })).resolves.toMatchObject({
      warnings: ["Open-Meteo fallback was skipped because estimated data is not allowed."],
    });
  });
});
