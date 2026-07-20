import { calculateGlobeDistanceNm } from "../nautical/globe-distance";
import type { Position } from "../nautical/position";
import type { MeteoProvider, MeteoProviderContext } from "./provider";
import { createMeteoProvider } from "./provider";
import type { MeteoSource, MeteoValueProvenance } from "./types";

const latestObservationsUrl = "https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt";
const metersPerSecondToKnots = 1.9438444924406048;

export type NoaaNdbcProviderOptions = {
  fetcher?: typeof fetch;
  latestObservationsEndpoint?: string;
};

export type NoaaNdbcObservation = Position & {
  stationId: string;
  observedAt: Date;
  windDirectionDeg?: number;
  windSpeedKnots?: number;
  windGustKnots?: number;
  waveHeightM?: number;
  wavePeriodS?: number;
  waveDirectionDeg?: number;
  pressureHpa?: number;
  airTemperatureC?: number;
  seaSurfaceTemperatureC?: number;
  visibilityM?: number;
  tideM?: number;
};

export function createNoaaNdbcProvider(options: NoaaNdbcProviderOptions = {}): MeteoProvider {
  const fetcher = options.fetcher ?? fetch;
  const endpoint = options.latestObservationsEndpoint ?? latestObservationsUrl;

  return createMeteoProvider({
    name: "noaa-ndbc",
    label: "NOAA National Data Buoy Center",
    sourceType: "observed",
    capabilities: { weather: true, wind: true, sea: true, tide: true },
    async findStations(context) {
      const observations = await fetchLatestNoaaNdbcObservations(fetcher, endpoint);
      return nearbyFreshObservations(observations, context).map(({ observation, distanceNm }) => ({
        id: observation.stationId,
        latitude: observation.latitude,
        longitude: observation.longitude,
        distanceNm,
      }));
    },
    async getSnapshot(context) {
      const observations = await fetchLatestNoaaNdbcObservations(fetcher, endpoint);
      const nearest = nearbyFreshObservations(observations, context)[0];

      if (!nearest) {
        return { warnings: [{ code: "meteo.reason.noFreshNdbcObservation" }] };
      }

      const { observation, distanceNm } = nearest;
      const provenance = noaaNdbcProvenance(observation, distanceNm);
      const source = noaaNdbcSource(observation, distanceNm);

      return {
        validAt: observation.observedAt,
        weather: {
          pressureHpa: value(observation.pressureHpa, "hPa", provenance),
          temperatureC: value(observation.airTemperatureC, "c", provenance),
          visibilityM: value(observation.visibilityM, "m", provenance),
        },
        wind: {
          directionDeg: value(observation.windDirectionDeg, "deg", provenance),
          speedKnots: value(observation.windSpeedKnots, "kn", provenance),
          gustKnots: value(observation.windGustKnots, "kn", provenance),
        },
        sea: {
          waveHeightM: value(observation.waveHeightM, "m", provenance),
          waveDirectionDeg: value(observation.waveDirectionDeg, "deg", provenance),
          wavePeriodS: value(observation.wavePeriodS, "s", provenance),
          seaSurfaceTemperatureC: value(observation.seaSurfaceTemperatureC, "c", provenance),
        },
        tide: {
          heightM: value(observation.tideM, "m", provenance),
        },
        sources: [source],
      };
    },
  });
}

export async function fetchLatestNoaaNdbcObservations(fetcher: typeof fetch = fetch, endpoint = latestObservationsUrl) {
  const response = await fetcher(endpoint);
  if (!response.ok) {
    throw new Error(`NOAA NDBC latest observations request failed with status ${response.status}.`);
  }

  return parseNoaaNdbcLatestObservations(await response.text());
}

