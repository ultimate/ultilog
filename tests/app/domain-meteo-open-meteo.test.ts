import { describe, expect, it } from "vitest";
import { createMeteoService, createOpenMeteoProvider } from "../../app/domain/meteo";

const weatherResponse = {
  current: {
    time: "2026-07-16T12:00",
    temperature_2m: 22.4,
    relative_humidity_2m: 68,
    precipitation: 0.2,
    weather_code: 2,
    cloud_cover: 40,
    pressure_msl: 1012.8,
    surface_pressure: 1008.1,
    wind_speed_10m: 11.5,
    wind_direction_10m: 285,
    wind_gusts_10m: 18.2,
  },
};

const marineResponse = {
  current: {
    time: "2026-07-16T12:00",
    wave_height: 1.2,
    wave_direction: 270,
    wave_period: 6,
    swell_wave_height: 0.8,
    swell_wave_direction: 260,
    swell_wave_period: 9,
  },
};

describe("Open-Meteo fallback provider", () => {
  it("returns estimated weather, wind, and sea values with fallback provenance", async () => {
    const fetcher = async (input: RequestInfo | URL) => {
      const url = String(input);
      return Response.json(url.includes("marine") ? marineResponse : weatherResponse);
    };
    const service = createMeteoService({ providers: [createOpenMeteoProvider({ fetcher })] });

    const snapshot = await service.getSnapshot({
      latitude: 54.1,
      longitude: 10.2,
      timestamp: new Date("2026-07-16T12:30:00Z"),
    });

    expect(snapshot.validAt).toEqual(new Date("2026-07-16T12:00:00Z"));
    expect(snapshot.weather?.condition?.value).toBe("partly cloudy");
    expect(snapshot.weather?.cloudCoverPercent).toMatchObject({
      value: 40,
      unit: "%",
      provenance: {
        provider: "open-meteo",
        providerLabel: "Open-Meteo",
        sourceType: "fallback",
        station: { id: "open-meteo-grid-point", distanceNm: 0 },
        quality: "low",
      },
    });
    expect(snapshot.wind?.speedKnots?.value).toBe(11.5);
    expect(snapshot.sea?.waveHeightM?.value).toBe(1.2);
    expect(snapshot.sources).toHaveLength(2);
    expect(snapshot.warnings).toEqual([
      "Open-Meteo values are fallback estimates and should be replaced by fresh observations when available.",
    ]);
  });

  it("skips fallback estimates when estimated data is not allowed", async () => {
    const service = createMeteoService({ providers: [createOpenMeteoProvider()] });

    await expect(service.getSnapshot({
      latitude: 54.1,
      longitude: 10.2,
      timestamp: new Date("2026-07-16T12:30:00Z"),
      mode: "observed-only",
    })).resolves.toMatchObject({
      warnings: ["Open-Meteo fallback was skipped because estimated data is not allowed."],
      sources: [],
    });
  });
});
