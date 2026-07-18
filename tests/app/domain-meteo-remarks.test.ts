import { describe, expect, it } from "vitest";
import { createMeteoSourceRemark, type MeteoSnapshot, type MeteoValueProvenance } from "../../app/domain/meteo";

const ndbcProvenance: MeteoValueProvenance = {
  provider: "noaa-ndbc",
  providerLabel: "NOAA National Data Buoy Center",
  sourceType: "observed",
  station: { id: "44013", latitude: 42.346, longitude: -70.651, distanceNm: 3.24 },
  observedAt: new Date("2026-07-18T12:10:00Z"),
  validAt: new Date("2026-07-18T12:10:00Z"),
};

const astronomyProvenance: MeteoValueProvenance = {
  provider: "local-astronomy",
  providerLabel: "Local astronomy calculation",
  sourceType: "calculated",
  calculatedAt: new Date("2026-07-18T12:30:00Z"),
  validAt: new Date("2026-07-18T12:30:00Z"),
};

const fallbackProvenance: MeteoValueProvenance = {
  provider: "open-meteo",
  providerLabel: "Open-Meteo",
  sourceType: "fallback",
  validAt: new Date("2026-07-18T12:00:00Z"),
};

describe("meteo source remarks", () => {
  it("groups fields that share the same provenance", () => {
    const snapshot: MeteoSnapshot = {
      requestedAt: new Date("2026-07-18T12:30:00Z"),
      validAt: new Date("2026-07-18T12:10:00Z"),
      position: { latitude: 42.35, longitude: -70.65 },
      mode: "auto",
      weather: {
        pressureHpa: { value: 1013.2, unit: "hPa", provenance: ndbcProvenance },
      },
      wind: {
        directionDeg: { value: 190, unit: "deg", provenance: ndbcProvenance },
        speedKnots: { value: 12, unit: "kn", provenance: ndbcProvenance },
      },
      astronomy: {
        moonPhase: { value: "waxing crescent", unit: "text", provenance: astronomyProvenance },
      },
      sources: [],
      warnings: [],
    };

    expect(createMeteoSourceRemark(snapshot)).toBe(
      "barometer, wind direction, and wind speed from NOAA National Data Buoy Center station 44013, 3.2 NM away (observed 2026-07-18T12:10:00Z). "
      + "moon phase from Local astronomy calculation (calculated 2026-07-18T12:30:00Z).",
    );
  });

  it("marks fallback estimates clearly", () => {
    const snapshot: MeteoSnapshot = {
      requestedAt: new Date("2026-07-18T12:30:00Z"),
      validAt: new Date("2026-07-18T12:00:00Z"),
      position: { latitude: 54.1, longitude: 10.2 },
      mode: "auto",
      weather: {
        cloudCoverPercent: { value: 40, unit: "%", provenance: fallbackProvenance },
      },
      sources: [],
      warnings: [],
    };

    expect(createMeteoSourceRemark(snapshot)).toBe(
      "cloud cover from Open-Meteo (fallback estimate 2026-07-18T12:00:00Z).",
    );
  });

  it("returns a clear message when no source metadata exists", () => {
    expect(createMeteoSourceRemark({
      requestedAt: new Date("2026-07-18T12:30:00Z"),
      validAt: new Date("2026-07-18T12:30:00Z"),
      position: { latitude: 54.1, longitude: 10.2 },
      mode: "auto",
      sources: [],
      warnings: [],
    })).toBe("No meteo source metadata available.");
  });
});
