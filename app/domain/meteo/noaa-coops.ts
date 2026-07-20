import { calculateGlobeDistanceNm } from "../nautical/globe-distance";
import type { Position } from "../nautical/position";
import type { MeteoProvider, MeteoProviderContext } from "./provider";
import { createMeteoProvider } from "./provider";
import type { MeteoSource, MeteoValueProvenance } from "./types";

const dataApiEndpoint = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";
const stationsEndpoint = "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=waterlevels";

export type NoaaCoopsProviderOptions = {
  fetcher?: typeof fetch;
  dataEndpoint?: string;
  stationsEndpoint?: string;
};

export type NoaaCoopsStation = Position & {
  id: string;
  name?: string;
};

type NoaaCoopsStationResponse = {
  stations?: Array<{
    id?: string;
    name?: string;
    lat?: string | number;
    lng?: string | number;
  }>;
};

type NoaaCoopsDataResponse = {
  data?: Array<{ t?: string; v?: string }>;
  predictions?: Array<{ t?: string; v?: string }>;
  error?: { message?: string };
};

export function createNoaaCoopsProvider(options: NoaaCoopsProviderOptions = {}): MeteoProvider {
  const fetcher = options.fetcher ?? fetch;
  const stationSource = options.stationsEndpoint ?? stationsEndpoint;
  const dataSource = options.dataEndpoint ?? dataApiEndpoint;

  return createMeteoProvider({
    name: "noaa-coops",
    label: "NOAA Tides & Currents",
    sourceType: "observed",
    capabilities: { tide: true },
    async findStations(context) {
      const stations = await fetchNoaaCoopsStations(fetcher, stationSource);
      return nearbyStations(stations, context).map(({ station, distanceNm }) => ({ ...station, distanceNm }));
    },
    async getSnapshot(context) {
      const stations = await fetchNoaaCoopsStations(fetcher, stationSource);
      const nearest = nearbyStations(stations, context)[0];

      if (!nearest) {
        return { warnings: [{ code: "meteo.reason.noCoopsStationNearby" }] };
      }

      const { station, distanceNm } = nearest;
      const waterLevel = await fetchNoaaCoopsWaterLevel(station.id, context, fetcher, dataSource);
      if (!waterLevel) {
        return { warnings: [{ code: "meteo.reason.noCoopsWaterLevel", values: { stationId: station.id } }] };
      }

      const provenance = noaaCoopsProvenance(station, distanceNm, waterLevel.observedAt);
      const source = noaaCoopsSource(station, distanceNm, waterLevel.observedAt);

      return {
        validAt: waterLevel.observedAt,
        tide: {
          heightM: {
            value: waterLevel.heightM,
            unit: "m",
            provenance,
          },
        },
        sources: [source],
      };
    },
  });
}

export async function fetchNoaaCoopsStations(fetcher: typeof fetch = fetch, endpoint = stationsEndpoint): Promise<NoaaCoopsStation[]> {
  const response = await fetcher(endpoint);
  if (!response.ok) {
    throw new Error(`NOAA CO-OPS stations request failed with status ${response.status}.`);
  }

  return parseNoaaCoopsStations(await response.json() as NoaaCoopsStationResponse);
}

export function parseNoaaCoopsStations(response: NoaaCoopsStationResponse): NoaaCoopsStation[] {
  return (response.stations ?? []).flatMap((station) => {
    const latitude = numberFrom(station.lat);
    const longitude = numberFrom(station.lng);
    if (!station.id || latitude === undefined || longitude === undefined) return [];

    return [{
      id: station.id,
      name: station.name,
      latitude,
      longitude,
    }];
  });
}

async function fetchNoaaCoopsWaterLevel(stationId: string, context: MeteoProviderContext, fetcher: typeof fetch, endpoint: string) {
  const url = new URL(endpoint);
  url.searchParams.set("station", stationId);
  url.searchParams.set("product", "water_level");
  url.searchParams.set("application", "ultilog");
  url.searchParams.set("date", "latest");
  url.searchParams.set("datum", "MLLW");
  url.searchParams.set("time_zone", "gmt");
  url.searchParams.set("units", "metric");
  url.searchParams.set("format", "json");

  const response = await fetcher(url);
  if (!response.ok) {
    throw new Error(`NOAA CO-OPS water-level request failed with status ${response.status}.`);
  }

  const body = await response.json() as NoaaCoopsDataResponse;
  if (body.error?.message) {
    throw new Error(`NOAA CO-OPS water-level request failed: ${body.error.message}`);
  }

  const latest = body.data?.[0];
  const heightM = numberFrom(latest?.v);
  const observedAt = latest?.t ? new Date(`${latest.t.replace(" ", "T")}Z`) : undefined;
  if (heightM === undefined || !observedAt) return undefined;

  const maxAgeMinutes = context.maxObservationAgeMinutes ?? 120;
  const ageMinutes = Math.abs(context.timestamp.getTime() - observedAt.getTime()) / 60_000;
  if (ageMinutes > maxAgeMinutes) return undefined;

  return { heightM, observedAt };
}

function nearbyStations(stations: NoaaCoopsStation[], context: MeteoProviderContext) {
  const maxDistanceNm = context.maxStationDistanceNm ?? 50;
  const requestedPosition = { latitude: context.latitude, longitude: context.longitude };

  return stations
    .map((station) => ({ station, distanceNm: calculateGlobeDistanceNm(requestedPosition, station) }))
    .filter(({ distanceNm }) => distanceNm <= maxDistanceNm)
    .sort((left, right) => left.distanceNm - right.distanceNm);
}

function noaaCoopsProvenance(station: NoaaCoopsStation, distanceNm: number, observedAt: Date): MeteoValueProvenance {
  return {
    provider: "noaa-coops",
    providerLabel: "NOAA Tides & Currents",
    sourceType: "observed",
    sourceUrl: `https://tidesandcurrents.noaa.gov/stationhome.html?id=${station.id}`,
    station: { ...station, distanceNm },
    observedAt,
    validAt: observedAt,
    quality: "high",
  };
}

function noaaCoopsSource(station: NoaaCoopsStation, distanceNm: number, observedAt: Date): MeteoSource {
  return {
    provider: "noaa-coops",
    providerLabel: "NOAA Tides & Currents",
    sourceType: "observed",
    sourceUrl: `https://tidesandcurrents.noaa.gov/stationhome.html?id=${station.id}`,
    id: station.id,
    name: station.name,
    latitude: station.latitude,
    longitude: station.longitude,
    observedAt,
    validAt: observedAt,
    distanceNm,
    quality: "high",
  };
}

function numberFrom(value: string | number | undefined) {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