export function parseNoaaNdbcLatestObservations(text: string): NoaaNdbcObservation[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const headerLine = lines.find((line) => line.startsWith("#STN "));
  if (!headerLine) return [];

  const headers = headerLine.replace(/^#/, "").split(/\s+/);

  return lines
    .filter((line) => !line.startsWith("#"))
    .map((line) => parseNoaaNdbcLatestObservationLine(headers, line))
    .filter((observation): observation is NoaaNdbcObservation => observation !== undefined);
}

function parseNoaaNdbcLatestObservationLine(headers: string[], line: string): NoaaNdbcObservation | undefined {
  const columns = line.split(/\s+/);
  const row = Object.fromEntries(headers.map((header, index) => [header, columns[index]]));
  const latitude = numeric(row.LAT);
  const longitude = numeric(row.LON);
  const observedAt = observedAtFromRow(row);

  if (!row.STN || latitude === undefined || longitude === undefined || !observedAt) return undefined;

  return {
    stationId: row.STN,
    latitude,
    longitude,
    observedAt,
    windDirectionDeg: numeric(row.WDIR),
    windSpeedKnots: convert(row.WSPD, metersPerSecondToKnots),
    windGustKnots: convert(row.GST, metersPerSecondToKnots),
    waveHeightM: numeric(row.WVHT),
    wavePeriodS: numeric(row.DPD) ?? numeric(row.APD),
    waveDirectionDeg: numeric(row.MWD),
    pressureHpa: numeric(row.PRES, 2_000),
    airTemperatureC: numeric(row.ATMP),
    seaSurfaceTemperatureC: numeric(row.WTMP),
    visibilityM: convert(row.VIS, 1_000),
    tideM: numeric(row.TIDE),
  };
}

function nearbyFreshObservations(observations: NoaaNdbcObservation[], context: MeteoProviderContext) {
  const maxAgeMinutes = context.maxObservationAgeMinutes ?? 120;
  const maxDistanceNm = context.maxStationDistanceNm ?? 50;
  const requestedPosition = { latitude: context.latitude, longitude: context.longitude };

  return observations
    .map((observation) => ({
      observation,
      distanceNm: calculateGlobeDistanceNm(requestedPosition, observation),
      ageMinutes: Math.abs(context.timestamp.getTime() - observation.observedAt.getTime()) / 60_000,
    }))
    .filter(({ distanceNm, ageMinutes }) => distanceNm <= maxDistanceNm && ageMinutes <= maxAgeMinutes)
    .sort((left, right) => left.distanceNm - right.distanceNm || left.ageMinutes - right.ageMinutes);
}

function noaaNdbcProvenance(observation: NoaaNdbcObservation, distanceNm: number): MeteoValueProvenance {
  return {
    provider: "noaa-ndbc",
    providerLabel: "NOAA National Data Buoy Center",
    sourceType: "observed",
    sourceUrl: `${latestObservationsUrl}#${observation.stationId}`,
    station: {
      id: observation.stationId,
      latitude: observation.latitude,
      longitude: observation.longitude,
      distanceNm,
    },
    observedAt: observation.observedAt,
    validAt: observation.observedAt,
    quality: "high",
  };
}

function noaaNdbcSource(observation: NoaaNdbcObservation, distanceNm: number): MeteoSource {
  return {
    provider: "noaa-ndbc",
    providerLabel: "NOAA National Data Buoy Center",
    sourceType: "observed",
    sourceUrl: `${latestObservationsUrl}#${observation.stationId}`,
    id: observation.stationId,
    latitude: observation.latitude,
    longitude: observation.longitude,
    observedAt: observation.observedAt,
    validAt: observation.observedAt,
    distanceNm,
    quality: "high",
  };
}

function value<TValue, TUnit extends "c" | "deg" | "hPa" | "kn" | "m" | "s">(
  input: TValue | undefined,
  unit: TUnit,
  provenance: MeteoValueProvenance,
) {
  if (input === undefined) return undefined;
  return { value: input, unit, provenance };
}

function observedAtFromRow(row: Record<string, string | undefined>) {
  const year = numeric(row.YY ?? row.YYYY, Number.POSITIVE_INFINITY);
  const month = numeric(row.MM);
  const day = numeric(row.DD);
  const hour = numeric(row.hh);
  const minute = numeric(row.mm);
  if (year === undefined || month === undefined || day === undefined || hour === undefined || minute === undefined) return undefined;
  return new Date(Date.UTC(year, month - 1, day, hour, minute));
}

function convert(valueText: string | undefined, factor: number) {
  const value = numeric(valueText);
  return value === undefined ? undefined : value * factor;
}

function numeric(value: string | undefined, maximumValidValue = 999) {
  if (!value || value === "MM") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed < maximumValidValue ? parsed : undefined;
}
