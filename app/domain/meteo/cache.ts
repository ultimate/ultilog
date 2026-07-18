import type { MeteoProvider, MeteoProviderContext, MeteoProviderSnapshot, MeteoProviderStation } from "./provider";

export type MeteoProviderCacheOptions = {
  ttlMs: number;
  timestampBucketMs?: number;
  coordinatePrecision?: number;
  now?: () => number;
};

type CacheEntry<TValue> = {
  expiresAt: number;
  value: Promise<TValue>;
};

const defaultTimestampBucketMs = 15 * 60 * 1_000;
const defaultCoordinatePrecision = 3;

export function createCachedMeteoProvider(provider: MeteoProvider, options: MeteoProviderCacheOptions): MeteoProvider {
  const now = options.now ?? Date.now;
  const stationCache = new Map<string, CacheEntry<MeteoProviderStation[]>>();
  const snapshotCache = new Map<string, CacheEntry<MeteoProviderSnapshot>>();

  return {
    ...provider,
    findStations: provider.findStations
      ? (request) => readThroughCache(stationCache, cacheKey(provider.name, "stations", request, options), now, options.ttlMs, () => provider.findStations?.(request) ?? Promise.resolve([]))
      : undefined,
    getSnapshot(request) {
      return readThroughCache(snapshotCache, cacheKey(provider.name, "snapshot", request, options), now, options.ttlMs, () => provider.getSnapshot(request));
    },
  };
}

function readThroughCache<TValue>(
  cache: Map<string, CacheEntry<TValue>>,
  key: string,
  now: () => number,
  ttlMs: number,
  load: () => Promise<TValue>,
) {
  const currentTime = now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > currentTime) return cached.value;

  const value = load();
  cache.set(key, { value, expiresAt: currentTime + ttlMs });
  value.catch(() => cache.delete(key));
  return value;
}

function cacheKey(providerName: string, operation: string, request: MeteoProviderContext, options: MeteoProviderCacheOptions) {
  const precision = options.coordinatePrecision ?? defaultCoordinatePrecision;
  const timestampBucketMs = options.timestampBucketMs ?? defaultTimestampBucketMs;
  const timestampBucket = Math.floor(request.timestamp.getTime() / timestampBucketMs);

  return JSON.stringify({
    providerName,
    operation,
    latitude: request.latitude.toFixed(precision),
    longitude: request.longitude.toFixed(precision),
    timestampBucket,
    mode: request.mode,
    maxObservationAgeMinutes: request.maxObservationAgeMinutes,
    maxStationDistanceNm: request.maxStationDistanceNm,
    allowFallbackEstimate: request.allowFallbackEstimate,
  });
}
