import { calculateGlobeDistanceNm } from "../nautical/globe-distance";
import type { Position } from "../nautical/position";
import type { MeteoProvider, MeteoProviderContext } from "./provider";
import { createMeteoProvider } from "./provider";
import type { MeteoSource, MeteoValueProvenance } from "./types";

const metarEndpoint = "https://aviationweather.gov/api/data/metar";
const statuteMileToMeters = 1_609.344;
const inchesMercuryToHpa = 33.8638866667;

export type MetarProviderOptions = {
  fetcher?: typeof fetch;
  endpoint?: string;
  stationIds?: string[];
};

export type MetarObservation = Position & {
  stationId: string;
  rawText?: string;
  observedAt: Date;
  cloudCoverPercent?: number;
  condition?: string;
  pressureHpa?: number;
  temperatureC?: number;
  visibilityM?: number;
  windDirectionDeg?: number;
  windSpeedKnots?: number;
  windGustKnots?: number;
};

type AviationWeatherMetar = {
  icaoId?: string;
  rawOb?: string;
  obsTime?: string;
  lat?: number | string;
  lon?: number | string;
  wdir?: number | string;
  wspd?: number | string;
  wgst?: number | string;
  altim?: number | string;
  temp?: number | string;
  visib?: number | string;
  wxString?: string;
  clouds?: Array<{ cover?: string }>;
};

export function createMetarProvider(options: MetarProviderOptions = {}): MeteoProvider {
  const fetcher = options.fetcher ?? fetch;
  const endpoint = options.endpoint ?? metarEndpoint;
  const stationIds = options.stationIds ?? [];

  return createMeteoProvider({
    name: "metar",
    label: "AviationWeather METAR",
    sourceType: "observed",
    capabilities: { weather: true, wind: true },
    async getSnapshot(context) {
      if (stationIds.length === 0) {
        return { warnings: ["METAR provider requires configured station IDs before it can fetch observations."] };
      }

      const observations = await fetchMetarObservations(stationIds, fetcher, endpoint);
      const nearest = nearbyFreshObservations(observations, context)[0];
      if (!nearest) {
        return { warnings: ["No fresh METAR observation was found within the configured station distance."] };
      }

      const { observation, distanceNm } = nearest;
      const provenance = metarProvenance(observation, distanceNm);
      const source = metarSource(observation, distanceNm);

      return {
        validAt: observation.observedAt,
        weather: {
          cloudCoverPercent: value(observation.cloudCoverPercent, "%", provenance),
          condition: value(observation.condition, "text", provenance),
          pressureHpa: value(observation.pressureHpa, "hPa", provenance),
          temperatureC: value(observation.temperatureC, "c", provenance),
          visibilityM: value(observation.visibilityM, "m", provenance),
        },
        wind: {
          directionDeg: value(observation.windDirectionDeg, "deg", provenance),
          speedKnots: value(observation.windSpeedKnots, "kn", provenance),
          gustKnots: value(observation.windGustKnots, "kn", provenance),
        },
        sources: [source],
      };
    },
  });
}

export async function fetchMetarObservations(stationIds: string[], fetcher: typeof fetch = fetch, endpoint = metarEndpoint) {
  const url = new URL(endpoint);
  url.searchParams.set("ids", stationIds.join(","));
  url.searchParams.set("format", "json");

  const response = await fetcher(url);
  if (response.status === 204) return [];
  if (!response.ok) {
    throw new Error(`METAR request failed with status ${response.status}.`);
  }

  return parseMetarObservations(await response.json() as AviationWeatherMetar[]);
}

export function parseMetarObservations(reports: AviationWeatherMetar[]): MetarObservation[] {
  return reports.flatMap((report) => {
    const latitude = numberFrom(report.lat);
    const longitude = numberFrom(report.lon);
    const observedAt = report.obsTime ? new Date(report.obsTime) : undefined;
    if (!report.icaoId || latitude === undefined || longitude === undefined || !observedAt) return [];

    return [{
      stationId: report.icaoId,
      rawText: report.rawOb,
      latitude,
      longitude,
      observedAt,
      cloudCoverPercent: cloudCoverPercent(report.clouds),
      condition: report.wxString || report.rawOb,
      pressureHpa: pressureHpa(report.altim),
      temperatureC: numberFrom(report.temp),
      visibilityM: visibilityM(report.visib),
      windDirectionDeg: numberFrom(report.wdir),
      windSpeedKnots: numberFrom(report.wspd),
      windGustKnots: numberFrom(report.wgst),
    }];
  });
}

function nearbyFreshObservations(observations: MetarObservation[], context: MeteoProviderContext) {
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

function metarProvenance(observation: MetarObservation, distanceNm: number): MeteoValueProvenance {
  return {
    provider: "metar",
    providerLabel: "AviationWeather METAR",
    sourceType: "observed",
    sourceUrl: `${metarEndpoint}?ids=${observation.stationId}&format=json`,
    station: {
      id: observation.stationId,
      latitude: observation.latitude,
      longitude: observation.longitude,
      distanceNm,
    },
    observedAt: observation.observedAt,
    validAt: observation.observedAt,
    quality: "medium",
    qualityNote: "METAR data is airport-based and may not represent offshore vessel conditions.",
    raw: observation.rawText,
  };
}

function metarSource(observation: MetarObservation, distanceNm: number): MeteoSource {
  return {
    provider: "metar",
    providerLabel: "AviationWeather METAR",
    sourceType: "observed",
    sourceUrl: `${metarEndpoint}?ids=${observation.stationId}&format=json`,
    id: observation.stationId,
    latitude: observation.latitude,
    longitude: observation.longitude,
    observedAt: observation.observedAt,
    validAt: observation.observedAt,
    distanceNm,
    quality: "medium",
    qualityNote: "METAR data is airport-based and may not represent offshore vessel conditions.",
  };
}

function value<TValue, TUnit extends "%" | "c" | "deg" | "hPa" | "kn" | "m" | "text">(
  input: TValue | undefined,
  unit: TUnit,
  provenance: MeteoValueProvenance,
) {
  if (input === undefined) return undefined;
  return { value: input, unit, provenance };
}

function cloudCoverPercent(clouds: AviationWeatherMetar["clouds"]) {
  if (!clouds?.length) return undefined;
  return Math.max(...clouds.map((cloud) => cloudCoverValue(cloud.cover)).filter((value) => value !== undefined));
}

function cloudCoverValue(cover: string | undefined) {
  switch (cover) {
    case "CLR":
    case "SKC":
      return 0;
    case "FEW":
      return 25;
    case "SCT":
      return 50;
    case "BKN":
      return 75;
    case "OVC":
      return 100;
    default:
      return undefined;
  }
}

function pressureHpa(value: string | number | undefined) {
  const parsed = numberFrom(value);
  if (parsed === undefined) return undefined;
  return parsed > 100 ? parsed : parsed * inchesMercuryToHpa;
}

function visibilityM(value: string | number | undefined) {
  const parsed = numberFrom(value);
  if (parsed === undefined) return undefined;
  return parsed <= 100 ? parsed * statuteMileToMeters : parsed;
}

function numberFrom(value: string | number | undefined) {
  if (value === undefined || value === "" || value === "M") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
