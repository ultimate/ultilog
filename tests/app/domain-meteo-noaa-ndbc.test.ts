import { describe, expect, it } from "vitest";
import { createMeteoService, createNoaaNdbcProvider, parseNoaaNdbcLatestObservations } from "../../app/domain/meteo";

const latestObservations = `#STN LAT LON YYYY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP DEWP VIS PTDY TIDE
#text header ignored
44013 42.346 -70.651 2026 07 16 12 10 190 6.2 8.0 1.5 7 6.1 180 1013.2 21.4 18.7 19.0 10.0 -0.4 0.3
44008 40.503 -69.248 2026 07 16 11 40 200 4.1 5.3 MM MM MM MM 1014.1 20.1 17.9 MM MM MM MM
`;

describe("NOAA NDBC meteo provider", () => {
  it("parses latest observation rows into normalized units", () => {
    const observations = parseNoaaNdbcLatestObservations(latestObservations);

    expect(observations).toHaveLength(2);
    expect(observations[0]).toMatchObject({
      stationId: "44013",
      latitude: 42.346,
      longitude: -70.651,
      observedAt: new Date("2026-07-16T12:10:00Z"),
      windDirectionDeg: 190,
      waveHeightM: 1.5,
      pressureHpa: 1013.2,
      airTemperatureC: 21.4,
      seaSurfaceTemperatureC: 18.7,
      visibilityM: 10_000,
      tideM: 0.3,
    });
    expect(observations[0].windSpeedKnots).toBeCloseTo(12.052, 3);
    expect(observations[1].waveHeightM).toBeUndefined();
  });

  it("returns the nearest fresh observation with per-value provenance", async () => {
    const fetcher = async () => new Response(latestObservations);
    const service = createMeteoService({ providers: [createNoaaNdbcProvider({ fetcher })] });

    const snapshot = await service.getSnapshot({
      latitude: 42.35,
      longitude: -70.65,
      timestamp: new Date("2026-07-16T12:30:00Z"),
      maxObservationAgeMinutes: 60,
      maxStationDistanceNm: 20,
    });

    expect(snapshot.validAt).toEqual(new Date("2026-07-16T12:10:00Z"));
    expect(snapshot.wind?.speedKnots).toMatchObject({
      unit: "kn",
      provenance: {
        provider: "noaa-ndbc",
        providerLabel: "NOAA National Data Buoy Center",
        sourceType: "observed",
        station: { id: "44013" },
        observedAt: new Date("2026-07-16T12:10:00Z"),
        quality: "high",
      },
    });
    expect(snapshot.wind?.speedKnots?.value).toBeCloseTo(12.052, 3);
    expect(snapshot.weather?.pressureHpa?.value).toBe(1013.2);
    expect(snapshot.sea?.waveHeightM?.value).toBe(1.5);
    expect(snapshot.tide?.heightM?.value).toBe(0.3);
    expect(snapshot.sources).toHaveLength(1);
  });

  it("warns when no fresh nearby station is available", async () => {
    const fetcher = async () => new Response(latestObservations);
    const service = createMeteoService({ providers: [createNoaaNdbcProvider({ fetcher })] });

    await expect(service.getSnapshot({
      latitude: 10,
      longitude: 10,
      timestamp: new Date("2026-07-16T12:30:00Z"),
      maxStationDistanceNm: 5,
    })).resolves.toMatchObject({
      warnings: ["No fresh NOAA NDBC observation was found within the configured station distance."],
      sources: [],
    });
  });
});
