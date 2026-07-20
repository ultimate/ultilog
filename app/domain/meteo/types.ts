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

export type MeteoReasonCode =
  | "meteo.reason.noFreshNdbcObservation"
  | "meteo.reason.noCoopsStationNearby"
  | "meteo.reason.noCoopsWaterLevel"
  | "meteo.reason.metarStationIdsRequired"
  | "meteo.reason.noFreshMetarObservation"
  | "meteo.reason.openMeteoFallbackSkipped"
  | "meteo.reason.openMeteoFallbackEstimate"
  | "meteo.reason.localAstronomyCalculated"
  | "meteo.reason.metarAirportBased";

export type MeteoReason = {
  code: MeteoReasonCode;
  values?: Record<string, string | number>;
};

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

export type MeteoProviderReference = {
  provider: MeteoProviderName;
  providerLabel?: string;
  sourceType: MeteoSourceType;
  sourceUrl?: string;
};

export type MeteoStationReference = Position & {
  id: string;
  name?: string;
  distanceNm?: number;
};

export type MeteoValueProvenance = MeteoProviderReference & {
  station?: MeteoStationReference;
  observedAt?: Date;
  calculatedAt?: Date;
  validAt?: Date;
  quality?: MeteoQuality;
  qualityReason?: MeteoReason;
  raw?: unknown;
};

export type MeteoSource = Position & MeteoProviderReference & {
  id?: string;
  name?: string;
  observedAt?: Date;
  calculatedAt?: Date;
  validAt?: Date;
  distanceNm?: number;
  quality?: MeteoQuality;
  qualityReason?: MeteoReason;
};

export type MeteoValue<TValue, TUnit extends MeteoUnit = MeteoUnit> = {
  value: TValue;
  unit?: TUnit;
  provenance: MeteoValueProvenance;
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
  validAt: Date;
  position: Position;
  mode: MeteoSnapshotMode;
  weather?: MeteoWeather;
  wind?: MeteoWind;
  sea?: MeteoSea;
  tide?: MeteoTide;
  astronomy?: MeteoAstronomy;
  sources: MeteoSource[];
  warnings: MeteoReason[];
};

export type MeteoService = {
  getSnapshot(request: MeteoSnapshotRequest): Promise<MeteoSnapshot>;
};
