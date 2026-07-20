import { createCachedMeteoProvider } from "./cache";
import { createLocalAstronomyProvider } from "./local-astronomy";
import { createMetarProvider } from "./metar";
import { createNoaaCoopsProvider } from "./noaa-coops";
import { createNoaaNdbcProvider } from "./noaa-ndbc";
import { createOpenMeteoProvider } from "./open-meteo";
import { createMeteoService, type MeteoProvider, type MeteoServiceOptions } from "./provider";
import type { MeteoService, MeteoSnapshotRequest } from "./types";

export type FreeMeteoProviderName = "noaa-ndbc" | "noaa-coops" | "metar" | "local-astronomy" | "open-meteo";

export type FreeMeteoServiceOptions = {
  fetcher?: typeof fetch;
  enabledProviders?: FreeMeteoProviderName[];
  metarStationIds?: string[];
  maxObservationAgeMinutes?: number;
  maxStationDistanceNm?: number;
  allowFallbackEstimate?: boolean;
  cacheTtlMs?: number;
};

export const defaultFreeMeteoProviderOrder: FreeMeteoProviderName[] = [
  "noaa-ndbc",
  "noaa-coops",
  "metar",
  "local-astronomy",
  "open-meteo",
];

export const defaultFreeMeteoRequestOptions = {
  maxObservationAgeMinutes: 120,
  maxStationDistanceNm: 50,
  allowFallbackEstimate: true,
} as const;

export function createFreeMeteoService(options: FreeMeteoServiceOptions = {}): MeteoService {
  const providers = createFreeMeteoProviders(options);
  return withDefaultRequestOptions(createMeteoService({ providers }), options);
}

export function createFreeMeteoProviders(options: FreeMeteoServiceOptions = {}): MeteoProvider[] {
  const enabledProviders = options.enabledProviders ?? defaultFreeMeteoProviderOrder;
  const enabled = new Set(enabledProviders);
  const providerFactories: Record<FreeMeteoProviderName, () => MeteoProvider> = {
    "noaa-ndbc": () => createNoaaNdbcProvider({ fetcher: options.fetcher }),
    "noaa-coops": () => createNoaaCoopsProvider({ fetcher: options.fetcher }),
    metar: () => createMetarProvider({ fetcher: options.fetcher, stationIds: options.metarStationIds }),
    "local-astronomy": createLocalAstronomyProvider,
    "open-meteo": () => createOpenMeteoProvider({ fetcher: options.fetcher }),
  };

  const providers = defaultFreeMeteoProviderOrder
    .filter((providerName) => enabled.has(providerName))
    .map((providerName) => providerFactories[providerName]());

  if (!options.cacheTtlMs) return providers;
  return providers.map((provider) => createCachedMeteoProvider(provider, { ttlMs: options.cacheTtlMs ?? 0 }));
}

function withDefaultRequestOptions(service: MeteoService, options: FreeMeteoServiceOptions): MeteoService {
  return {
    getSnapshot(request) {
      return service.getSnapshot(applyDefaultRequestOptions(request, options));
    },
  };
}

function applyDefaultRequestOptions(request: MeteoSnapshotRequest, options: FreeMeteoServiceOptions): MeteoSnapshotRequest {
  const mode = request.mode ?? "auto";
  return {
    ...request,
    mode,
    maxObservationAgeMinutes: request.maxObservationAgeMinutes ?? options.maxObservationAgeMinutes ?? defaultFreeMeteoRequestOptions.maxObservationAgeMinutes,
    maxStationDistanceNm: request.maxStationDistanceNm ?? options.maxStationDistanceNm ?? defaultFreeMeteoRequestOptions.maxStationDistanceNm,
    allowFallbackEstimate: request.allowFallbackEstimate ?? options.allowFallbackEstimate ?? mode !== "observed-only",
  };
}


export type { MeteoServiceOptions };
