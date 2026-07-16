import { describe, expect, it } from "vitest";
import { createMeteoService, createNoaaCoopsProvider, parseNoaaCoopsStations } from "../../app/domain/meteo";

const stationsResponse = {
  stations: [
    { id: "9414290", name: "San Francisco", lat: "37.8063", lng: "-122.4659" },
    { id: "9414750", name: "Alameda", lat: "37.7717", lng: "-122.3000" },
    { id: "bad", name: "Broken" },
  ],
};

const waterLevelResponse = {
  data: [{ t: "2026-07-16 12:24", v: "1.234" }],
};

describe("NOAA CO-OPS meteo provider", () => {
  it("parses station metadata with positions", () => {
    expect(parseNoaaCoopsStations(stationsResponse)).toEqual([
      { id: "9414290", name: "San Francisco", latitude: 37.8063, longitude: -122.4659 },
      { id: "9414750", name: "Alameda", latitude: 37.7717, longitude: -122.3 },
    ]);
  });

  it("returns the nearest fresh observed water level with provenance", async () => {
    const fetcher = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("stations")) return Response.json(stationsResponse);
      return Response.json(waterLevelResponse);
    };
    const service = createMeteoService({ providers: [createNoaaCoopsProvider({ fetcher })] });

    const snapshot = await service.getSnapshot({
      latitude: 37.807,
      longitude: -122.466,
      timestamp: new Date("2026-07-16T12:30:00Z"),
      maxObservationAgeMinutes: 30,
      maxStationDistanceNm: 10,
    });

    expect(snapshot.validAt).toEqual(new Date("2026-07-16T12:24:00Z"));
    expect(snapshot.tide?.heightM).toMatchObject({
      value: 1.234,
      unit: "m",
      provenance: {
        provider: "noaa-coops",
        providerLabel: "NOAA Tides & Currents",
        sourceType: "observed",
        station: { id: "9414290", name: "San Francisco" },
        observedAt: new Date("2026-07-16T12:24:00Z"),
        quality: "high",
      },
    });
    expect(snapshot.sources).toHaveLength(1);
    expect(snapshot.sources[0]).toMatchObject({ id: "9414290", name: "San Francisco" });
  });

  it("warns when no nearby water-level station is available", async () => {
    const fetcher = async () => Response.json(stationsResponse);
    const service = createMeteoService({ providers: [createNoaaCoopsProvider({ fetcher })] });

    await expect(service.getSnapshot({
      latitude: 10,
      longitude: 10,
      timestamp: new Date("2026-07-16T12:30:00Z"),
      maxStationDistanceNm: 5,
    })).resolves.toMatchObject({
      warnings: ["No NOAA CO-OPS water-level station was found within the configured station distance."],
      sources: [],
    });
  });
});
