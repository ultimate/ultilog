import { describe, expect, it } from "vitest";
import { meteoSnapshotToLogLineAutofill, type MeteoSnapshot, type MeteoValueProvenance } from "../../app/domain/meteo";

const observedProvenance: MeteoValueProvenance = {
  provider: "noaa-ndbc",
  sourceType: "observed",
  station: { id: "44013", latitude: 42.346, longitude: -70.651, distanceNm: 3.2 },
  observedAt: new Date("2026-07-18T12:10:00Z"),
};

const calculatedProvenance: MeteoValueProvenance = {
  provider: "local-astronomy",
  sourceType: "calculated",
  calculatedAt: new Date("2026-07-18T12:30:00Z"),
};

const snapshot: MeteoSnapshot = {
  requestedAt: new Date("2026-07-18T12:30:00Z"),
  validAt: new Date("2026-07-18T12:10:00Z"),
  position: { latitude: 42.35, longitude: -70.65 },
  mode: "auto",
  weather: {
    cloudCoverPercent: { value: 35, unit: "%", provenance: observedProvenance },
    pressureHpa: { value: 1013.2, unit: "hPa", provenance: observedProvenance },
    temperatureC: { value: 21.4, unit: "c", provenance: observedProvenance },
  },
  wind: {
    directionDeg: { value: 190, unit: "deg", provenance: observedProvenance },
    speedKnots: { value: 12.1, unit: "kn", provenance: observedProvenance },
  },
  sea: {
    waveHeightM: { value: 1.5, unit: "m", provenance: observedProvenance },
  },
  tide: {
    heightM: { value: 0.3, unit: "m", provenance: observedProvenance },
  },
  astronomy: {
    moonPhase: { value: "waxing crescent", unit: "text", provenance: calculatedProvenance },
  },
  sources: [],
  warnings: [],
};

describe("meteo log-line autofill", () => {
  it("maps a meteo snapshot into log line weather fields", () => {
    const autofill = meteoSnapshotToLogLineAutofill(snapshot);

    expect(autofill.fields).toMatchObject({
      weather: "🌤️",
      temperature: "21",
      temperatureUnit: "°C",
      barometer: "1013",
      windDirection: "S",
      windStrength: "4",
      windUnit: "bft",
      waves: "1.5",
      seaUnit: "m",
      tide: "0.3",
      tideUnit: "m",
      moon: "🌒",
    });
    expect(autofill.remarkParts[0]).toMatchObject({
      fields: ["cloudCover", "barometer", "temperature", "windDirection", "windSpeed", "waveHeight", "tideHeight"],
    });
  });

  it("respects user unit preferences", () => {
    expect(meteoSnapshotToLogLineAutofill(snapshot, {
      temperatureUnit: "°F",
      windUnit: "kn",
      seaUnit: "ft",
      tideUnit: "ft",
    }).fields).toMatchObject({
      temperature: "71",
      temperatureUnit: "°F",
      windStrength: "12.1",
      windUnit: "kn",
      waves: "4.9",
      seaUnit: "ft",
      tide: "1",
      tideUnit: "ft",
    });
  });

  it("uses translated-later remark parts rather than filling an English weather remark", () => {
    const autofill = meteoSnapshotToLogLineAutofill(snapshot);

    expect(autofill.fields.weatherRemark).toBeUndefined();
    expect(autofill.remarkParts[0]).toMatchObject({
      fields: expect.arrayContaining(["barometer", "windSpeed"]),
      provenance: { provider: "noaa-ndbc", sourceType: "observed" },
    });
  });
});
