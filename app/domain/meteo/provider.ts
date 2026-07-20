import type { Position } from "../nautical/position";
import type {
  MeteoProviderName,
  MeteoSea,
  MeteoService,
  MeteoSnapshot,
  MeteoSnapshotRequest,
  MeteoSource,
  MeteoSourceType,
  MeteoTide,
  MeteoWeather,
  MeteoWind,
  MeteoAstronomy,
  MeteoValue,
  MeteoReason,
} from "./types";

export type MeteoCapability = "weather" | "wind" | "sea" | "tide" | "astronomy";

export type MeteoProviderCapabilities = Record<MeteoCapability, boolean>;

export type MeteoProviderStation = Position & {
  id: string;
  name?: string;
  distanceNm?: number;
};

export type MeteoProviderSnapshot = Partial<Pick<MeteoSnapshot, "weather" | "wind" | "sea" | "tide" | "astronomy">> & {
  validAt?: Date;
  sources?: MeteoSource[];
  warnings?: MeteoReason[];
};

export type MeteoProviderContext = Required<Pick<MeteoSnapshotRequest, "mode" | "timestamp" | "allowFallbackEstimate">> & MeteoSnapshotRequest;

export type MeteoProvider = {
  name: MeteoProviderName;
  label?: string;
  sourceType: MeteoSourceType;
  capabilities: MeteoProviderCapabilities;
  findStations?: (request: MeteoProviderContext) => Promise<MeteoProviderStation[]>;
  getSnapshot: (request: MeteoProviderContext) => Promise<MeteoProviderSnapshot>;
};

export type MeteoServiceOptions = {
  providers: MeteoProvider[];
};

const emptyCapabilities: MeteoProviderCapabilities = {
  weather: false,
  wind: false,
  sea: false,
  tide: false,
  astronomy: false,
};

export function createMeteoProvider(
  provider: Omit<MeteoProvider, "capabilities"> & { capabilities?: Partial<MeteoProviderCapabilities> },
): MeteoProvider {
  return {
    ...provider,
    capabilities: { ...emptyCapabilities, ...provider.capabilities },
  };
}

export function createMeteoService({ providers }: MeteoServiceOptions): MeteoService {
  return {
    async getSnapshot(request) {
      const context = normalizeRequest(request);
      const enabledProviders = selectProviders(providers, context);
      const fragments = await Promise.all(enabledProviders.map((provider) => provider.getSnapshot(context)));

      return fragments.reduce<MeteoSnapshot>((snapshot, fragment) => mergeSnapshotFragment(snapshot, fragment), {
        requestedAt: new Date(),
        validAt: context.timestamp,
        position: { latitude: context.latitude, longitude: context.longitude },
        mode: context.mode,
        sources: [],
        warnings: [],
      });
    },
  };
}

function normalizeRequest(request: MeteoSnapshotRequest): MeteoProviderContext {
  const mode = request.mode ?? "auto";
  return {
    ...request,
    timestamp: request.timestamp ?? new Date(),
    mode,
    allowFallbackEstimate: request.allowFallbackEstimate ?? mode !== "observed-only",
  };
}

function selectProviders(providers: MeteoProvider[], request: MeteoProviderContext) {
  if (!request.preferredProviders?.length) return providers;
  const preferred = new Set(request.preferredProviders);
  return providers.filter((provider) => preferred.has(provider.name));
}

function mergeSnapshotFragment(snapshot: MeteoSnapshot, fragment: MeteoProviderSnapshot): MeteoSnapshot {
  return {
    ...snapshot,
    validAt: fragment.validAt ?? snapshot.validAt,
    weather: mergeSection(snapshot.weather, fragment.weather),
    wind: mergeSection(snapshot.wind, fragment.wind),
    sea: mergeSection(snapshot.sea, fragment.sea),
    tide: mergeSection(snapshot.tide, fragment.tide),
    astronomy: mergeSection(snapshot.astronomy, fragment.astronomy),
    sources: [...snapshot.sources, ...(fragment.sources ?? [])],
    warnings: [...snapshot.warnings, ...(fragment.warnings ?? [])],
  };
}

function mergeSection<TSection extends MeteoWeather | MeteoWind | MeteoSea | MeteoTide | MeteoAstronomy>(
  current: TSection | undefined,
  incoming: TSection | undefined,
) {
  if (!incoming) return current;
  if (!current) return incoming;

  const merged = { ...current } as Record<string, MeteoValue<unknown> | undefined>;
  for (const [key, incomingValue] of Object.entries(incoming) as Array<[string, MeteoValue<unknown> | undefined]>) {
    merged[key] = selectBestValue(merged[key], incomingValue);
  }

  return merged as TSection;
}

const sourceTypeRank: Record<MeteoSourceType, number> = {
  observed: 5,
  calculated: 4,
  predicted: 3,
  estimated: 2,
  fallback: 1,
};

function selectBestValue<TValue extends MeteoValue<unknown> | undefined>(current: TValue, incoming: TValue) {
  if (!incoming) return current;
  if (!current) return incoming;

  const currentRank = sourceTypeRank[current.provenance.sourceType];
  const incomingRank = sourceTypeRank[incoming.provenance.sourceType];
  return incomingRank > currentRank ? incoming : current;
}
