import { describe, expect, it } from "vitest";
import { createMetarProvider, createMeteoService, parseMetarObservations } from "../../app/domain/meteo";

const metarReports = [{
  icaoId: "KSFO",
  rawOb: "KSFO 161256Z 28012G18KT 10SM SCT020 BKN040 17/12 A2992",
  obsTime: "2026-07-16T12:56:00Z",
  lat: 37.619,
  lon: -122.375,
  wdir: 280,
  wspd: 12,
  wgst: 18,
  altim: 29.92,
  temp: 17,
  visib: 10,
  wxString: "VFR",
  clouds: [{ cover: "SCT" }, { cover: "BKN" }],
}, {
  icaoId: "KOAK",
  rawOb: "KOAK 161253Z 27008KT 10SM FEW015 18/12 A2993",
  obsTime: "2026-07-16T12:53:00Z",
  lat: 37.721,
  lon: -122.221,
  wdir: 270,
  wspd: 8,
  altim: 1013.5,
  temp: 18,
  visib: 10,
  clouds: [{ cover: "FEW" }],
}];

describe("METAR meteo provider", () => {
  it("parses aviation weather METAR JSON into normalized observations", () => {
    const observations = parseMetarObservations(metarReports);

    expect(observations).toHaveLength(2);
    expect(observations[0]).toMatchObject({
      stationId: "KSFO",
      latitude: 37.619,
      longitude: -122.375,
      observedAt: new Date("2026-07-16T12:56:00Z"),
      cloudCoverPercent: 75,
      condition: "VFR",
      temperatureC: 17,
      visibilityM: 16_093.44,
      windDirectionDeg: 280,
      windSpeedKnots: 12,
      windGustKnots: 18,
    });
    expect(observations[0].pressureHpa).toBeCloseTo(1013.207, 3);
    expect(observations[1].pressureHpa).toBe(1013.5);
  });

  it("returns nearest fresh METAR weather and wind values with provenance", async () => {
    const fetcher = async () => Response.json(metarReports);
    const service = createMeteoService({ providers: [createMetarProvider({ fetcher, stationIds: ["KSFO", "KOAK"] })] });

    const snapshot = await service.getSnapshot({
      latitude: 37.62,
      longitude: -122.38,
      timestamp: new Date("2026-07-16T13:00:00Z"),
      maxObservationAgeMinutes: 30,
      maxStationDistanceNm: 20,
    });

    expect(snapshot.validAt).toEqual(new Date("2026-07-16T12:56:00Z"));
    expect(snapshot.weather?.cloudCoverPercent?.value).toBe(75);
    expect(snapshot.weather?.pressureHpa?.value).toBeCloseTo(1013.207, 3);
    expect(snapshot.wind?.speedKnots).toMatchObject({
      value: 12,
      unit: "kn",
      provenance: {
        provider: "metar",
        providerLabel: "AviationWeather METAR",
        sourceType: "observed",
        station: { id: "KSFO" },
        quality: "medium",
      },
    });
    expect(snapshot.sources).toHaveLength(1);
  });

  it("warns when station IDs are not configured", async () => {
    const service = createMeteoService({ providers: [createMetarProvider()] });

    await expect(service.getSnapshot({
      latitude: 37.62,
      longitude: -122.38,
      timestamp: new Date("2026-07-16T13:00:00Z"),
    })).resolves.toMatchObject({
      warnings: [{ code: "meteo.reason.metarStationIdsRequired" }],
      sources: [],
    });
  });
});
