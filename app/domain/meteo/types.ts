import type { Position } from "../nautical/position";

export type MeteoSnapshotMode = "auto" | "observed-only" | "allow-estimated";

export type MeteoProviderName =
  | "auto"
  | "noaa-ndbc"
  | "noaa-coops"
  | "metar"
  | "open-meteo"
  | "local-astronomy"
  | string;

export type MeteoSourceType = "observed" | "calculated" | "predicted" | "estimated" | "fallback";

export type MeteoQuality = "high" | "medium" | "low" | "unknown";

export type MeteoUnit =
  | "%"
  | "bft"
  | "c"
  | "deg"
  | "hPa"
  | "kn"
  | "m"
  | "mm"
  | "s"
  | "text";

export type MeteoSource = Position & {
  provider: MeteoProviderName;
  sourceType: MeteoSourceType;
  id?: string;
  name?: string;
  observedAt?: Date;
  distanceNm?: number;
  quality?: MeteoQuality;
};

export type MeteoValue<TValue, TUnit extends MeteoUnit = MeteoUnit> = {
  value: TValue;
  unit?: TUnit;
  source: MeteoSource;
};

export type MeteoSnapshotRequest = Position & {
  timestamp?: Date;
  mode?: MeteoSnapshotMode;
  maxObservationAgeMinutes?: number;
  maxStationDistanceNm?: number;
  preferredProviders?: MeteoProviderName[];
  allowFallbackEstimate?: boolean;
};

export type MeteoWeather = {
  cloudCoverPercent?: MeteoValue<number, "%">;
  condition?: MeteoValue<string, "text">;
  pressureHpa?: MeteoValue<number, "hPa">;
  temperatureC?: MeteoValue<number, "c">;
  humidityPercent?: MeteoValue<number, "%">;
  precipitationMm?: MeteoValue<number, "mm">;
  visibilityM?: MeteoValue<number, "m">;
};

export type MeteoWind = {
  directionDeg?: MeteoValue<number, "deg">;
  speedKnots?: MeteoValue<number, "kn">;
  gustKnots?: MeteoValue<number, "kn">;
  beaufort?: MeteoValue<number, "bft">;
};

export type MeteoSea = {
  waveHeightM?: MeteoValue<number, "m">;
  waveDirectionDeg?: MeteoValue<number, "deg">;
  wavePeriodS?: MeteoValue<number, "s">;
  swellHeightM?: MeteoValue<number, "m">;
  swellDirectionDeg?: MeteoValue<number, "deg">;
  swellPeriodS?: MeteoValue<number, "s">;
  seaSurfaceTemperatureC?: MeteoValue<number, "c">;
  currentSpeedKnots?: MeteoValue<number, "kn">;
  currentDirectionDeg?: MeteoValue<number, "deg">;
};

export type MeteoTide = {
  heightM?: MeteoValue<number, "m">;
  phase?: MeteoValue<string, "text">;
};

export type MeteoAstronomy = {
  moonPhase?: MeteoValue<string, "text">;
  moonIlluminationPercent?: MeteoValue<number, "%">;
  sunrise?: MeteoValue<Date>;
  sunset?: MeteoValue<Date>;
  moonrise?: MeteoValue<Date>;
  moonset?: MeteoValue<Date>;
};

export type MeteoSnapshot = {
  requestedAt: Date;
  forecastFor: Date;
  position: Position;
  mode: MeteoSnapshotMode;
  weather?: MeteoWeather;
  wind?: MeteoWind;
  sea?: MeteoSea;
  tide?: MeteoTide;
  astronomy?: MeteoAstronomy;
  sources: MeteoSource[];
  warnings: string[];
};

export type MeteoService = {
  getSnapshot(request: MeteoSnapshotRequest): Promise<MeteoSnapshot>;
};
